package orders

import "time"

type Product struct {
	ID			string 		`json:"id"`
	Sku			string 		`json:"sku"`
	Name		string 		`json:"name"`
	Price		int 		`json:"price"`
	Stock		int 		`json:"stock"`
	Is_active	bool 		`json:"is_active"`
	Created_at	time.Time 	`json:"created_at"`
}

type PaginatedProducts struct {
	Data  []Product `json:"data"`
	Page  int       `json:"page"`
	Limit int       `json:"limit"`
	Total int       `json:"total"`
}