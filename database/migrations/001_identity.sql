-- Identity, roles, and sessions. Reference data for roles is seeded here.
-- Password reset tokens are stored for a later delivery channel. No email or SMS
-- provider is configured in Phase 1.

CREATE TABLE users (
  id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('active', 'deactivated') NOT NULL DEFAULT 'active',
  preferred_locale ENUM('en', 'hi', 'mr') NOT NULL DEFAULT 'en',
  platform_role ENUM('system_administrator') NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE roles (
  id CHAR(36) NOT NULL,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500) NOT NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE permissions (
  id CHAR(36) NOT NULL,
  code VARCHAR(64) NOT NULL,
  description VARCHAR(500) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE role_permissions (
  role_id CHAR(36) NOT NULL,
  permission_id CHAR(36) NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles (id),
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE sessions (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  refresh_token_hash CHAR(64) NOT NULL,
  family_id CHAR(36) NOT NULL,
  user_agent VARCHAR(255) NULL,
  ip_address VARCHAR(64) NULL,
  expires_at TIMESTAMP(3) NOT NULL,
  revoked_at TIMESTAMP(3) NULL,
  replaced_by CHAR(36) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_refresh_hash (refresh_token_hash),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_family (family_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE password_reset_tokens (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMP(3) NOT NULL,
  used_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_password_reset_hash (token_hash),
  KEY idx_password_reset_user (user_id),
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO roles (id, code, name, description, is_system) VALUES
  ('00000000-0000-4000-8000-000000000001', 'owner', 'Owner', 'Full farm operations, people, and configuration for one farm.', 1),
  ('00000000-0000-4000-8000-000000000002', 'manager', 'Manager', 'Operational farm setup and records. No user administration in Phase 1.', 1),
  ('00000000-0000-4000-8000-000000000003', 'worker', 'Worker', 'Read farm and shed information needed for later data capture.', 1),
  ('00000000-0000-4000-8000-000000000004', 'family_helper', 'Family helper', 'No access unless the owner grants individual permissions.', 1),
  ('00000000-0000-4000-8000-000000000005', 'vet_advisor', 'Vet / advisor', 'Read farm and shed context. Health advice workflows are later.', 1),
  ('00000000-0000-4000-8000-000000000006', 'system_administrator', 'System administrator', 'Technical role. No farm business permissions.', 1);

INSERT INTO permissions (id, code, description) VALUES
  ('00000000-0000-4000-8000-000000000101', 'farm.read', 'View farm profile'),
  ('00000000-0000-4000-8000-000000000102', 'farm.update', 'Update farm profile'),
  ('00000000-0000-4000-8000-000000000103', 'shed.read', 'View sheds'),
  ('00000000-0000-4000-8000-000000000104', 'shed.create', 'Create sheds'),
  ('00000000-0000-4000-8000-000000000105', 'shed.update', 'Update sheds'),
  ('00000000-0000-4000-8000-000000000106', 'user.read', 'View farm members'),
  ('00000000-0000-4000-8000-000000000107', 'user.manage', 'Invite, change, and revoke farm access'),
  ('00000000-0000-4000-8000-000000000108', 'audit.read', 'View the farm activity log');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
  r.code = 'owner'
  OR (r.code = 'manager' AND p.code IN ('farm.read', 'shed.read', 'shed.create', 'shed.update', 'user.read', 'audit.read'))
  OR (r.code = 'worker' AND p.code IN ('farm.read', 'shed.read'))
  OR (r.code = 'vet_advisor' AND p.code IN ('farm.read', 'shed.read'))
);
