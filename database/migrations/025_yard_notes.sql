-- Yard notebook: let-out, shut-in, and a free note. No clock is suggested. No predator list.

INSERT INTO permissions (id, code, description) VALUES
  ('00000000-0000-4000-8000-000000000150', 'yard.read', 'View yard notes'),
  ('00000000-0000-4000-8000-000000000151', 'yard.record', 'Write a yard note');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
  (r.code = 'owner' AND p.code IN ('yard.read', 'yard.record'))
  OR (r.code = 'manager' AND p.code IN ('yard.read', 'yard.record'))
  OR (r.code = 'worker' AND p.code IN ('yard.read', 'yard.record'))
);

CREATE TABLE yard_notes (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  noted_on DATE NOT NULL,
  kind ENUM('note', 'let_out', 'shut_in') NOT NULL,
  noted_time TIME NULL,
  body VARCHAR(1000) NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_yard_farm (farm_id, noted_on),
  CONSTRAINT fk_yard_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_yard_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
