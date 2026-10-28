-- 1. Realistic Products (IDR integer prices)
INSERT INTO products (sku, name, price, stock, is_active) VALUES
('SKU-IPH-15P', 'iPhone 15 Pro 128GB', 18999000, 25, TRUE),
('SKU-IPH-15B', 'iPhone 15 128GB', 14299000, 40, TRUE),
('SKU-MAC-M3P', 'MacBook Pro 14" M3 Pro', 31999000, 15, TRUE),
('SKU-MAC-AIR', 'MacBook Air 13" M2', 16499000, 30, TRUE),
('SKU-SAM-S24', 'Samsung Galaxy S24 Ultra', 21499000, 18, TRUE),
('SKU-SAM-ZFL', 'Samsung Galaxy Z Flip 5', 13999000, 8, TRUE),  -- Low stock (< 10)
('SKU-SON-WH5', 'Sony WH-1000XM5 Headphones', 4999000, 50, TRUE),
('SKU-APP-AIR', 'AirPods Pro 2nd Gen', 3599000, 60, TRUE),
('SKU-DEL-X13', 'Dell XPS 13 Plus', 24999000, 5, TRUE),          -- Low stock (< 10)
('SKU-LOG-MX3', 'Logitech MX Master 3S', 1499000, 85, TRUE),
('SKU-KEY-K2P', 'Keychron K2 Pro Mechanical', 1750000, 2, TRUE),  -- Low stock (< 10)
('SKU-ASU-ROG', 'ASUS ROG Zephyrus G14', 28999000, 12, TRUE),
('SKU-OLD-CBL', 'Legacy USB-A to Micro-USB Cable', 49000, 0, FALSE); -- Inactive & 0 stock
-- 2. Initial Stock In Movements
INSERT INTO stock_movements (product_id, type, qty, note)
SELECT id, 'in', stock, 'Initial warehouse intake'
FROM products
WHERE stock > 0;
-- 3. Sample Orders
INSERT INTO sales_orders (id, customer, status, total) VALUES
(1, 'PT Maju Bersama', 'CREATED', 23998000),
(2, 'CV Bintang Sejahtera', 'CANCELLED', 16499000);
-- 4. Sample Order Items
INSERT INTO sales_order_items (order_id, sku, qty, unit_price) VALUES
(1, 'SKU-IPH-15P', 1, 18999000),
(1, 'SKU-SON-WH5', 1, 4999000),
(2, 'SKU-MAC-AIR', 1, 16499000);
-- Sync serial sequence for sales_orders
SELECT setval('sales_orders_id_seq', (SELECT MAX(id) FROM sales_orders));