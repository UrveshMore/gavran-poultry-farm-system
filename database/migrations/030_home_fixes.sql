-- Tour flag, phone alert choices, egg purpose, and the date eggs were set.
-- Brooding length is not stored. The screen uses 28 days because the owner asked for that length.

ALTER TABLE users
  ADD COLUMN home_tour_seen_at DATETIME(3) NULL;

CREATE TABLE notification_settings (
  user_id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  morning_on TINYINT(1) NOT NULL DEFAULT 1,
  evening_on TINYINT(1) NOT NULL DEFAULT 1,
  low_stock_on TINYINT(1) NOT NULL DEFAULT 1,
  eggs_on TINYINT(1) NOT NULL DEFAULT 1,
  morning_minute SMALLINT NOT NULL DEFAULT 480,
  evening_minute SMALLINT NOT NULL DEFAULT 1020,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, farm_id),
  CONSTRAINT chk_notify_morning CHECK (morning_minute >= 0 AND morning_minute < 1440),
  CONSTRAINT chk_notify_evening CHECK (evening_minute >= 0 AND evening_minute < 1440),
  CONSTRAINT fk_notify_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_notify_farm FOREIGN KEY (farm_id) REFERENCES farms (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE batches
  ADD COLUMN egg_set_on DATE NULL;

ALTER TABLE egg_categories
  ADD COLUMN purpose ENUM('incubator', 'sale', 'eaten', 'broken') NULL;
