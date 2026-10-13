-- Feed, water, stock quantities, and owner-typed growth targets.
-- No price is required. No stock value is stored. No feed formula is seeded.

INSERT INTO permissions (id, code, description) VALUES
  ('00000000-0000-4000-8000-000000000123', 'stock.read', 'View stock, water notes, and growth numbers'),
  ('00000000-0000-4000-8000-000000000124', 'stock.record', 'Record a stock movement, water note, or weighing'),
  ('00000000-0000-4000-8000-000000000125', 'stock.manage', 'Add an item name and an owner-typed target weight');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
  (r.code = 'owner' AND p.code IN ('stock.read', 'stock.record', 'stock.manage'))
  OR (r.code = 'manager' AND p.code IN ('stock.read', 'stock.record', 'stock.manage'))
  OR (r.code = 'worker' AND p.code IN ('stock.read', 'stock.record'))
  OR (r.code = 'vet_advisor' AND p.code = 'stock.read')
);

CREATE TABLE stock_items (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  unit_label VARCHAR(32) NOT NULL,
  reorder_level DECIMAL(14,3) NULL,
  notes VARCHAR(500) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_stock_item_name (farm_id, name),
  CONSTRAINT chk_stock_reorder CHECK (reorder_level IS NULL OR reorder_level >= 0),
  CONSTRAINT fk_stock_item_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_stock_item_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE stock_movements (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  item_id CHAR(36) NOT NULL,
  movement_type ENUM('receipt', 'use', 'wastage', 'reversal') NOT NULL,
  direction ENUM('in', 'out') NOT NULL,
  quantity DECIMAL(14,3) NOT NULL,
  occurred_on DATE NOT NULL,
  batch_id CHAR(36) NULL,
  shed_id CHAR(36) NULL,
  lot_code VARCHAR(64) NULL,
  expires_on DATE NULL,
  unit_cost DECIMAL(14,2) NULL,
  supplier_name VARCHAR(160) NULL,
  reason VARCHAR(500) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_stock_movements_item (item_id, occurred_on),
  CONSTRAINT chk_stock_quantity CHECK (quantity > 0),
  CONSTRAINT chk_stock_unit_cost CHECK (unit_cost IS NULL OR unit_cost >= 0),
  CONSTRAINT fk_stock_movement_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_stock_movement_item FOREIGN KEY (item_id) REFERENCES stock_items (id),
  CONSTRAINT fk_stock_movement_batch FOREIGN KEY (batch_id) REFERENCES batches (id),
  CONSTRAINT fk_stock_movement_shed FOREIGN KEY (shed_id) REFERENCES sheds (id),
  CONSTRAINT fk_stock_movement_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE water_records (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  recorded_on DATE NOT NULL,
  batch_id CHAR(36) NULL,
  shed_id CHAR(36) NULL,
  quantity DECIMAL(14,3) NULL,
  unit_label VARCHAR(32) NULL,
  source_note VARCHAR(160) NULL,
  test_note VARCHAR(500) NULL,
  notes VARCHAR(500) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_water_farm (farm_id, recorded_on),
  CONSTRAINT chk_water_quantity CHECK (
    (quantity IS NULL AND unit_label IS NULL) OR (quantity IS NOT NULL AND quantity > 0 AND unit_label IS NOT NULL)
  ),
  CONSTRAINT fk_water_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_water_batch FOREIGN KEY (batch_id) REFERENCES batches (id),
  CONSTRAINT fk_water_shed FOREIGN KEY (shed_id) REFERENCES sheds (id),
  CONSTRAINT fk_water_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE growth_targets (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  bird_type_id CHAR(36) NOT NULL,
  age_days INT NOT NULL,
  target_weight DECIMAL(14,3) NOT NULL,
  weight_unit ENUM('kg', 'g') NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_growth_target (bird_type_id, age_days),
  CONSTRAINT chk_growth_target CHECK (age_days >= 1 AND age_days <= 10000 AND target_weight > 0),
  CONSTRAINT fk_growth_target_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_growth_target_bird FOREIGN KEY (bird_type_id) REFERENCES bird_types (id),
  CONSTRAINT fk_growth_target_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE growth_weighings (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  batch_id CHAR(36) NOT NULL,
  weighed_on DATE NOT NULL,
  age_days INT NULL,
  weight_value DECIMAL(14,3) NOT NULL,
  weight_unit ENUM('kg', 'g') NOT NULL,
  bird_count INT NULL,
  notes VARCHAR(500) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_weighing_batch (batch_id, weighed_on),
  CONSTRAINT chk_weighing CHECK (
    weight_value > 0
    AND (age_days IS NULL OR (age_days >= 1 AND age_days <= 10000))
    AND (bird_count IS NULL OR bird_count >= 1)
  ),
  CONSTRAINT fk_weighing_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_weighing_batch FOREIGN KEY (batch_id) REFERENCES batches (id),
  CONSTRAINT fk_weighing_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
