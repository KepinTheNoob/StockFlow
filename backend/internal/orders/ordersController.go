package orders

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func createOrder(db *sql.DB) gin.HandlerFunc {
	return func(context *gin.Context) {
		var input CreateOrderInput
		if err := context.ShouldBindJSON(&input); err != nil {
			context.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		seen := make(map[string]bool)
		for _, item := range input.Items {
			if seen[item.SKU] {
				context.JSON(http.StatusBadRequest, gin.H{"error": "Duplicate SKU: " + item.SKU})
				return
			}
			seen[item.SKU] = true
		}

		transaction, err := db.Begin()
		if err != nil {
			context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer transaction.Rollback()

		orderTotal := 0
		orderItems := []OrderItem{}

		for _, item := range input.Items {
			var productID, unitPrice, newStock int

			query := `
				UPDATE products 
				SET stock = stock - $1 
				WHERE sku = $2 AND stock >= $1 
				RETURNING id, price, stock
			`
			err := transaction.QueryRow(query, item.Qty, item.SKU).Scan(&productID, &unitPrice, &newStock)

			if err == sql.ErrNoRows {
				var currentStock int
				if err := db.QueryRow("SELECT stock FROM products WHERE sku = $1", item.SKU).Scan(&currentStock); err != nil {
					context.JSON(http.StatusBadRequest, gin.H{"error": "Unknown SKU: " + item.SKU})
				} else {
					context.JSON(http.StatusConflict, gin.H{
						"error": gin.H{"code": "INSUFFICIENT_STOCK", "sku": item.SKU, "available": currentStock},
					})
				}
				return
			} else if err != nil {
				context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			insertMovementQuery := `
				INSERT INTO stock_movements (product_id, type, qty, note) 
				VALUES ($1, 'out', $2, 'Order consumption')
			`
			if _, err := transaction.Exec(insertMovementQuery, productID, item.Qty); err != nil {
				context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			orderTotal += unitPrice * item.Qty
			orderItems = append(orderItems, OrderItem{
				SKU:       item.SKU,
				Qty:       item.Qty,
				UnitPrice: unitPrice,
			})
		}

		insertOrderQuery := `
			INSERT INTO sales_orders (customer, total) 
			VALUES ($1, $2) 
			RETURNING id, created_at
		`
		var orderID int
		var createdAt time.Time
		if err := transaction.QueryRow(insertOrderQuery, input.Customer, orderTotal).Scan(&orderID, &createdAt); err != nil {
			context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

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

func getOrder(db *sql.DB) gin.HandlerFunc {
	return func(context *gin.Context) {
		id := context.Param("id")

		orderQuery := `
			SELECT 
				id, 	customer, 	status, 
				total, 	created_at, cancelled_at 
			FROM sales_orders 
			WHERE id = $1
		`
		var order SalesOrder
		err := db.QueryRow(orderQuery, id).Scan(
			&order.ID, 		&order.Customer, 	&order.Status,
			&order.Total, 	&order.CreatedAt, 	&order.CancelledAt,
		)
		if err == sql.ErrNoRows {
			context.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
			return
		} else if err != nil {
			context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		itemsQuery := `
			SELECT 
				id, 	order_id, 	sku, 
				qty, 	unit_price 
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
			if err := rows.Scan(
				&item.ID, 		&item.OrderID, 	&item.SKU, 
				&item.Qty, 		&item.UnitPrice,
			); err != nil {
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

func cancelOrder(db *sql.DB) gin.HandlerFunc {
	return func(context *gin.Context) {
		id := context.Param("id")

		transaction, err := db.Begin()
		if err != nil {
			context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer transaction.Rollback()

		var currentStatus string
		checkQuery := `
			SELECT status 
			FROM sales_orders 
			WHERE id = $1 
			FOR UPDATE
		`
		err = transaction.QueryRow(checkQuery, id).Scan(&currentStatus)
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

		cancelQuery := `
			UPDATE sales_orders 
			SET status = 'CANCELLED', cancelled_at = now() 
			WHERE id = $1
		`
		if _, err := transaction.Exec(cancelQuery, id); err != nil {
			context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

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

		type itemRestore struct {
			sku string
			qty int
		}
		toRestore := []itemRestore{}
		for rows.Next() {
			var item itemRestore
			if err := rows.Scan(&item.sku, &item.qty); err != nil {
				context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			toRestore = append(toRestore, item)
		}

		if err := rows.Err(); err != nil {
			context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		for _, item := range toRestore {
			var productID int
			restoreStockQuery := `
				UPDATE products 
				SET stock = stock + $1 
				WHERE sku = $2 
				RETURNING id
			`
			err := transaction.QueryRow(restoreStockQuery, item.qty, item.sku).Scan(&productID)
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

