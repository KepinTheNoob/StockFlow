package orders

import (
	"database/sql"
	"net/http"
	"time"
	"github.com/gin-gonic/gin"
)

// 1. Create Order (Core concurrency & atomicity requirements)
func createOrder(db *sql.DB) gin.HandlerFunc {
	return func(context *gin.Context) {
		var input CreateOrderInput
		if err := context.ShouldBindJSON(&input); err != nil {
			context.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// PDF Rule 1: Check duplicate SKUs in the same order
		seenSKUs := make(map[string]bool)
		for _, item := range input.Items {
			if seenSKUs[item.SKU] {
				context.JSON(http.StatusBadRequest, gin.H{
					"error": "Duplicate SKU in order: " + item.SKU,
				})
				return
			}
			seenSKUs[item.SKU] = true
		}

		// PDF Rule 3: Atomicity - all items in one transaction
		transaction, err := db.Begin()
		if err != nil {
			context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer transaction.Rollback()

		orderTotal := 0
		orderItems := []OrderItem{}

		for _, item := range input.Items {
			var productID int
			var unitPrice int
			var currentStock int

			// PDF Rule 5: Concurrency guard using FOR UPDATE (row lock)
			productQuery := `
				SELECT id, price, stock 
				FROM products 
				WHERE sku = $1 
				FOR UPDATE
			`
			err := transaction.QueryRow(productQuery, item.SKU).Scan(&productID, &unitPrice, &currentStock)
			if err == sql.ErrNoRows {
				context.JSON(http.StatusBadRequest, gin.H{"error": "Unknown product SKU: " + item.SKU})
				return
			} else if err != nil {
				context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			// PDF Rule 4: If insufficient stock, abort with exact error envelope
			if currentStock < item.Qty {
				context.JSON(http.StatusConflict, gin.H{
					"error": gin.H{
						"code":      "INSUFFICIENT_STOCK",
						"sku":       item.SKU,
						"available": currentStock,
					},
				})
				return
			}

			// Decrement stock
			updateStockQuery := `
				UPDATE products 
				SET stock = stock - $1 
				WHERE id = $2
			`
			if _, err := transaction.Exec(updateStockQuery, item.Qty, productID); err != nil {
				context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			// Record 'out' movement in same transaction
			insertMovementQuery := `
				INSERT INTO stock_movements (product_id, type, qty, note) 
				VALUES ($1, 'out', $2, 'Order consumption')
			`
			if _, err := transaction.Exec(insertMovementQuery, productID, item.Qty); err != nil {
				context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			// PDF Rule 2: unit_price from products table, server-computed total
			orderTotal += unitPrice * item.Qty
			orderItems = append(orderItems, OrderItem{
				SKU:       item.SKU,
				Qty:       item.Qty,
				UnitPrice: unitPrice,
			})
		}

		// Insert sales order
		insertOrderQuery := `
			INSERT INTO sales_orders (customer, status, total) 
			VALUES ($1, 'CREATED', $2) 
			RETURNING id, created_at
		`
		var orderID int
		var createdAt time.Time
		err = transaction.QueryRow(insertOrderQuery, input.Customer, orderTotal).Scan(&orderID, &createdAt)
		if err != nil {
			context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Insert sales order items
		insertItemQuery := `
			INSERT INTO sales_order_items (order_id, sku, qty, unit_price) 
			VALUES ($1, $2, $3, $4) 
			RETURNING id
		`
		for i := range orderItems {
			orderItems[i].OrderID = orderID
			err := transaction.QueryRow(
				insertItemQuery,
				orderID, orderItems[i].SKU, orderItems[i].Qty, orderItems[i].UnitPrice,
			).Scan(&orderItems[i].ID)
			if err != nil {
				context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}

		if err := transaction.Commit(); err != nil {
			context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		context.JSON(http.StatusCreated, SalesOrder{
			ID:        orderID,
			Customer:  input.Customer,
			Status:    "CREATED",
			Total:     orderTotal,
			CreatedAt: createdAt,
			Items:     orderItems,
		})
	}
}

// 2. Get Order by ID (Order + items + status + total)
func getOrder(db *sql.DB) gin.HandlerFunc {
	return func(context *gin.Context) {
		id := context.Param("id")

		orderQuery := `
			SELECT id, customer, status, total, created_at, cancelled_at 
			FROM sales_orders 
			WHERE id = $1
		`
		var order SalesOrder
		err := db.QueryRow(orderQuery, id).Scan(
			&order.ID, &order.Customer, &order.Status,
			&order.Total, &order.CreatedAt, &order.CancelledAt,
		)
		if err == sql.ErrNoRows {
			context.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
			return
		} else if err != nil {
			context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		itemsQuery := `
			SELECT id, order_id, sku, qty, unit_price 
			FROM sales_order_items 
			WHERE order_id = $1
		`
		rows, err := db.Query(itemsQuery, id)
		if err != nil {
			context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		order.Items = []OrderItem{}
		for rows.Next() {
			var item OrderItem
			if err := rows.Scan(&item.ID, &item.OrderID, &item.SKU, &item.Qty, &item.UnitPrice); err != nil {
				context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			order.Items = append(order.Items, item)
		}

		if err := rows.Err(); err != nil {
			context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		context.JSON(http.StatusOK, order)
	}
}

// 3. Cancel Order (Restores stock; 409 when already cancelled)
func cancelOrder(db *sql.DB) gin.HandlerFunc {
	return func(context *gin.Context) {
		id := context.Param("id")

		transaction, err := db.Begin()
		if err != nil {
			context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer transaction.Rollback()

		// Check current status under lock
		var currentStatus string
		err = transaction.QueryRow("SELECT status FROM sales_orders WHERE id = $1 FOR UPDATE", id).Scan(&currentStatus)
		if err == sql.ErrNoRows {
			context.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
			return
		} else if err != nil {
			context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if currentStatus == "CANCELLED" {
			context.JSON(http.StatusConflict, gin.H{
				"error": gin.H{"code": "ORDER_ALREADY_CANCELLED"},
			})
			return
		}

		// Mark order as CANCELLED
		cancelQuery := `
			UPDATE sales_orders 
			SET status = 'CANCELLED', cancelled_at = now() 
			WHERE id = $1
		`
		if _, err := transaction.Exec(cancelQuery, id); err != nil {
			context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Retrieve items to restore stock
		itemsQuery := `
			SELECT sku, qty 
			FROM sales_order_items 
			WHERE order_id = $1
		`
		rows, err := transaction.Query(itemsQuery, id)
		if err != nil {
			context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		type restoreItem struct {
			sku string
			qty int
		}
		toRestore := []restoreItem{}
		for rows.Next() {
			var r restoreItem
			rows.Scan(&r.sku, &r.qty)
			toRestore = append(toRestore, r)
		}

		// Restore stock and record 'in' movement for each item
		for _, item := range toRestore {
			var productID int
			err := transaction.QueryRow(
				"UPDATE products SET stock = stock + $1 WHERE sku = $2 RETURNING id",
				item.qty, item.sku,
			).Scan(&productID)
			if err != nil {
				context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			insertMovementQuery := `
				INSERT INTO stock_movements (product_id, type, qty, note) 
				VALUES ($1, 'in', $2, 'Order cancellation restoration')
			`
			if _, err := transaction.Exec(insertMovementQuery, productID, item.qty); err != nil {
				context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}

		if err := transaction.Commit(); err != nil {
			context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		context.JSON(http.StatusOK, gin.H{"message": "Order cancelled and stock restored"})
	}
}
