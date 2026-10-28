package orders

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/gin-gonic/gin"
	_ "github.com/jackc/pgx/v5/stdlib"
)

func setupTestDB(test *testing.T) (*sql.DB, *gin.Engine) {
	gin.SetMode(gin.TestMode)

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:password@localhost:5432/stockflow?sslmode=disable"
	}

	db, err := sql.Open("pgx", dbURL)
	if err != nil {
		test.Fatalf("Failed to connect to test database: %v", err)
	}

	if err := db.Ping(); err != nil {
		test.Fatalf("Database ping failed: %v", err)
	}

	router := gin.New()
	RegisterOrderRoutes(router, db)

	return db, router
}

// Test 1: Insufficient stock rejected with NOTHING written
func TestCreateOrder_InsufficientStock(test *testing.T) {
	db, router := setupTestDB(test)
	defer db.Close()

	testSKU := "TEST-OVERDRAW-001"
	db.Exec("DELETE FROM sales_order_items WHERE sku = $1", testSKU)
	db.Exec("DELETE FROM stock_movements WHERE product_id IN (SELECT id FROM products WHERE sku = $1)", testSKU)
	db.Exec("DELETE FROM products WHERE sku = $1", testSKU)

	var productID int
	err := db.QueryRow(`
		INSERT INTO products (sku, name, price, stock, is_active)
		VALUES ($1, 'Test Overdraw Product', 50000, 2, true)
		RETURNING id
	`, testSKU).Scan(&productID)
	if err != nil {
		test.Fatalf("Failed to insert test product: %v", err)
	}
	defer func() {
		db.Exec("DELETE FROM sales_order_items WHERE sku = $1", testSKU)
		db.Exec("DELETE FROM stock_movements WHERE product_id = $1", productID)
		db.Exec("DELETE FROM products WHERE id = $1", productID)
	}()

	// Attempt to order 5 units when there are only 2 in stock
	orderPayload := CreateOrderInput{
		Customer: "Test Overdraw Customer",
		Items: []OrderItemInput{
			{SKU: testSKU, Qty: 5},
		},
	}
	body, _ := json.Marshal(orderPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/orders", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// 409 Conflict
	if w.Code != http.StatusConflict {
		test.Fatalf("Expected status 409 Conflict, got %d. Body: %s", w.Code, w.Body.String())
	}

	// Verify NOTHING was written to database
	var currentStock int
	db.QueryRow("SELECT stock FROM products WHERE id = $1", productID).Scan(&currentStock)
	if currentStock != 2 {
		test.Errorf("Stock was modified on rejected order! Expected 2, got %d", currentStock)
	}

	var orderCount int
	db.QueryRow("SELECT COUNT(*) FROM sales_orders WHERE customer = $1", "Test Overdraw Customer").Scan(&orderCount)
	if orderCount != 0 {
		test.Errorf("Sales order was written despite overdraw! Count: %d", orderCount)
	}

	var movementCount int
	db.QueryRow("SELECT COUNT(*) FROM stock_movements WHERE product_id = $1", productID).Scan(&movementCount)
	if movementCount != 0 {
		test.Errorf("Stock movement was written despite overdraw! Count: %d", movementCount)
	}
}

// Test 2: Writes movement + updates stock atomically
func TestCreateOrder_HappyPath(test *testing.T) {
	db, router := setupTestDB(test)
	defer db.Close()

	testSKU := "TEST-HAPPY-001"
	db.Exec("DELETE FROM sales_order_items WHERE sku = $1", testSKU)
	db.Exec("DELETE FROM stock_movements WHERE product_id IN (SELECT id FROM products WHERE sku = $1)", testSKU)
	db.Exec("DELETE FROM products WHERE sku = $1", testSKU)

	var productID int
	err := db.QueryRow(`
		INSERT INTO products (sku, name, price, stock, is_active)
		VALUES ($1, 'Test Happy Product', 100000, 10, true)
		RETURNING id
	`, testSKU).Scan(&productID)
	if err != nil {
		test.Fatalf("Failed to insert test product: %v", err)
	}
	defer func() {
		db.Exec("DELETE FROM sales_order_items WHERE sku = $1", testSKU)
		db.Exec("DELETE FROM stock_movements WHERE product_id = $1", productID)
		db.Exec("DELETE FROM products WHERE id = $1", productID)
	}()

	orderPayload := CreateOrderInput{
		Customer: "Happy Path Customer",
		Items: []OrderItemInput{
			{SKU: testSKU, Qty: 3},
		},
	}
	body, _ := json.Marshal(orderPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/orders", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		test.Fatalf("Expected status 201 Created, got %d. Body: %s", w.Code, w.Body.String())
	}

	var newStock int
	db.QueryRow("SELECT stock FROM products WHERE id = $1", productID).Scan(&newStock)
	if newStock != 7 {
		test.Errorf("Expected remaining stock 7, got %d", newStock)
	}

	// Verify movement recorded
	var mType string
	var mQty int
	err = db.QueryRow(`
		SELECT type, qty FROM stock_movements
		WHERE product_id = $1
		ORDER BY created_at DESC LIMIT 1
	`, productID).Scan(&mType, &mQty)
	if err != nil {
		test.Fatalf("Failed to query stock movement: %v", err)
	}
	if mType != "out" || mQty != 3 {
		test.Errorf("Expected movement type 'out' and qty 3, got %s and %d", mType, mQty)
	}
}

// Test 3: Concurrency test (stock never goes negative under race conditions)
func TestCreateOrder_ConcurrencySafe(test *testing.T) {
	db, router := setupTestDB(test)
	defer db.Close()

	testSKU := "TEST-RACE-001"
	db.Exec("DELETE FROM sales_order_items WHERE sku = $1", testSKU)
	db.Exec("DELETE FROM stock_movements WHERE product_id IN (SELECT id FROM products WHERE sku = $1)", testSKU)
	db.Exec("DELETE FROM products WHERE sku = $1", testSKU)

	var productID int
	err := db.QueryRow(`
		INSERT INTO products (sku, name, price, stock, is_active)
		VALUES ($1, 'Test Race Product', 50000, 3, true)
		RETURNING id
	`, testSKU).Scan(&productID)
	if err != nil {
		test.Fatalf("Failed to insert test product: %v", err)
	}
	defer func() {
		db.Exec("DELETE FROM sales_order_items WHERE sku = $1", testSKU)
		db.Exec("DELETE FROM stock_movements WHERE product_id = $1", productID)
		db.Exec("DELETE FROM products WHERE id = $1", productID)
	}()

	// 10 concurrent requests, each attempting to buy 1 unit
	numRequests := 10
	var successCount int64
	var conflictCount int64

	var wg sync.WaitGroup
	wg.Add(numRequests)

	for i := 0; i < numRequests; i++ {
		go func() {
			defer wg.Done()

			payload := CreateOrderInput{
				Customer: "Concurrent Buyer",
				Items: []OrderItemInput{
					{SKU: testSKU, Qty: 1},
				},
			}
			b, _ := json.Marshal(payload)
			r := httptest.NewRequest(http.MethodPost, "/api/orders", bytes.NewBuffer(b))
			r.Header.Set("Content-Type", "application/json")
			recorder := httptest.NewRecorder()

			router.ServeHTTP(recorder, r)

			switch recorder.Code {
			case http.StatusCreated:
				atomic.AddInt64(&successCount, 1)
			case http.StatusConflict:
				atomic.AddInt64(&conflictCount, 1)
			}
		}()
	}

	wg.Wait()

	// Exactly 3 must succeed, 7 must fail
	if successCount != 3 {
		test.Errorf("Expected exactly 3 successful orders, got %d", successCount)
	}
	if conflictCount != 7 {
		test.Errorf("Expected exactly 7 conflict (409) orders, got %d", conflictCount)
	}

	// Stock in DB must be 0 NEVER negative
	var finalStock int
	db.QueryRow("SELECT stock FROM products WHERE id = $1", productID).Scan(&finalStock)
	if finalStock != 0 {
		test.Errorf("Expected final stock 0, got %d (must never be negative)", finalStock)
	}
}

// 4. Idempotency test (retries never double-order or double-decrement stock)
func TestCreateOrder_IdempotencyKey(test *testing.T) {
	db, router := setupTestDB(test)
	defer db.Close()

	testSKU := "TEST-IDEM-001"
	testKey := "idem-key-test-12345"

	db.Exec("DELETE FROM idempotency_keys WHERE key = $1", testKey)
	db.Exec("DELETE FROM sales_order_items WHERE sku = $1", testSKU)
	db.Exec("DELETE FROM stock_movements WHERE product_id IN (SELECT id FROM products WHERE sku = $1)", testSKU)
	db.Exec("DELETE FROM products WHERE sku = $1", testSKU)

	var productID int
	err := db.QueryRow(`
		INSERT INTO products (sku, name, price, stock, is_active)
		VALUES ($1, 'Test Idempotency Product', 25000, 10, true)
		RETURNING id
	`, testSKU).Scan(&productID)
	if err != nil {
		test.Fatalf("Failed to insert test product: %v", err)
	}
	defer func() {
		db.Exec("DELETE FROM idempotency_keys WHERE key = $1", testKey)
		db.Exec("DELETE FROM sales_order_items WHERE sku = $1", testSKU)
		db.Exec("DELETE FROM stock_movements WHERE product_id = $1", productID)
		db.Exec("DELETE FROM products WHERE id = $1", productID)
	}()

	payload := CreateOrderInput{
		Customer: "Idempotent Buyer",
		Items: []OrderItemInput{
			{SKU: testSKU, Qty: 2},
		},
	}
	body, _ := json.Marshal(payload)

	// First Request
	req1 := httptest.NewRequest(http.MethodPost, "/api/orders", bytes.NewBuffer(body))
	req1.Header.Set("Content-Type", "application/json")
	req1.Header.Set("Idempotency-Key", testKey)
	rec1 := httptest.NewRecorder()
	router.ServeHTTP(rec1, req1)

	if rec1.Code != http.StatusCreated {
		test.Fatalf("First request expected 201 Created, got %d: %s", rec1.Code, rec1.Body.String())
	}

	var order1 SalesOrder
	if err := json.Unmarshal(rec1.Body.Bytes(), &order1); err != nil {
		test.Fatalf("Failed to decode first response: %v", err)
	}

	// Verify stock decremented to 8
	var stockAfterFirst int
	db.QueryRow("SELECT stock FROM products WHERE id = $1", productID).Scan(&stockAfterFirst)
	if stockAfterFirst != 8 {
		test.Fatalf("Expected stock after first order to be 8, got %d", stockAfterFirst)
	}

	// Second Request with identical Idempotency-Key (simulating client retry or double-click)
	req2 := httptest.NewRequest(http.MethodPost, "/api/orders", bytes.NewBuffer(body))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("Idempotency-Key", testKey)
	rec2 := httptest.NewRecorder()
	router.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusCreated {
		test.Fatalf("Second request expected 201 Created, got %d: %s", rec2.Code, rec2.Body.String())
	}

	if rec2.Header().Get("Idempotent-Replay") != "true" {
		test.Errorf("Expected Idempotent-Replay header to be 'true', got '%s'", rec2.Header().Get("Idempotent-Replay"))
	}

	var order2 SalesOrder
	if err := json.Unmarshal(rec2.Body.Bytes(), &order2); err != nil {
		test.Fatalf("Failed to decode second response: %v", err)
	}

	if order2.ID != order1.ID {
		test.Errorf("Expected identical Order ID %d, got %d", order1.ID, order2.ID)
	}

	// Stock MUST still be 8, NOT decremented to 6
	var stockAfterSecond int
	db.QueryRow("SELECT stock FROM products WHERE id = $1", productID).Scan(&stockAfterSecond)
	if stockAfterSecond != 8 {
		test.Errorf("Expected stock to remain 8 on idempotent replay, got %d", stockAfterSecond)
	}

	// Total orders in DB for this customer must be exactly 1
	var orderCount int
	db.QueryRow("SELECT COUNT(*) FROM sales_orders WHERE customer = 'Idempotent Buyer'").Scan(&orderCount)
	if orderCount != 1 {
		test.Errorf("Expected exactly 1 sales order in database, got %d", orderCount)
	}
}
