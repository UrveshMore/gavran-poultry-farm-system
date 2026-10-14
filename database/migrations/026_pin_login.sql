-- A worker can sign in with a mobile number and a PIN. Mail and a long secret stay for the owner.

ALTER TABLE users
  MODIFY email VARCHAR(255) NULL,
  MODIFY password_hash VARCHAR(255) NULL,
  ADD COLUMN mobile VARCHAR(16) NULL AFTER email,
  ADD COLUMN pin_hash VARCHAR(255) NULL AFTER password_hash,
  ADD UNIQUE KEY uq_users_mobile (mobile);

INSERT INTO permissions (id, code, description) VALUES
  ('00000000-0000-4000-8000-000000000152', 'pin.reset', 'Set a new sign-in PIN');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
  (r.code = 'owner' AND p.code = 'pin.reset')
  OR (r.code = 'manager' AND p.code = 'pin.reset')
);
