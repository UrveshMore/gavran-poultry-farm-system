-- Tasks and seasonal checklist templates. No care steps are seeded.

INSERT INTO permissions (id, code, description) VALUES
  ('00000000-0000-4000-8000-000000000120', 'task.read', 'View tasks and checklist templates'),
  ('00000000-0000-4000-8000-000000000121', 'task.manage', 'Create tasks and edit checklist templates'),
  ('00000000-0000-4000-8000-000000000122', 'task.complete', 'Mark an open task done');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON (
  (r.code = 'owner' AND p.code IN ('task.read', 'task.manage', 'task.complete'))
  OR (r.code = 'manager' AND p.code IN ('task.read', 'task.manage', 'task.complete'))
  OR (r.code = 'worker' AND p.code IN ('task.read', 'task.complete'))
  OR (r.code = 'vet_advisor' AND p.code = 'task.read')
);

CREATE TABLE task_templates (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  season ENUM('summer_heat', 'monsoon', 'winter') NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_task_template_name (farm_id, name),
  UNIQUE KEY uq_task_template_season (farm_id, season),
  CONSTRAINT fk_task_template_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_task_template_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE task_template_steps (
  id CHAR(36) NOT NULL,
  template_id CHAR(36) NOT NULL,
  position INT NOT NULL,
  body VARCHAR(500) NOT NULL,
  status ENUM('active', 'skipped') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_task_template_step (template_id, position),
  CONSTRAINT chk_task_template_step_position CHECK (position >= 1 AND position <= 100),
  CONSTRAINT fk_task_template_step FOREIGN KEY (template_id) REFERENCES task_templates (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE tasks (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  template_id CHAR(36) NULL,
  title VARCHAR(160) NOT NULL,
  instructions VARCHAR(1000) NULL,
  due_on DATE NOT NULL,
  assignee_user_id CHAR(36) NULL,
  proof_required TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('open', 'done') NOT NULL DEFAULT 'open',
  completion_note VARCHAR(500) NULL,
  completed_at TIMESTAMP(3) NULL,
  completed_by CHAR(36) NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_tasks_farm (farm_id, status, due_on),
  CONSTRAINT fk_tasks_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_tasks_template FOREIGN KEY (template_id) REFERENCES task_templates (id),
  CONSTRAINT fk_tasks_assignee FOREIGN KEY (assignee_user_id) REFERENCES users (id),
  CONSTRAINT fk_tasks_completed_by FOREIGN KEY (completed_by) REFERENCES users (id),
  CONSTRAINT fk_tasks_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE task_steps (
  id CHAR(36) NOT NULL,
  task_id CHAR(36) NOT NULL,
  position INT NOT NULL,
  body VARCHAR(500) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_task_step (task_id, position),
  CONSTRAINT chk_task_step_position CHECK (position >= 1 AND position <= 100),
  CONSTRAINT fk_task_step FOREIGN KEY (task_id) REFERENCES tasks (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
