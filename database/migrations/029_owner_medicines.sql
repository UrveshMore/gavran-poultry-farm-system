-- Medicines the owner or a manager typed. These are not rows from the training PDFs.

CREATE TABLE owner_diseases (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  name VARCHAR(180) NOT NULL,
  symptoms VARCHAR(1000) NOT NULL,
  status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_owner_diseases_farm (farm_id, status),
  CONSTRAINT fk_owner_disease_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_owner_disease_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE owner_disease_photos (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  disease_id CHAR(36) NOT NULL,
  stored_name VARCHAR(180) NOT NULL,
  media_type VARCHAR(80) NOT NULL,
  background_removed TINYINT(1) NOT NULL DEFAULT 0,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_owner_disease_photos (disease_id),
  CONSTRAINT fk_owner_dphoto_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_owner_dphoto_disease FOREIGN KEY (disease_id) REFERENCES owner_diseases (id),
  CONSTRAINT fk_owner_dphoto_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE owner_medicines (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  dose_amount VARCHAR(40) NOT NULL,
  dose_unit VARCHAR(40) NOT NULL,
  for_birds INT NULL,
  route ENUM('water', 'feed', 'eye_drop', 'injection') NOT NULL,
  slot ENUM('morning', 'evening', 'full_day') NOT NULL,
  age_day_from INT NULL,
  age_day_to INT NULL,
  duration_days INT NOT NULL,
  notes VARCHAR(1000) NOT NULL,
  precaution VARCHAR(500) NOT NULL,
  source_kind ENUM('experience', 'vet', 'paper') NOT NULL,
  source_detail VARCHAR(160) NOT NULL,
  photo_key VARCHAR(40) NULL,
  photo_name VARCHAR(180) NULL,
  photo_type VARCHAR(80) NULL,
  background_removed TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
  created_by CHAR(36) NOT NULL,
  updated_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_owner_medicine_photo (farm_id, photo_key),
  KEY idx_owner_medicines_farm (farm_id, status),
  CONSTRAINT chk_owner_med_birds CHECK (for_birds IS NULL OR for_birds >= 1),
  CONSTRAINT chk_owner_med_days CHECK (duration_days >= 1 AND duration_days <= 60),
  CONSTRAINT chk_owner_med_age CHECK (age_day_from IS NULL OR age_day_to IS NULL OR age_day_from <= age_day_to),
  CONSTRAINT fk_owner_med_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_owner_med_user FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT fk_owner_med_editor FOREIGN KEY (updated_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE owner_medicine_links (
  id CHAR(36) NOT NULL,
  medicine_id CHAR(36) NOT NULL,
  knowledge_entry_id CHAR(36) NULL,
  owner_disease_id CHAR(36) NULL,
  PRIMARY KEY (id),
  KEY idx_owner_med_links (medicine_id),
  CONSTRAINT chk_owner_med_link CHECK (
    (knowledge_entry_id IS NOT NULL AND owner_disease_id IS NULL)
    OR (knowledge_entry_id IS NULL AND owner_disease_id IS NOT NULL)
  ),
  CONSTRAINT fk_owner_link_med FOREIGN KEY (medicine_id) REFERENCES owner_medicines (id),
  CONSTRAINT fk_owner_link_kb FOREIGN KEY (knowledge_entry_id) REFERENCES knowledge_entries (id),
  CONSTRAINT fk_owner_link_disease FOREIGN KEY (owner_disease_id) REFERENCES owner_diseases (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE owner_batch_plans (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  batch_id CHAR(36) NOT NULL,
  medicine_id CHAR(36) NOT NULL,
  anchor ENUM('date', 'age') NOT NULL,
  start_on DATE NULL,
  start_age_day INT NULL,
  repeat_days INT NOT NULL,
  status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_owner_plans_batch (batch_id, status),
  CONSTRAINT chk_owner_plan_repeat CHECK (repeat_days >= 1 AND repeat_days <= 30),
  CONSTRAINT chk_owner_plan_anchor CHECK (
    (anchor = 'date' AND start_on IS NOT NULL AND start_age_day IS NULL)
    OR (anchor = 'age' AND start_age_day IS NOT NULL AND start_on IS NULL)
  ),
  CONSTRAINT fk_owner_plan_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_owner_plan_batch FOREIGN KEY (batch_id) REFERENCES batches (id),
  CONSTRAINT fk_owner_plan_med FOREIGN KEY (medicine_id) REFERENCES owner_medicines (id),
  CONSTRAINT fk_owner_plan_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE owner_dose_marks (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  batch_id CHAR(36) NOT NULL,
  plan_id CHAR(36) NOT NULL,
  given_on DATE NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_owner_dose_mark (plan_id, given_on),
  CONSTRAINT fk_owner_mark_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_owner_mark_batch FOREIGN KEY (batch_id) REFERENCES batches (id),
  CONSTRAINT fk_owner_mark_plan FOREIGN KEY (plan_id) REFERENCES owner_batch_plans (id),
  CONSTRAINT fk_owner_mark_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
