-- Incubation sittings. Either an incubator or a named broody hen.
-- No hatch day and no candling schedule are stored.

INSERT INTO permissions (id, code, description) VALUES
  ('00000000-0000-4000-8000-000000000117', 'incubation.read', 'View incubation sittings and candling'),
  ('00000000-0000-4000-8000-000000000118', 'incubation.record', 'Record sittings and candling');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
  (r.code = 'owner' AND p.code IN ('incubation.read', 'incubation.record'))
  OR (r.code = 'manager' AND p.code IN ('incubation.read', 'incubation.record'))
  OR (r.code = 'worker' AND p.code IN ('incubation.read', 'incubation.record'))
  OR (r.code = 'vet_advisor' AND p.code = 'incubation.read')
);

CREATE TABLE incubation_batches (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  code VARCHAR(32) NOT NULL,
  mode ENUM('incubator', 'broody_hen') NOT NULL,
  incubator_id CHAR(36) NULL,
  hen_name VARCHAR(80) NULL,
  started_on DATE NOT NULL,
  egg_count INT NOT NULL,
  notes VARCHAR(500) NULL,
  status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_incubation_farm_code (farm_id, code),
  CONSTRAINT chk_incubation_eggs CHECK (egg_count >= 1),
  CONSTRAINT chk_incubation_mode CHECK (
    (mode = 'incubator' AND incubator_id IS NOT NULL AND hen_name IS NULL)
    OR (mode = 'broody_hen' AND incubator_id IS NULL AND hen_name IS NOT NULL)
  ),
  CONSTRAINT fk_incubation_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_incubation_incubator FOREIGN KEY (incubator_id) REFERENCES incubators (id),
  CONSTRAINT fk_incubation_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE candling_records (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  incubation_batch_id CHAR(36) NOT NULL,
  observed_on DATE NOT NULL,
  inspected_count INT NOT NULL,
  notes VARCHAR(500) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_candling_batch (incubation_batch_id, observed_on),
  CONSTRAINT chk_candling_inspected CHECK (inspected_count >= 1),
  CONSTRAINT fk_candling_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_candling_batch FOREIGN KEY (incubation_batch_id) REFERENCES incubation_batches (id),
  CONSTRAINT fk_candling_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE candling_lines (
  id CHAR(36) NOT NULL,
  record_id CHAR(36) NOT NULL,
  label VARCHAR(80) NOT NULL,
  egg_count INT NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT chk_candling_lines_count CHECK (egg_count >= 0),
  CONSTRAINT fk_candling_lines_record FOREIGN KEY (record_id) REFERENCES candling_records (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
