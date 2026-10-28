package orders

import "time"

type OrderItemInput struct {
	SKU	string 	`json:"sku" binding:"required"`
	Qty int   	`json:"qty" binding:"required,gt=0"`
}

type CreateOrderInput struct {
	Customer	string          	`json:"customer" binding:"required"`
	Items    	[]OrderItemInput	`json:"items" binding:"required,min=1"`
}

type OrderItem struct {
	ID       	int    	`json:"id"`
	OrderID  	int    	`json:"order_id"`
	SKU       	string 	`json:"sku"`
	Qty       	int   	`json:"qty"`
	UnitPrice 	int   	`json:"unit_price"`
}

type SalesOrder struct {
	ID			int        	`json:"id"`
	Customer    string      `json:"customer"`
	Status      string      `json:"status"`
	Total       int         `json:"total"`
	CreatedAt   time.Time   `json:"created_at"`
	CancelledAt *time.Time  `json:"cancelled_at"`
	Items       []OrderItem `json:"items"`
}
