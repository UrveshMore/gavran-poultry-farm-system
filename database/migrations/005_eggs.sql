-- Egg counts. Categories are names the farm keeps. No prices.

INSERT INTO permissions (id, code, description) VALUES
  ('00000000-0000-4000-8000-000000000112', 'egg.read', 'View egg collections'),
  ('00000000-0000-4000-8000-000000000113', 'egg.record', 'Record egg collections and sorts');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
  (r.code = 'owner' AND p.code IN ('egg.read', 'egg.record'))
  OR (r.code = 'manager' AND p.code IN ('egg.read', 'egg.record'))
  OR (r.code = 'worker' AND p.code IN ('egg.read', 'egg.record'))
  OR (r.code = 'vet_advisor' AND p.code = 'egg.read')
);

CREATE TABLE egg_categories (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  name VARCHAR(80) NOT NULL,
  status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_egg_categories_farm_name (farm_id, name),
  CONSTRAINT fk_egg_categories_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_egg_categories_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE egg_collections (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  batch_id CHAR(36) NULL,
  shed_id CHAR(36) NULL,
  collected_on DATE NOT NULL,
  shift_label VARCHAR(40) NULL,
  notes VARCHAR(500) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_egg_collections_farm_date (farm_id, collected_on),
  CONSTRAINT fk_egg_collections_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_egg_collections_batch FOREIGN KEY (batch_id) REFERENCES batches (id),
  CONSTRAINT fk_egg_collections_shed FOREIGN KEY (shed_id) REFERENCES sheds (id),
  CONSTRAINT fk_egg_collections_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE egg_collection_lines (
  id CHAR(36) NOT NULL,
  collection_id CHAR(36) NOT NULL,
  category_id CHAR(36) NOT NULL,
  egg_count INT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_egg_lines_collection_category (collection_id, category_id),
  CONSTRAINT chk_egg_lines_count CHECK (egg_count >= 0),
  CONSTRAINT fk_egg_lines_collection FOREIGN KEY (collection_id) REFERENCES egg_collections (id),
  CONSTRAINT fk_egg_lines_category FOREIGN KEY (category_id) REFERENCES egg_categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
