DELETE FROM role_permissions WHERE permission_id = '00000000-0000-4000-8000-000000000152';
DELETE FROM permissions WHERE id = '00000000-0000-4000-8000-000000000152';

UPDATE users SET email = CONCAT('restored-', REPLACE(id, '-', '')) WHERE email IS NULL;
UPDATE users SET password_hash = 'restored' WHERE password_hash IS NULL;

ALTER TABLE users DROP INDEX uq_users_mobile;
ALTER TABLE users DROP COLUMN mobile, DROP COLUMN pin_hash;
ALTER TABLE users
  MODIFY email VARCHAR(255) NOT NULL,
  MODIFY password_hash VARCHAR(255) NOT NULL;
