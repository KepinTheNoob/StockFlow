package products

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func getProducts(db *sql.DB) gin.HandlerFunc {
	return func(context *gin.Context) {
		search := context.Query("search")
		page, _ := strconv.Atoi(context.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(context.DefaultQuery("limit", "10"))
		offset := (page - 1) * limit

		query := `
			SELECT 
				p.id, 			p.sku, 									p.name, 
				p.price, 		p.stock, 								p.is_active, 
				p.created_at, 	MAX(sm.created_at) AS last_movement_at,	COUNT(*) OVER() AS total_count
			FROM products p
			LEFT JOIN stock_movements sm ON sm.product_id = p.id
			WHERE ($1 = '' OR p.sku ILIKE '%' || $1 || '%' OR p.name ILIKE '%' || $1 || '%')
			GROUP BY p.id
			ORDER BY p.id ASC
			LIMIT $2 OFFSET $3
		`

		rows, err := db.Query(query, search, limit, offset)

		if err != nil {
			context.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
			return
		}
		defer rows.Close()

		list := []Product{}
		total := 0

		for rows.Next() {
			var product Product
			var totalCount int
			if err := rows.Scan(
				&product.ID, 			&product.Sku, 				&product.Name, 
				&product.Price, 		&product.Stock, 			&product.IsActive, 
				&product.CreatedAt, 	&product.LastMovementAt, 	&totalCount); 
			err != nil {
				context.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"code": "SCAN_ERROR", "message": err.Error()}})
				return
			}
			total = totalCount
			list = append(list, product)
		}


		if err := rows.Err(); err != nil {
			context.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"code": "ROWS_ERROR", "message": err.Error()}})
			return
		}

		context.JSON(http.StatusOK, PaginatedProducts{
			Data:  list,
			Page:  page,
			Limit: limit,
			Total: total,
		})
	}
}

func createProduct(db *sql.DB) gin.HandlerFunc {
	return func(context *gin.Context) {
		var input CreateProduct
		if err := context.ShouldBindJSON(&input); err != nil {
			context.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		query := `
			INSERT INTO products (sku, name, price)
			VALUES ($1, $2, $3)
			RETURNING id, sku, name, price, stock, is_active, created_at
		`

		var product Product
		err := db.QueryRow(query, input.SKU, input.Name, input.Price).Scan(
			&product.ID, 		&product.Sku, 		&product.Name, 
			&product.Price, 	&product.Stock, 	&product.IsActive, 
			&product.CreatedAt,
		)
		if err != nil {
			context.JSON(http.StatusBadRequest, gin.H{"error": "Failed to create product (SKU may already exist)"})
			return
		}

		context.JSON(http.StatusCreated, product)
	}
}

func updateProduct(db *sql.DB) gin.HandlerFunc {
	return func(context *gin.Context) {
		id := context.Param("id")

		var input UpdateProduct
		if err := context.ShouldBindJSON(&input); err != nil {
			context.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		query := `
			UPDATE products 
			SET 
				name = COALESCE($1, name),
			    price = COALESCE($2, price),
			    is_active = COALESCE($3, is_active)
			WHERE id = $4
			RETURNING id, sku, name, price, stock, is_active, created_at
		`

		var product Product
		err := db.QueryRow(query, input.Name, input.Price, input.IsActive, id).Scan(
			&product.ID, 		&product.Sku, 		&product.Name, 
			&product.Price, 	&product.Stock, 	&product.IsActive, 
			&product.CreatedAt,
		)
		if err == sql.ErrNoRows {
			context.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
			return
		} else if err != nil {
			context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		context.JSON(http.StatusOK, product)
	}
}

func deleteProduct(db *sql.DB) gin.HandlerFunc {
	return func(context *gin.Context) {
		id := context.Param("id")

		res, err := db.Exec("DELETE FROM products WHERE id = $1", id)
		if err != nil {
			context.JSON(http.StatusConflict, gin.H{"error": gin.H{"code": "PRODUCT_HAS_HISTORY"}})
			return
		}

		rows, _ := res.RowsAffected()
		if rows == 0 {
			context.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
			return
		}

		context.Status(http.StatusNoContent)
	}
}

func adjustStock(db *sql.DB) gin.HandlerFunc {
	return func(context *gin.Context) {
		id := context.Param("id")

		var input AdjustStockInput
		if err := context.ShouldBindJSON(&input); err != nil {
			context.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		transaction, err := db.Begin()
		if err != nil {
			context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer transaction.Rollback()

		var updateQuery string
		if input.Type == "out" {
			updateQuery = `
				UPDATE products 
				SET stock = stock - $1 
				WHERE id = $2 AND stock >= $1 
				RETURNING stock
			`
		} else {
			updateQuery = `
				UPDATE products 
				SET stock = stock + $1 
				WHERE id = $2 
				RETURNING stock
			`
		}
		var newStock int
		err = transaction.QueryRow(updateQuery, input.Qty, id).Scan(&newStock)

		if err == sql.ErrNoRows {
			var available int
			db.QueryRow("SELECT stock FROM products WHERE id = $1", id).Scan(&available)
			context.JSON(http.StatusConflict, gin.H{
				"error": gin.H{"code": "INSUFFICIENT_STOCK", "available": available},
			})
			return
		} else if err != nil {
			context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		transaction.Exec(
			"INSERT INTO stock_movements (product_id, type, qty, note) VALUES ($1, $2, $3, $4)",
			id, input.Type, input.Qty, input.Note,
		)

		transaction.Commit()
		context.JSON(http.StatusOK, gin.H{"stock": newStock})
	}
}

func getProductMovements(db *sql.DB) gin.HandlerFunc {
	return func(context *gin.Context) {
		id := context.Param("id")

		query := `
			SELECT 
				id, 	product_id, 	type, 
				qty, 	note, 			created_at 
			FROM stock_movements 
			WHERE product_id = $1 
			ORDER BY created_at DESC
		`
		rows, err := db.Query(query, id)
		
		if err != nil {
			context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		movements := []StockMovement{}
		for rows.Next() {
			var m StockMovement
			rows.Scan(&m.ID, &m.ProductID, &m.Type, &m.Qty, &m.Note, &m.CreatedAt)
			movements = append(movements, m)
		}

		if err := rows.Err(); err != nil {
			context.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		context.JSON(http.StatusOK, gin.H{"data": movements})
	}
}
