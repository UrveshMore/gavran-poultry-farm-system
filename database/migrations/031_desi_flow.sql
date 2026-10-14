-- Egg lots, incubator trays, hatch days, and birds that left.
-- Quantity and rate on a money row are what the owner typed. Amount stays the stored number.

CREATE TABLE egg_lots (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  source_name VARCHAR(120) NOT NULL,
  received_on DATE NOT NULL,
  egg_count INT NOT NULL,
  notes VARCHAR(500) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_egg_lots_farm (farm_id, received_on),
  CONSTRAINT chk_egg_lot_count CHECK (egg_count > 0),
  CONSTRAINT fk_egg_lot_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_egg_lot_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE incubator_trays (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  incubator_id CHAR(36) NOT NULL,
  name VARCHAR(40) NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_tray_name (incubator_id, name),
  CONSTRAINT fk_tray_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_tray_incubator FOREIGN KEY (incubator_id) REFERENCES incubators (id),
  CONSTRAINT fk_tray_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE tray_sets (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  tray_id CHAR(36) NOT NULL,
  lot_id CHAR(36) NULL,
  set_on DATE NOT NULL,
  egg_count INT NOT NULL,
  status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_tray_sets_farm (farm_id, set_on),
  CONSTRAINT chk_tray_set_count CHECK (egg_count > 0),
  CONSTRAINT fk_tray_set_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_tray_set_tray FOREIGN KEY (tray_id) REFERENCES incubator_trays (id),
  CONSTRAINT fk_tray_set_lot FOREIGN KEY (lot_id) REFERENCES egg_lots (id),
  CONSTRAINT fk_tray_set_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE tray_hatch_days (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  tray_set_id CHAR(36) NOT NULL,
  hatched_on DATE NOT NULL,
  live_count INT NOT NULL,
  batch_id CHAR(36) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_hatch_day (tray_set_id, hatched_on),
  CONSTRAINT chk_hatch_day_live CHECK (live_count >= 0),
  CONSTRAINT fk_hatch_day_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_hatch_day_set FOREIGN KEY (tray_set_id) REFERENCES tray_sets (id),
  CONSTRAINT fk_hatch_day_batch FOREIGN KEY (batch_id) REFERENCES batches (id),
  CONSTRAINT fk_hatch_day_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE bird_events (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  occurred_on DATE NOT NULL,
  kind ENUM('died', 'sold', 'eaten') NOT NULL,
  bird_count INT NOT NULL,
  amount DECIMAL(14,2) NULL,
  unit_label VARCHAR(32) NULL,
  notes VARCHAR(500) NULL,
  batch_id CHAR(36) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_bird_events_farm (farm_id, occurred_on),
  CONSTRAINT chk_bird_event_count CHECK (bird_count > 0),
  CONSTRAINT chk_bird_event_money CHECK (
    (kind = 'sold' AND amount IS NOT NULL AND amount > 0 AND unit_label IS NOT NULL)
    OR (kind <> 'sold' AND amount IS NULL AND unit_label IS NULL)
  ),
  CONSTRAINT fk_bird_event_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_bird_event_batch FOREIGN KEY (batch_id) REFERENCES batches (id),
  CONSTRAINT fk_bird_event_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE expense_entries
  ADD COLUMN quantity DECIMAL(14,3) NULL,
  ADD COLUMN rate DECIMAL(14,2) NULL;
