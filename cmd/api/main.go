package main

import (
	"database/sql"
	"log"
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "github.com/jackc/pgx/v5/stdlib"

	"stockflow/backend/internal/products"
)

var database *sql.DB

func main() {
	var err error
	connStr := "postgres://postgres:password@localhost:5432/stockflow?sslmode=disable"
	database, err = sql.Open("pgx", connStr)
	if err != nil {
		log.Fatalf("DB connection error: %v", err)
	}
	defer database.Close()

	if err := database.Ping(); err != nil {
		log.Fatalf("DB ping failed: %v", err)
	}
	log.Println("Database connected successfully!")

	router := gin.Default()

	// CORS setup
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Endpoints
	products.RegisterProductRoutes(router, database)


	router.Run(":8080")
}
