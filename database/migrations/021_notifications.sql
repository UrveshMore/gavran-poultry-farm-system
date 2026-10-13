-- In-app notices the farm writes. No delivery provider and no urgent rule.

INSERT INTO permissions (id, code, description) VALUES
  ('00000000-0000-4000-8000-000000000146', 'notification.read', 'View in-app notices addressed to you'),
  ('00000000-0000-4000-8000-000000000147', 'notification.write', 'Write an in-app notice');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
  (r.code = 'owner' AND p.code IN ('notification.read', 'notification.write'))
  OR (r.code = 'manager' AND p.code IN ('notification.read', 'notification.write'))
  OR (r.code = 'worker' AND p.code = 'notification.read')
  OR (r.code = 'vet_advisor' AND p.code = 'notification.read')
);

CREATE TABLE notifications (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  title VARCHAR(160) NOT NULL,
  body VARCHAR(2000) NOT NULL,
  read_at TIMESTAMP(3) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_notification_user (farm_id, user_id, created_at),
  CONSTRAINT fk_notification_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_notification_creator FOREIGN KEY (created_by) REFERENCES users (id)
);
