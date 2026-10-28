package products

import "time"

type Product struct {
	ID             	int       	`json:"id"`
	Sku            	string     	`json:"sku"`
	Name           	string     	`json:"name"`
	Price          	int        	`json:"price"`
	Stock         	int        	`json:"stock"`
	IsActive     	bool       	`json:"is_active"`
	CreatedAt    	time.Time  	`json:"created_at"`
	LastMovementAt	*time.Time 	`json:"last_movement_at"`
}


type CreateProduct struct {
	SKU   	string	`json:"sku" binding:"required"`
	Name  	string	`json:"name" binding:"required"`
	Price	int   	`json:"price" binding:"gte=0"`
}

type UpdateProduct struct {
	Name     	*string	`json:"name"`
	Price    	*int    `json:"price" binding:"omitempty,gte=0"`
	IsActive	*bool   `json:"is_active"`
}

type AdjustStockInput struct {
	Type	string 	`json:"type" binding:"required,oneof=in out"`
	Qty  	int     `json:"qty" binding:"required,gt=0"`
	Note 	*string `json:"note"`
}

type StockMovement struct {
	ID        	int       	`json:"id"`
	ProductID	int       	`json:"product_id"`
	Type     	string    	`json:"type"`
	Qty       	int       	`json:"qty"`
	Note      	*string   	`json:"note"`
	CreatedAt 	time.Time	`json:"created_at"`
}

type PaginatedProducts struct {
	Data  	[]Product 	`json:"data"`
	Page 	int      	`json:"page"`
	Limit	int       	`json:"limit"`
	Total	int       	`json:"total"`
}