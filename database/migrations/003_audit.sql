-- Append-only audit foundation and idempotency records for critical creates.
-- Normal API routes do not update or delete audit_logs.

CREATE TABLE audit_logs (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NULL,
  actor_user_id CHAR(36) NULL,
  action VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id CHAR(36) NULL,
  request_id CHAR(36) NOT NULL,
  summary JSON NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_audit_farm_created (farm_id, created_at),
  KEY idx_audit_entity (entity_type, entity_id),
  KEY idx_audit_actor (actor_user_id),
  CONSTRAINT fk_audit_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE idempotency_keys (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  farm_id CHAR(36) NULL,
  idempotency_key VARCHAR(80) NOT NULL,
  method VARCHAR(10) NOT NULL,
  path VARCHAR(255) NOT NULL,
  response_status INT NOT NULL,
  response_body JSON NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_idempotency_user_key (user_id, idempotency_key),
  CONSTRAINT fk_idempotency_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_idempotency_farm FOREIGN KEY (farm_id) REFERENCES farms (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
