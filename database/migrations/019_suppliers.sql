-- Supplier names, draft purchase orders, receipts, bills, and payments the farm types.
-- A receipt does not change stock. There is no tax column.

INSERT INTO permissions (id, code, description) VALUES
  ('00000000-0000-4000-8000-000000000144', 'supplier.read', 'View suppliers, draft orders, receipts, bills, and payments'),
  ('00000000-0000-4000-8000-000000000145', 'supplier.record', 'Add a supplier row the farm types');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
  (r.code = 'owner' AND p.code IN ('supplier.read', 'supplier.record'))
  OR (r.code = 'manager' AND p.code IN ('supplier.read', 'supplier.record'))
);

CREATE TABLE suppliers (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  contact_name VARCHAR(120) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  notes VARCHAR(500) NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_supplier_name (farm_id, name),
  CONSTRAINT fk_supplier_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_supplier_creator FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE TABLE purchase_orders (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  supplier_id CHAR(36) NOT NULL,
  ordered_on DATE NOT NULL,
  status ENUM('draft') NOT NULL DEFAULT 'draft',
  notes VARCHAR(500) NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_purchase_order_farm (farm_id, ordered_on),
  CONSTRAINT fk_purchase_order_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_purchase_order_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id),
  CONSTRAINT fk_purchase_order_creator FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE TABLE purchase_order_lines (
  id CHAR(36) NOT NULL,
  order_id CHAR(36) NOT NULL,
  description VARCHAR(160) NOT NULL,
  quantity DECIMAL(14,3) NOT NULL,
  unit_label VARCHAR(32) NOT NULL,
  unit_price DECIMAL(14,4) NULL,
  price_unit VARCHAR(32) NULL,
  PRIMARY KEY (id),
  KEY idx_purchase_line_order (order_id),
  CONSTRAINT chk_purchase_qty CHECK (quantity > 0),
  CONSTRAINT chk_purchase_price CHECK (unit_price IS NULL OR unit_price >= 0),
  CONSTRAINT fk_purchase_line_order FOREIGN KEY (order_id) REFERENCES purchase_orders (id)
);

CREATE TABLE goods_receipts (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  supplier_id CHAR(36) NOT NULL,
  purchase_order_id CHAR(36) NULL,
  received_on DATE NOT NULL,
  accepted_quantity DECIMAL(14,3) NOT NULL,
  rejected_quantity DECIMAL(14,3) NOT NULL,
  unit_label VARCHAR(32) NOT NULL,
  note VARCHAR(500) NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_receipt_farm (farm_id, received_on),
  CONSTRAINT chk_receipt_accepted CHECK (accepted_quantity >= 0),
  CONSTRAINT chk_receipt_rejected CHECK (rejected_quantity >= 0),
  CONSTRAINT fk_receipt_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_receipt_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id),
  CONSTRAINT fk_receipt_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id),
  CONSTRAINT fk_receipt_creator FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE TABLE supplier_bills (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  supplier_id CHAR(36) NOT NULL,
  billed_on DATE NOT NULL,
  amount DECIMAL(14,4) NOT NULL,
  unit_label VARCHAR(32) NOT NULL,
  reference_note VARCHAR(160) NOT NULL,
  notes VARCHAR(500) NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_supplier_bill_farm (farm_id, billed_on),
  CONSTRAINT chk_supplier_bill_amount CHECK (amount > 0),
  CONSTRAINT fk_supplier_bill_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_supplier_bill_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id),
  CONSTRAINT fk_supplier_bill_creator FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE TABLE supplier_payments (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  supplier_id CHAR(36) NOT NULL,
  paid_on DATE NOT NULL,
  amount DECIMAL(14,4) NOT NULL,
  unit_label VARCHAR(32) NOT NULL,
  reference_note VARCHAR(160) NOT NULL,
  notes VARCHAR(500) NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_supplier_payment_farm (farm_id, paid_on),
  CONSTRAINT chk_supplier_payment_amount CHECK (amount > 0),
  CONSTRAINT fk_supplier_payment_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_supplier_payment_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id),
  CONSTRAINT fk_supplier_payment_creator FOREIGN KEY (created_by) REFERENCES users (id)
);
