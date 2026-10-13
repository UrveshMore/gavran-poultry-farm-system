-- A name, a note, and a date the farm types. No clock and no outbound delivery.

CREATE TABLE report_schedules (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  note VARCHAR(500) NOT NULL,
  named_on DATE NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_report_schedules_farm (farm_id, named_on),
  CONSTRAINT fk_report_schedule_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_report_schedule_creator FOREIGN KEY (created_by) REFERENCES users (id)
);
