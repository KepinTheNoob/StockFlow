# StockFlow: Inventory & Sales Management (Mini ERP Module)

A full-stack inventory and sales order management module built with **React + TypeScript (Vite)** and **Go + PostgreSQL**.

---

## Quickstart (Runnable in < 3 minutes)

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Go 1.22+](https://go.dev/dl/)
- [Node.js 20+](https://nodejs.org/)

### 1. Start PostgreSQL
From the repository root:
```bash
docker compose up -d
```
This command starts PostgreSQL 16 on port `5432` and automatically runs all migrations and seed data from `./db/init` (25 products, initial stock movements, and sample orders).

### 2. Start the Backend (Go)
```bash
cd backend
go run cmd/api/main.go
```
The Go Gin API server will start on `http://localhost:8080`.

### 3. Start the Frontend (React + Vite)
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
The web UI will be available at `http://localhost:5173`.

---

## Running Automated Tests

### Backend Tests (Data Safety & Concurrency with Race Detector)
```bash
cd backend
go test -v -race ./internal/orders
```
**Test Coverage:**
- `TestCreateOrder_InsufficientStock`: Verifies that an order exceeding stock returns `409 INSUFFICIENT_STOCK`, and nothing is written to products, orders, or stock movements.
- `TestCreateOrder_HappyPath`: Verifies stock decrements accurately and writes a stock movement row atomically.
- `TestCreateOrder_ConcurrencySafe`: Simulates 10 concurrent goroutines racing to purchase 3 remaining items. Verifies exactly 3 succeed, 7 receive 409, and stock ends at exactly 0 without race conditions.

### Frontend Unit Tests (Vitest)
```bash
cd frontend
npm test
```
**Test Coverage:**
- Indonesian Rupiah formatting (`formatRupiah`) without float decimals.
- Relative time calculations (`formatTimeAgo`) across minutes, hours, and days.

---

## Architecture & Key Design Decisions

### 1. Data Safety Under Concurrency
- **Guarded Atomic Decrements (No SELECT-then-UPDATE)**:
  Order items decrement stock using a guarded update within a database transaction:
  ```sql
  UPDATE products
  SET stock = stock - $1
  WHERE sku = $2 AND stock >= $1
  RETURNING id, price, stock;
  ```
  If `stock < qty`, `sql.ErrNoRows` is returned immediately, triggering a transaction rollback. Under high concurrency, PostgreSQL row-level locks prevent race conditions and overdraws.
- **Order Cancellation Guard**:
  When cancelling an order, the status is checked using `SELECT status FROM sales_orders WHERE id = $1 FOR UPDATE`. If already cancelled, it rejects with `409 ORDER_ALREADY_CANCELLED`. If valid, stock is restored atomically and a compensating movement is recorded.
- **Database CHECK Constraints**:
  As a defense-in-depth safety net, `CHECK (stock >= 0)` and `CHECK (price >= 0)` are enforced directly in the PostgreSQL schema.

### 2. Cross-Stack Error Normalization
- When stock is insufficient, the Go backend returns a structured error:
  ```json
  {
    "error": {
      "code": "INSUFFICIENT_STOCK",
      "sku": "SKU-IPH-15P",
      "available": 25
    }
  }
  ```
- The frontend API client (`frontend/src/api/client.ts`) normalizes this envelope and displays it directly inline inside the modal (highlighting the specific failing SKU and the exact stock available), rather than logging an unhandled error to the console.

### 3. Derived `last_movement_at`
- **Design Choice**: `last_movement_at` is derived dynamically using a `LEFT JOIN stock_movements sm ON sm.product_id = p.id` with `MAX(sm.created_at) GROUP BY p.id`.
- **Rationale**: Storing `last_movement_at` directly on the `products` table creates a dual-write vulnerability where product rows can drift out of sync with `stock_movements`. Treating `stock_movements` as the immutable single source of truth eliminates desynchronization bugs while maintaining quick index lookups.

### 4. Client-Server Communication & CORS
- The Go backend configures CORS middleware in `backend/cmd/api/main.go`, permitting requests from Vite's local dev server (`http://localhost:5173`) with full support for GET, POST, PUT, DELETE, and OPTIONS preflight checks.

---

## API Contract & curl Examples

### 1. List Products
```bash
curl -s http://localhost:8080/api/products
```
**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "sku": "SKU-IPH-15P",
      "name": "iPhone 15 Pro 128GB",
      "price": 18999000,
      "stock": 25,
      "is_active": true,
      "created_at": "2026-10-28T18:09:20Z",
      "last_movement_at": "2026-10-28T22:30:00Z"
    }
  ],
  "page": 1,
  "limit": 1000,
  "total": 25
}
```

### 2. Adjust Stock
```bash
curl -s -X POST http://localhost:8080/api/products/1/stock \
  -H "Content-Type: application/json" \
  -d '{"type": "in", "qty": 10, "note": "Restock delivery"}'
```
**Response (200 OK):**
```json
{
  "stock": 35
}
```

### 3. Get Stock Movement History
```bash
curl -s http://localhost:8080/api/products/1/movements
```
**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 12,
      "product_id": 1,
      "movement_type": "in",
      "quantity": 10,
      "reference_type": "adjustment",
      "reference_id": null,
      "note": "Restock delivery",
      "created_at": "2026-10-28T23:15:00Z"
    }
  ]
}
```

### 4. Create Sales Order (Happy Path)
```bash
curl -s -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "PT Maju Jaya",
    "items": [
      {"sku": "SKU-IPH-15P", "qty": 2}
    ]
  }'
```
**Response (201 Created):**
```json
{
  "id": 3,
  "customer": "PT Maju Jaya",
  "status": "CREATED",
  "total": 37998000,
  "created_at": "2026-10-28T22:50:00Z",
  "cancelled_at": null,
  "items": [
    {
      "id": 4,
      "order_id": 3,
      "sku": "SKU-IPH-15P",
      "qty": 2,
      "unit_price": 18999000
    }
  ]
}
```

### 5. Insufficient Stock Rejection (409 Conflict)
```bash
curl -s -i -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "Overdraw Corp",
    "items": [
      {"sku": "SKU-KEY-K2P", "qty": 999}
    ]
  }'
```
**Response (409 Conflict):**
```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "sku": "SKU-KEY-K2P",
    "available": 2
  }
}
```

### 6. Get Order Details
```bash
curl -s http://localhost:8080/api/orders/3
```
**Response (200 OK):**
```json
{
  "id": 3,
  "customer": "PT Maju Jaya",
  "status": "CREATED",
  "total": 37998000,
  "created_at": "2026-10-28T22:50:00Z",
  "cancelled_at": null,
  "items": [
    {
      "id": 4,
      "order_id": 3,
      "sku": "SKU-IPH-15P",
      "qty": 2,
      "unit_price": 18999000
    }
  ]
}
```

### 7. Cancel Sales Order
```bash
curl -s -X POST http://localhost:8080/api/orders/3/cancel
```
**Response (200 OK):**
```json
{
  "message": "Order cancelled and stock restored"
}
```

### 8. Delete Product Protection (409 Conflict)
```bash
curl -s -i -X DELETE http://localhost:8080/api/products/1
```
**Response (409 Conflict):**
```json
{
  "error": {
    "code": "PRODUCT_HAS_HISTORY"
  }
}
```

---

## What I Would Improve Next

1. **Idempotency-Key Header on Orders**:
   Add an `Idempotency-Key` header on `POST /api/orders` cached via Redis or PostgreSQL to prevent duplicate orders during client retries or network drops.
2. **Unified Multi-Service Docker Compose**:
   Add backend and frontend services into `docker-compose.yml` for single-command (`docker compose up`) production deployments.
3. **Dedicated Inventory Metrics Endpoint**:
   For enterprise catalogs with 100,000+ items, implement `GET /api/inventory/stats` executing `SELECT SUM(price * stock), COUNT(*)` in PostgreSQL rather than aggregating client-side.
4. **Database Migration Tooling**:
   Transition from startup SQL scripts to versioned database migration tools (`golang-migrate` or `goose`).
5. **End-to-End Browser Testing**:
   Implement Playwright browser tests covering full user flows (adjust stock -> create order -> cancel order -> verify stock restored in table).

---

## Honest Hours Spent

- **Database modeling & Docker setup**: ~0.75 hours
- **Go API & Concurrency safety**: ~2.5 hours
- **React UI, Modals & Toast feedback**: ~1.75 hours
- **Automated tests (Go concurrency + Vitest) & Documentation**: ~1 hour
- **Total effort**: ~6 hours
