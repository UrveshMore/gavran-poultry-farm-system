-- Report permission only. Figures are calculated when asked. Nothing is stored as an approved formula.

INSERT INTO permissions (id, code, description) VALUES
  ('00000000-0000-4000-8000-000000000136', 'report.read', 'View a date-range report of source rows');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
  (r.code = 'owner' AND p.code = 'report.read')
  OR (r.code = 'manager' AND p.code = 'report.read')
);
