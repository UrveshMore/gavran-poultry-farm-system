-- Flow-3 batches, sheds, eggs, feed, and hisaab. Old tables stay.
-- Hatch length and the move reminder are stored as the lengths asked for on this branch.

CREATE TABLE flow_incubators (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  capacity INT NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_flow_incubators_farm (farm_id, name),
  CONSTRAINT chk_flow_incubator_capacity CHECK (capacity > 0),
  CONSTRAINT fk_flow_incubator_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_flow_incubator_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE flow_sheds (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  capacity INT NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_flow_sheds_farm (farm_id, name),
  CONSTRAINT chk_flow_shed_capacity CHECK (capacity > 0),
  CONSTRAINT fk_flow_shed_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_flow_shed_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE flow_batches (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  batch_number INT NOT NULL,
  incubator_id CHAR(36) NULL,
  eggs_set INT NULL,
  set_on DATE NULL,
  hatch_on DATE NULL,
  notes VARCHAR(500) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_flow_batch_number (farm_id, batch_number),
  CONSTRAINT chk_flow_batch_number CHECK (batch_number >= 0),
  CONSTRAINT chk_flow_batch_eggs CHECK (eggs_set IS NULL OR eggs_set > 0),
  CONSTRAINT fk_flow_batch_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_flow_batch_incubator FOREIGN KEY (incubator_id) REFERENCES flow_incubators (id),
  CONSTRAINT fk_flow_batch_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE flow_hatch_days (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  batch_id CHAR(36) NOT NULL,
  day_number INT NOT NULL,
  live_count INT NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_flow_hatch_day (batch_id, day_number),
  CONSTRAINT chk_flow_hatch_day CHECK (day_number > 0 AND live_count >= 0),
  CONSTRAINT fk_flow_hatch_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_flow_hatch_batch FOREIGN KEY (batch_id) REFERENCES flow_batches (id),
  CONSTRAINT fk_flow_hatch_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE flow_moves (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  batch_id CHAR(36) NOT NULL,
  kind ENUM('opening', 'brooding_death', 'to_shed', 'between_sheds', 'exit') NOT NULL,
  bird_count INT NOT NULL,
  occurred_on DATE NOT NULL,
  shed_id CHAR(36) NULL,
  from_shed_id CHAR(36) NULL,
  reason ENUM('died', 'sold', 'other') NULL,
  notes VARCHAR(500) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_flow_moves_batch (batch_id, occurred_on),
  CONSTRAINT chk_flow_move_count CHECK (bird_count > 0),
  CONSTRAINT fk_flow_move_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_flow_move_batch FOREIGN KEY (batch_id) REFERENCES flow_batches (id),
  CONSTRAINT fk_flow_move_shed FOREIGN KEY (shed_id) REFERENCES flow_sheds (id),
  CONSTRAINT fk_flow_move_from_shed FOREIGN KEY (from_shed_id) REFERENCES flow_sheds (id),
  CONSTRAINT fk_flow_move_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE flow_dose_marks (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  batch_id CHAR(36) NOT NULL,
  schedule_row_id CHAR(36) NOT NULL,
  given_on DATE NOT NULL,
  notes VARCHAR(500) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_flow_dose_mark (batch_id, schedule_row_id),
  CONSTRAINT fk_flow_dose_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_flow_dose_batch FOREIGN KEY (batch_id) REFERENCES flow_batches (id),
  CONSTRAINT fk_flow_dose_row FOREIGN KEY (schedule_row_id) REFERENCES schedule_rows (id),
  CONSTRAINT fk_flow_dose_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE flow_feed_entries (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  batch_id CHAR(36) NOT NULL,
  occurred_on DATE NOT NULL,
  age_day INT NULL,
  season_label VARCHAR(40) NOT NULL,
  feed_type VARCHAR(120) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit_label VARCHAR(32) NOT NULL,
  notes VARCHAR(500) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_flow_feed_farm (farm_id, occurred_on),
  CONSTRAINT chk_flow_feed_qty CHECK (quantity > 0),
  CONSTRAINT fk_flow_feed_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_flow_feed_batch FOREIGN KEY (batch_id) REFERENCES flow_batches (id),
  CONSTRAINT fk_flow_feed_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE flow_egg_entries (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  occurred_on DATE NOT NULL,
  collected INT NOT NULL,
  sold INT NOT NULL,
  for_incubator INT NOT NULL,
  notes VARCHAR(500) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_flow_eggs_farm (farm_id, occurred_on),
  CONSTRAINT chk_flow_eggs_nonneg CHECK (collected >= 0 AND sold >= 0 AND for_incubator >= 0),
  CONSTRAINT fk_flow_eggs_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_flow_eggs_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE flow_expenses (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  occurred_on DATE NOT NULL,
  category ENUM('feed', 'medicine', 'electricity', 'other') NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  unit_label VARCHAR(32) NOT NULL,
  notes VARCHAR(500) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_flow_expenses_farm (farm_id, occurred_on),
  CONSTRAINT chk_flow_expense_amount CHECK (amount >= 0),
  CONSTRAINT fk_flow_expense_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_flow_expense_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE flow_sales (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  occurred_on DATE NOT NULL,
  kind ENUM('eggs', 'birds') NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  price DECIMAL(14,2) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  buyer VARCHAR(120) NOT NULL,
  unit_label VARCHAR(32) NOT NULL,
  batch_id CHAR(36) NULL,
  move_id CHAR(36) NULL,
  notes VARCHAR(500) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_flow_sale_move (move_id),
  KEY idx_flow_sales_farm (farm_id, occurred_on),
  CONSTRAINT chk_flow_sale_qty CHECK (quantity > 0 AND price >= 0 AND amount >= 0),
  CONSTRAINT fk_flow_sale_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_flow_sale_batch FOREIGN KEY (batch_id) REFERENCES flow_batches (id),
  CONSTRAINT fk_flow_sale_move FOREIGN KEY (move_id) REFERENCES flow_moves (id),
  CONSTRAINT fk_flow_sale_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE flow_setup (
  farm_id CHAR(36) NOT NULL,
  batch0_skipped TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (farm_id),
  CONSTRAINT fk_flow_setup_farm FOREIGN KEY (farm_id) REFERENCES farms (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
