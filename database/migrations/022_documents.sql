-- File metadata. Bytes live under uploads/ and are not deleted on a schedule.

INSERT INTO permissions (id, code, description) VALUES
  ('00000000-0000-4000-8000-000000000148', 'document.read', 'View farm files'),
  ('00000000-0000-4000-8000-000000000149', 'document.record', 'Store a farm file');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
  (r.code = 'owner' AND p.code IN ('document.read', 'document.record'))
  OR (r.code = 'manager' AND p.code IN ('document.read', 'document.record'))
);

CREATE TABLE farm_files (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  original_name VARCHAR(160) NOT NULL,
  stored_name VARCHAR(80) NOT NULL,
  media_type VARCHAR(80) NOT NULL,
  byte_size INT NOT NULL,
  note VARCHAR(500) NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_farm_file_stored (farm_id, stored_name),
  CONSTRAINT chk_farm_file_size CHECK (byte_size > 0 AND byte_size <= 5242880),
  CONSTRAINT fk_farm_file_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_farm_file_creator FOREIGN KEY (created_by) REFERENCES users (id)
);
