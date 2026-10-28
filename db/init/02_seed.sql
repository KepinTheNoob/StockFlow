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
('SKU-OLD-CBL', 'Legacy USB-A to Micro-USB Cable', 49000, 0, FALSE), -- Inactive & 0 stock
('SKU-LG-27GP', 'LG UltraGear 27" 144Hz Monitor', 4299000, 14, TRUE),
('SKU-SAM-ODYS', 'Samsung Odyssey G7 32"', 8799000, 6, TRUE),      -- Low stock (< 10)
('SKU-APP-IPAD', 'iPad Air 11" M2 128GB', 11999000, 22, TRUE),
('SKU-APP-PENC', 'Apple Pencil Pro', 2299000, 35, TRUE),
('SKU-ANK-737', 'Anker Prime 24000mAh Powerbank', 1899000, 19, TRUE),
('SKU-LOG-GPRO', 'Logitech G Pro X Superlight 2', 2199000, 7, TRUE),-- Low stock (< 10)
('SKU-ASU-RTX', 'ASUS TUF RTX 4070 Ti Super', 16500000, 3, TRUE), -- Low stock (< 10)
('SKU-RAZ-BLD', 'Razer BlackWidow V4 Pro', 3499000, 16, TRUE),
('SKU-CAL-DOCK', 'CalDigit TS4 Thunderbolt 4 Dock', 6499000, 9, TRUE), -- Low stock (< 10)
('SKU-BEL-CHG', 'Belkin 3-in-1 MagSafe Wireless Charger', 1999000, 28, TRUE),
('SKU-DIS-VGA', 'Discontinued VGA to DVI Adapter', 35000, 0, FALSE),  -- Inactive
('SKU-SON-PS5', 'PlayStation 5 Slim Digital', 7499000, 11, TRUE)
ON CONFLICT (sku) DO NOTHING;

-- 2. Initial Stock In Movements
INSERT INTO stock_movements (product_id, type, qty, note, created_at)
SELECT id, 'in', stock, 'Initial warehouse intake', now() - INTERVAL '3 days'
FROM products
WHERE stock > 0
ON CONFLICT DO NOTHING;

-- 3. Additional Historical Stock Movements for rich history
INSERT INTO stock_movements (product_id, type, qty, note, created_at)
SELECT id, 'in', 10, 'Supplier restock batch #B-104', now() - INTERVAL '1 day'
FROM products WHERE sku = 'SKU-IPH-15P';

INSERT INTO stock_movements (product_id, type, qty, note, created_at)
SELECT id, 'out', 2, 'Damaged during unloading', now() - INTERVAL '6 hours'
FROM products WHERE sku = 'SKU-LOG-MX3';

INSERT INTO stock_movements (product_id, type, qty, note, created_at)
SELECT id, 'in', 5, 'Quarterly stock replenishment', now() - INTERVAL '2 days'
FROM products WHERE sku = 'SKU-MAC-M3P';

INSERT INTO stock_movements (product_id, type, qty, note, created_at)
SELECT id, 'out', 1, 'Quality inspection audit sample', now() - INTERVAL '12 hours'
FROM products WHERE sku = 'SKU-SAM-ODYS';

-- 4. Sample Orders
INSERT INTO sales_orders (id, customer, status, total) VALUES
(1, 'PT Maju Bersama', 'CREATED', 23998000),
(2, 'CV Bintang Sejahtera', 'CANCELLED', 16499000)
ON CONFLICT (id) DO NOTHING;

-- 5. Sample Order Items
INSERT INTO sales_order_items (order_id, sku, qty, unit_price) VALUES
(1, 'SKU-IPH-15P', 1, 18999000),
(1, 'SKU-SON-WH5', 1, 4999000),
(2, 'SKU-MAC-AIR', 1, 16499000)
ON CONFLICT DO NOTHING;

-- Sync serial sequence for sales_orders
SELECT setval('sales_orders_id_seq', (SELECT COALESCE(MAX(id), 1) FROM sales_orders));