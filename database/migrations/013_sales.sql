-- Customers, draft orders, and prices the farm types.
-- Invoice posting is not available. No market price is seeded.

INSERT INTO permissions (id, code, description) VALUES
  ('00000000-0000-4000-8000-000000000132', 'sale.read', 'View customers, draft orders, and typed prices'),
  ('00000000-0000-4000-8000-000000000133', 'sale.record', 'Add a customer, a typed price, or a draft order');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
  (r.code = 'owner' AND p.code IN ('sale.read', 'sale.record'))
  OR (r.code = 'manager' AND p.code IN ('sale.read', 'sale.record'))
);

CREATE TABLE customers (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  phone VARCHAR(32) NULL,
  notes VARCHAR(500) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_customer_name (farm_id, name),
  CONSTRAINT fk_customer_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_customer_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE market_prices (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  item_name VARCHAR(160) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  unit_label VARCHAR(32) NOT NULL,
  effective_on DATE NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_market_price_farm (farm_id, effective_on),
  CONSTRAINT chk_market_amount CHECK (amount >= 0),
  CONSTRAINT fk_market_price_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_market_price_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE orders (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  customer_id CHAR(36) NOT NULL,
  ordered_on DATE NOT NULL,
  status ENUM('draft') NOT NULL DEFAULT 'draft',
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_orders_farm (farm_id, ordered_on),
  CONSTRAINT fk_order_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_order_customer FOREIGN KEY (customer_id) REFERENCES customers (id),
  CONSTRAINT fk_order_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE order_lines (
  id CHAR(36) NOT NULL,
  order_id CHAR(36) NOT NULL,
  description VARCHAR(160) NOT NULL,
  quantity DECIMAL(14,3) NOT NULL,
  unit_price DECIMAL(14,2) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT chk_order_line CHECK (quantity > 0 AND unit_price >= 0),
  CONSTRAINT fk_order_line FOREIGN KEY (order_id) REFERENCES orders (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
