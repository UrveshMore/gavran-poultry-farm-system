-- Parentage the farm types. No pairing rule and no coefficient.

INSERT INTO permissions (id, code, description) VALUES
  ('00000000-0000-4000-8000-000000000142', 'breeding.read', 'View parentage notes'),
  ('00000000-0000-4000-8000-000000000143', 'breeding.record', 'Add a parentage note');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
  (r.code = 'owner' AND p.code IN ('breeding.read', 'breeding.record'))
  OR (r.code = 'manager' AND p.code IN ('breeding.read', 'breeding.record'))
  OR (r.code = 'worker' AND p.code IN ('breeding.read', 'breeding.record'))
  OR (r.code = 'vet_advisor' AND p.code = 'breeding.read')
);

CREATE TABLE parentage_records (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  recorded_on DATE NOT NULL,
  offspring_batch_id CHAR(36) NULL,
  sire_note VARCHAR(160) NOT NULL,
  dam_note VARCHAR(160) NOT NULL,
  sire_batch_id CHAR(36) NULL,
  dam_batch_id CHAR(36) NULL,
  note VARCHAR(500) NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_parentage_farm (farm_id, recorded_on),
  CONSTRAINT fk_parentage_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_parentage_offspring FOREIGN KEY (offspring_batch_id) REFERENCES batches (id),
  CONSTRAINT fk_parentage_sire FOREIGN KEY (sire_batch_id) REFERENCES batches (id),
  CONSTRAINT fk_parentage_dam FOREIGN KEY (dam_batch_id) REFERENCES batches (id),
  CONSTRAINT fk_parentage_creator FOREIGN KEY (created_by) REFERENCES users (id)
);
