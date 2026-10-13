-- Free-range areas, a strain note the farm types, and rooster/hen counts.
-- No breed catalog and no recommended ratio.

ALTER TABLE bird_types
  ADD COLUMN strain_note VARCHAR(160) NULL AFTER name;

CREATE TABLE range_areas (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  name VARCHAR(80) NOT NULL,
  notes VARCHAR(500) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_range_area_name (farm_id, name),
  CONSTRAINT fk_range_area_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_range_area_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE batch_movements
  MODIFY movement_type ENUM('opening', 'transfer', 'sale', 'mortality', 'culling', 'other_exit', 'to_range', 'from_range') NOT NULL;

ALTER TABLE batch_movements
  ADD COLUMN to_range_area_id CHAR(36) NULL AFTER to_shed_id,
  ADD COLUMN from_range_area_id CHAR(36) NULL AFTER to_range_area_id,
  ADD CONSTRAINT fk_movements_to_range FOREIGN KEY (to_range_area_id) REFERENCES range_areas (id),
  ADD CONSTRAINT fk_movements_from_range FOREIGN KEY (from_range_area_id) REFERENCES range_areas (id);

CREATE TABLE sex_counts (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  batch_id CHAR(36) NULL,
  counted_on DATE NOT NULL,
  rooster_count INT NOT NULL,
  hen_count INT NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_sex_counts_farm (farm_id, counted_on),
  CONSTRAINT chk_sex_counts CHECK (rooster_count >= 0 AND hen_count >= 0),
  CONSTRAINT fk_sex_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_sex_batch FOREIGN KEY (batch_id) REFERENCES batches (id),
  CONSTRAINT fk_sex_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
