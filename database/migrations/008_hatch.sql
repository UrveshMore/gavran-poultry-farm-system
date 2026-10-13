-- Hatch records. The rate formula is not stored as an approved rule.

INSERT INTO permissions (id, code, description) VALUES
  ('00000000-0000-4000-8000-000000000119', 'hatch.record', 'Record a hatch and open a chick batch');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
  (r.code = 'owner' AND p.code = 'hatch.record')
  OR (r.code = 'manager' AND p.code = 'hatch.record')
  OR (r.code = 'worker' AND p.code = 'hatch.record')
);

CREATE TABLE hatch_records (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  incubation_batch_id CHAR(36) NOT NULL,
  hatched_on DATE NOT NULL,
  eggs_set INT NOT NULL,
  live_chicks INT NOT NULL,
  losses INT NOT NULL,
  other_count INT NOT NULL,
  difference_note VARCHAR(500) NULL,
  chick_batch_id CHAR(36) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_hatch_sitting (incubation_batch_id, hatched_on),
  CONSTRAINT chk_hatch_counts CHECK (eggs_set >= 0 AND live_chicks >= 0 AND losses >= 0 AND other_count >= 0),
  CONSTRAINT fk_hatch_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_hatch_sitting FOREIGN KEY (incubation_batch_id) REFERENCES incubation_batches (id),
  CONSTRAINT fk_hatch_batch FOREIGN KEY (chick_batch_id) REFERENCES batches (id),
  CONSTRAINT fk_hatch_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
