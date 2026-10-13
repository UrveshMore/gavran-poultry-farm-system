-- Expenses and income the farm types. No tax. No chart of accounts.
-- A correction is a new reversing row. Rows are not edited or deleted.

INSERT INTO permissions (id, code, description) VALUES
  ('00000000-0000-4000-8000-000000000134', 'expense.read', 'View expense and income rows'),
  ('00000000-0000-4000-8000-000000000135', 'expense.record', 'Add a category, an amount, or a reversing entry');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
  (r.code = 'owner' AND p.code IN ('expense.read', 'expense.record'))
  OR (r.code = 'manager' AND p.code IN ('expense.read', 'expense.record'))
);

CREATE TABLE expense_categories (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  name VARCHAR(80) NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_expense_category (farm_id, name),
  CONSTRAINT fk_expense_category_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_expense_category_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE expense_entries (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  occurred_on DATE NOT NULL,
  direction ENUM('expense', 'income') NOT NULL,
  category_id CHAR(36) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  unit_label VARCHAR(32) NOT NULL,
  counterparty VARCHAR(160) NULL,
  reference_note VARCHAR(160) NULL,
  notes VARCHAR(500) NULL,
  batch_id CHAR(36) NULL,
  reverses_entry_id CHAR(36) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_expense_reversal (reverses_entry_id),
  KEY idx_expense_farm (farm_id, occurred_on),
  CONSTRAINT chk_expense_amount CHECK (amount > 0),
  CONSTRAINT fk_expense_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_expense_category FOREIGN KEY (category_id) REFERENCES expense_categories (id),
  CONSTRAINT fk_expense_batch FOREIGN KEY (batch_id) REFERENCES batches (id),
  CONSTRAINT fk_expense_reverses FOREIGN KEY (reverses_entry_id) REFERENCES expense_entries (id),
  CONSTRAINT fk_expense_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
