-- Gavran Saathi. The Gemini key is stored encrypted. Photos keep the model result and the person's correction.
-- A chat draft is not a farm row. Saving still goes through the existing record paths.

CREATE TABLE farm_ai_keys (
  farm_id CHAR(36) NOT NULL,
  cipher_text VARCHAR(2000) NOT NULL,
  nonce VARCHAR(32) NOT NULL,
  auth_tag VARCHAR(32) NOT NULL,
  hint VARCHAR(8) NOT NULL,
  updated_by CHAR(36) NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (farm_id),
  CONSTRAINT fk_ai_key_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_ai_key_user FOREIGN KEY (updated_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE saathi_photos (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  kind VARCHAR(16) NOT NULL,
  stored_name VARCHAR(180) NOT NULL,
  ai_json JSON NOT NULL,
  correction_json JSON NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_saathi_photos_farm (farm_id, created_at),
  CONSTRAINT fk_saathi_photo_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_saathi_photo_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
