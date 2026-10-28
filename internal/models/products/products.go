package products

import "time"

type Product struct {
	ID			int 		`json:"id"`
	Sku			string 		`json:"sku"`
	Name		string 		`json:"name"`
	Price		int 		`json:"price"`
	Stock		int 		`json:"stock"`
	Is_active	bool 		`json:"is_active"`
	Created_at	time.Time 	`json:"created_at"`
}

type CreateProduct struct {
	SKU   	string	`json:"sku" binding:"required"`
	Name  	string	`json:"name" binding:"required"`
	Price	int   	`json:"price" binding:"gte=0"`
}

type PaginatedProducts struct {
	Data  	[]Product 	`json:"data"`
	Page 	int      	`json:"page"`
	Limit	int       	`json:"limit"`
	Total	int       	`json:"total"`
}