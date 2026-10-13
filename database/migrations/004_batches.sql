-- Batch ledger. Live counts are derived from movements. No prices or medicine.

INSERT INTO permissions (id, code, description) VALUES
  ('00000000-0000-4000-8000-000000000109', 'batch.read', 'View batches and bird counts'),
  ('00000000-0000-4000-8000-000000000110', 'batch.create', 'Create bird types and batches'),
  ('00000000-0000-4000-8000-000000000111', 'movement.create', 'Record batch movements');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
  (r.code = 'owner' AND p.code IN ('batch.read', 'batch.create', 'movement.create'))
  OR (r.code = 'manager' AND p.code IN ('batch.read', 'batch.create', 'movement.create'))
  OR (r.code = 'worker' AND p.code = 'batch.read')
  OR (r.code = 'vet_advisor' AND p.code = 'batch.read')
);

CREATE TABLE bird_types (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  name VARCHAR(80) NOT NULL,
  status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_bird_types_farm_name (farm_id, name),
  CONSTRAINT fk_bird_types_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_bird_types_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE batches (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  code VARCHAR(32) NOT NULL,
  bird_type_id CHAR(36) NOT NULL,
  source_note VARCHAR(255) NULL,
  hatch_date DATE NULL,
  opened_on DATE NOT NULL,
  status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
  version INT NOT NULL DEFAULT 1,
  created_by CHAR(36) NOT NULL,
  closed_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_batches_farm_code (farm_id, code),
  KEY idx_batches_farm (farm_id),
  CONSTRAINT fk_batches_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_batches_bird_type FOREIGN KEY (bird_type_id) REFERENCES bird_types (id),
  CONSTRAINT fk_batches_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE batch_movements (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  batch_id CHAR(36) NOT NULL,
  movement_type ENUM('opening', 'transfer', 'sale', 'mortality', 'culling', 'other_exit') NOT NULL,
  from_shed_id CHAR(36) NULL,
  to_shed_id CHAR(36) NULL,
  bird_count INT NOT NULL,
  occurred_on DATE NOT NULL,
  reason VARCHAR(255) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_movements_batch (batch_id, occurred_on),
  KEY idx_movements_farm (farm_id),
  CONSTRAINT chk_movements_count CHECK (bird_count > 0),
  CONSTRAINT fk_movements_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_movements_batch FOREIGN KEY (batch_id) REFERENCES batches (id),
  CONSTRAINT fk_movements_from_shed FOREIGN KEY (from_shed_id) REFERENCES sheds (id),
  CONSTRAINT fk_movements_to_shed FOREIGN KEY (to_shed_id) REFERENCES sheds (id),
  CONSTRAINT fk_movements_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
