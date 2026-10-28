package routes

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	productModel "stockflow/backend/internal/models/products"
)

func RegisterProductRoutes(r *gin.Engine, db *sql.DB) {
	products := r.Group("/api/products")
	{
		products.GET("", getProducts(db))
		// products.POST("", createProduct(db))
		// products.PUT("/:id", updateProduct(db))
		// products.DELETE("/:id", deleteProduct(db))
		// products.POST("/:id/stock", adjustStock(db))
		// products.GET("/:id/movements", getMovements(db))
	}
}

func getProducts(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := c.Query("search")
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
		if page < 1 {
			page = 1
		}
		if limit < 1 {
			limit = 10
		}
		offset := (page - 1) * limit

		query := `
			SELECT 
				p.id, 			p.sku, 							p.name, 
				p.price, 		p.stock, 						p.is_active, 
				p.created_at, 	COUNT(*) OVER() AS total_count
			FROM products p
			LEFT JOIN stock_movements sm ON sm.product_id = p.id
			WHERE ($1 = '' OR p.sku ILIKE '%' || $1 || '%' OR p.name ILIKE '%' || $1 || '%')
			GROUP BY p.id
			ORDER BY p.id ASC
			LIMIT $2 OFFSET $3
		`

		rows, err := db.Query(query, search, limit, offset)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
			return
		}
		defer rows.Close()

		var list []productModel.Product
		total := 0

		for rows.Next() {
			var product productModel.Product
			var totalCount int
			if err := rows.Scan(
				&product.ID, 			&product.Sku, 		&product.Name, 
				&product.Price, 		&product.Stock, 	&product.Is_active, 
				&product.Created_at, 	&totalCount); 
			err != nil {

				c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"code": "SCAN_ERROR", "message": err.Error()}})
				return

			}
			total = totalCount
			list = append(list, product)
		}

		c.JSON(http.StatusOK, productModel.PaginatedProducts{
			Data:  list,
			Page:  page,
			Limit: limit,
			Total: total,
		})
	}
}
