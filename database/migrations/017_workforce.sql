-- Attendance rows and training the farm writes. No score. No course catalog.

INSERT INTO permissions (id, code, description) VALUES
  ('00000000-0000-4000-8000-000000000137', 'attendance.read', 'View attendance rows'),
  ('00000000-0000-4000-8000-000000000138', 'attendance.record', 'Add an attendance row'),
  ('00000000-0000-4000-8000-000000000139', 'training.read', 'View training items and assignments'),
  ('00000000-0000-4000-8000-000000000140', 'training.manage', 'Add training items, assignments, and task links'),
  ('00000000-0000-4000-8000-000000000141', 'training.complete', 'Mark an assigned training item finished');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
  (r.code = 'owner' AND p.code IN ('attendance.read', 'attendance.record', 'training.read', 'training.manage', 'training.complete'))
  OR (r.code = 'manager' AND p.code IN ('attendance.read', 'attendance.record', 'training.read', 'training.manage', 'training.complete'))
  OR (r.code = 'worker' AND p.code IN ('attendance.read', 'attendance.record', 'training.read', 'training.complete'))
);

CREATE TABLE attendance_records (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  attended_on DATE NOT NULL,
  attended_time CHAR(5) NULL,
  method_label VARCHAR(80) NOT NULL,
  note VARCHAR(500) NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_attendance_farm (farm_id, attended_on),
  CONSTRAINT fk_attendance_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_attendance_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_attendance_creator FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE TABLE training_items (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  title VARCHAR(160) NOT NULL,
  body VARCHAR(4000) NOT NULL,
  version_label VARCHAR(40) NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_training_item (farm_id, title, version_label),
  CONSTRAINT fk_training_item_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_training_item_creator FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE TABLE training_assignments (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  item_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  due_on DATE NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_training_assignment (item_id, user_id),
  CONSTRAINT fk_assignment_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_assignment_item FOREIGN KEY (item_id) REFERENCES training_items (id),
  CONSTRAINT fk_assignment_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_assignment_creator FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE TABLE training_completions (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  assignment_id CHAR(36) NOT NULL,
  note VARCHAR(500) NOT NULL,
  completed_by CHAR(36) NOT NULL,
  completed_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_training_completion (assignment_id),
  CONSTRAINT fk_completion_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_completion_assignment FOREIGN KEY (assignment_id) REFERENCES training_assignments (id),
  CONSTRAINT fk_completion_user FOREIGN KEY (completed_by) REFERENCES users (id)
);

CREATE TABLE task_training_requirements (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  task_id CHAR(36) NOT NULL,
  item_id CHAR(36) NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_task_training (task_id, item_id),
  CONSTRAINT fk_task_training_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_task_training_task FOREIGN KEY (task_id) REFERENCES tasks (id),
  CONSTRAINT fk_task_training_item FOREIGN KEY (item_id) REFERENCES training_items (id),
  CONSTRAINT fk_task_training_creator FOREIGN KEY (created_by) REFERENCES users (id)
);
