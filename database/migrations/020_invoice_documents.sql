-- Unposted invoice documents and return rows. Posting a sale stays off. No tax column.

CREATE TABLE invoice_documents (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  customer_id CHAR(36) NOT NULL,
  order_id CHAR(36) NULL,
  issued_on DATE NOT NULL,
  status ENUM('unposted') NOT NULL DEFAULT 'unposted',
  notes VARCHAR(500) NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_invoice_doc_farm (farm_id, issued_on),
  CONSTRAINT fk_invoice_doc_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_invoice_doc_customer FOREIGN KEY (customer_id) REFERENCES customers (id),
  CONSTRAINT fk_invoice_doc_order FOREIGN KEY (order_id) REFERENCES orders (id),
  CONSTRAINT fk_invoice_doc_creator FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE TABLE invoice_lines (
  id CHAR(36) NOT NULL,
  document_id CHAR(36) NOT NULL,
  description VARCHAR(160) NOT NULL,
  quantity DECIMAL(14,3) NOT NULL,
  unit_label VARCHAR(32) NOT NULL,
  unit_price DECIMAL(14,4) NULL,
  price_unit VARCHAR(32) NULL,
  PRIMARY KEY (id),
  KEY idx_invoice_line_doc (document_id),
  CONSTRAINT chk_invoice_qty CHECK (quantity > 0),
  CONSTRAINT chk_invoice_price CHECK (unit_price IS NULL OR unit_price >= 0),
  CONSTRAINT fk_invoice_line_doc FOREIGN KEY (document_id) REFERENCES invoice_documents (id)
);

CREATE TABLE sale_returns (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  document_id CHAR(36) NOT NULL,
  returned_on DATE NOT NULL,
  description VARCHAR(160) NOT NULL,
  quantity DECIMAL(14,3) NOT NULL,
  amount DECIMAL(14,4) NULL,
  unit_label VARCHAR(32) NULL,
  note VARCHAR(500) NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_sale_return_doc (document_id),
  CONSTRAINT chk_return_qty CHECK (quantity >= 0),
  CONSTRAINT chk_return_amount CHECK (amount IS NULL OR amount > 0),
  CONSTRAINT fk_sale_return_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_sale_return_doc FOREIGN KEY (document_id) REFERENCES invoice_documents (id),
  CONSTRAINT fk_sale_return_creator FOREIGN KEY (created_by) REFERENCES users (id)
);
