-- Loss notes the farm writes. No predator list. No mortality-rate column.

INSERT INTO permissions (id, code, description) VALUES
  ('00000000-0000-4000-8000-000000000130', 'loss.read', 'View loss notes'),
  ('00000000-0000-4000-8000-000000000131', 'loss.record', 'Write a loss note');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
  (r.code = 'owner' AND p.code IN ('loss.read', 'loss.record'))
  OR (r.code = 'manager' AND p.code IN ('loss.read', 'loss.record'))
  OR (r.code = 'worker' AND p.code IN ('loss.read', 'loss.record'))
  OR (r.code = 'vet_advisor' AND p.code = 'loss.read')
);

CREATE TABLE loss_incidents (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  occurred_on DATE NOT NULL,
  bird_count INT NOT NULL,
  note VARCHAR(1000) NOT NULL,
  movement_id CHAR(36) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_loss_farm (farm_id, occurred_on),
  CONSTRAINT chk_loss_count CHECK (bird_count >= 0),
  CONSTRAINT fk_loss_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_loss_movement FOREIGN KEY (movement_id) REFERENCES batch_movements (id),
  CONSTRAINT fk_loss_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
