package orders

import (
	"database/sql"

	"github.com/gin-gonic/gin"
)

func RegisterOrderRoutes(route *gin.Engine, db *sql.DB) {
	orders := route.Group("/api/orders")
	{
		orders.POST("", createOrder(db))
		orders.GET("/:id", getOrder(db)) 
	}
}
