-- Farm profile, memberships, explicit grants, and sheds.
-- farm_settings is reserved for owner-approved SOP configuration. Phase 1 does not
-- write dosage, price, tax, or incubation values into it.

CREATE TABLE farms (
  id CHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  code VARCHAR(32) NOT NULL,
  timezone VARCHAR(64) NOT NULL,
  locale ENUM('en', 'hi', 'mr') NOT NULL DEFAULT 'en',
  contact_name VARCHAR(120) NULL,
  contact_phone VARCHAR(32) NULL,
  contact_email VARCHAR(255) NULL,
  address_line VARCHAR(255) NULL,
  weight_unit VARCHAR(16) NOT NULL,
  volume_unit VARCHAR(16) NOT NULL,
  status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
  version INT NOT NULL DEFAULT 1,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_farms_code (code),
  CONSTRAINT fk_farms_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE farm_settings (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  setting_key VARCHAR(64) NOT NULL,
  setting_value JSON NOT NULL,
  updated_by CHAR(36) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_farm_settings_key (farm_id, setting_key),
  CONSTRAINT fk_farm_settings_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_farm_settings_user FOREIGN KEY (updated_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE farm_memberships (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role_id CHAR(36) NOT NULL,
  status ENUM('active', 'revoked') NOT NULL DEFAULT 'active',
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_farm_membership (farm_id, user_id),
  KEY idx_memberships_user (user_id),
  CONSTRAINT fk_memberships_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_memberships_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_memberships_role FOREIGN KEY (role_id) REFERENCES roles (id),
  CONSTRAINT fk_memberships_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE membership_permission_grants (
  membership_id CHAR(36) NOT NULL,
  permission_id CHAR(36) NOT NULL,
  granted_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (membership_id, permission_id),
  CONSTRAINT fk_grants_membership FOREIGN KEY (membership_id) REFERENCES farm_memberships (id),
  CONSTRAINT fk_grants_permission FOREIGN KEY (permission_id) REFERENCES permissions (id),
  CONSTRAINT fk_grants_granted_by FOREIGN KEY (granted_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE sheds (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(120) NOT NULL,
  shed_type VARCHAR(32) NOT NULL,
  usable_capacity INT NOT NULL,
  capacity_unit VARCHAR(32) NOT NULL,
  status ENUM('active', 'inactive', 'maintenance') NOT NULL DEFAULT 'active',
  notes VARCHAR(1000) NULL,
  version INT NOT NULL DEFAULT 1,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_sheds_farm_code (farm_id, code),
  CONSTRAINT chk_sheds_capacity CHECK (usable_capacity >= 0),
  KEY idx_sheds_farm (farm_id),
  CONSTRAINT fk_sheds_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_sheds_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
