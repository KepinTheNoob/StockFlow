package products

import (
	"database/sql"

	"github.com/gin-gonic/gin"
)

func RegisterProductRoutes(r *gin.Engine, db *sql.DB) {
	products := r.Group("/api/products")
	{
		products.GET("", getProducts(db))
		products.POST("", createProduct(db))
		products.PUT("/:id", updateProduct(db))
		products.DELETE("/:id", deleteProduct(db))
	}
}

