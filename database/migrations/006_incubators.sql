-- Incubator equipment. Temperature and humidity are readings the farm types.
-- There is no set-point and no default.

INSERT INTO permissions (id, code, description) VALUES
  ('00000000-0000-4000-8000-000000000114', 'incubator.read', 'View incubators and readings'),
  ('00000000-0000-4000-8000-000000000115', 'incubator.record', 'Record incubator readings'),
  ('00000000-0000-4000-8000-000000000116', 'incubator.manage', 'Add incubators and change service status');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
  (r.code = 'owner' AND p.code IN ('incubator.read', 'incubator.record', 'incubator.manage'))
  OR (r.code = 'manager' AND p.code IN ('incubator.read', 'incubator.record', 'incubator.manage'))
  OR (r.code = 'worker' AND p.code IN ('incubator.read', 'incubator.record'))
  OR (r.code = 'vet_advisor' AND p.code = 'incubator.read')
);

CREATE TABLE incubators (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(120) NOT NULL,
  capacity_eggs INT NULL,
  status ENUM('in_service', 'out_of_service') NOT NULL DEFAULT 'in_service',
  notes VARCHAR(500) NULL,
  version INT NOT NULL DEFAULT 1,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_incubators_farm_code (farm_id, code),
  CONSTRAINT chk_incubators_capacity CHECK (capacity_eggs IS NULL OR capacity_eggs >= 0),
  CONSTRAINT fk_incubators_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_incubators_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE incubator_readings (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  incubator_id CHAR(36) NOT NULL,
  recorded_on DATE NOT NULL,
  recorded_time TIME NULL,
  temperature_value DECIMAL(8,2) NULL,
  temperature_unit VARCHAR(16) NULL,
  humidity_value DECIMAL(8,2) NULL,
  humidity_unit VARCHAR(16) NULL,
  power_status ENUM('on', 'off', 'unknown') NOT NULL DEFAULT 'unknown',
  source ENUM('manual', 'sensor') NOT NULL DEFAULT 'manual',
  notes VARCHAR(500) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_incubator_readings_incubator (incubator_id, recorded_on),
  CONSTRAINT fk_incubator_readings_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_incubator_readings_incubator FOREIGN KEY (incubator_id) REFERENCES incubators (id),
  CONSTRAINT fk_incubator_readings_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE incubator_maintenance (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  incubator_id CHAR(36) NOT NULL,
  occurred_on DATE NOT NULL,
  status ENUM('in_service', 'out_of_service') NOT NULL,
  notes VARCHAR(500) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_incubator_maintenance_incubator (incubator_id, occurred_on),
  CONSTRAINT fk_incubator_maintenance_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_incubator_maintenance_incubator FOREIGN KEY (incubator_id) REFERENCES incubators (id),
  CONSTRAINT fk_incubator_maintenance_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
