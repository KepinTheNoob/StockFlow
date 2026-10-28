package products

import (
	"database/sql"

	"github.com/gin-gonic/gin"
)

func RegisterProductRoutes(route *gin.Engine, db *sql.DB) {
	products := route.Group("/api/products")
	{
		products.GET("", getProducts(db))
		products.POST("", createProduct(db))
		products.PUT("/:id", updateProduct(db))
		products.DELETE("/:id", deleteProduct(db))
		products.POST("/:id/stock", adjustStock(db))
		products.GET("/:id/movements", getProductMovements(db))
	}
}

