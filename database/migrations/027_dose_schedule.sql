-- Chick-day lines copied from the owner's step-by-step PDF. No amount was added.

CREATE TABLE schedule_templates (
  id CHAR(36) NOT NULL,
  code VARCHAR(40) NOT NULL,
  title VARCHAR(160) NOT NULL,
  source_file VARCHAR(180) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_schedule_template_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE schedule_rows (
  id CHAR(36) NOT NULL,
  template_id CHAR(36) NOT NULL,
  day_from INT NULL,
  day_to INT NULL,
  day_label VARCHAR(80) NOT NULL,
  slot ENUM('morning', 'evening', 'full_day') NOT NULL,
  item_name VARCHAR(160) NOT NULL,
  amount_text VARCHAR(500) NOT NULL,
  unclear TINYINT(1) NOT NULL DEFAULT 0,
  source_file VARCHAR(180) NOT NULL,
  source_page INT NOT NULL,
  amount_page INT NULL,
  medicine_keys VARCHAR(200) NOT NULL,
  sort_order INT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_schedule_rows_template (template_id, sort_order),
  CONSTRAINT fk_schedule_rows_template FOREIGN KEY (template_id) REFERENCES schedule_templates (id),
  CONSTRAINT chk_schedule_row_page CHECK (source_page >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE farm_schedule_approvals (
  farm_id CHAR(36) NOT NULL,
  template_id CHAR(36) NOT NULL,
  approved TINYINT(1) NOT NULL,
  verification_note VARCHAR(500) NULL,
  approved_by CHAR(36) NOT NULL,
  approved_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (farm_id, template_id),
  CONSTRAINT fk_sched_appr_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_sched_appr_template FOREIGN KEY (template_id) REFERENCES schedule_templates (id),
  CONSTRAINT fk_sched_appr_user FOREIGN KEY (approved_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE batch_dose_marks (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  batch_id CHAR(36) NOT NULL,
  schedule_row_id CHAR(36) NOT NULL,
  given_on DATE NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_dose_mark (batch_id, schedule_row_id, given_on),
  CONSTRAINT fk_dose_mark_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_dose_mark_batch FOREIGN KEY (batch_id) REFERENCES batches (id),
  CONSTRAINT fk_dose_mark_row FOREIGN KEY (schedule_row_id) REFERENCES schedule_rows (id),
  CONSTRAINT fk_dose_mark_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE medicine_photos (
  id CHAR(36) NOT NULL,
  farm_id CHAR(36) NOT NULL,
  medicine_key VARCHAR(40) NOT NULL,
  stored_name VARCHAR(180) NOT NULL,
  media_type VARCHAR(80) NOT NULL,
  background_removed TINYINT(1) NOT NULL DEFAULT 0,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_medicine_photo (farm_id, medicine_key),
  CONSTRAINT fk_med_photo_farm FOREIGN KEY (farm_id) REFERENCES farms (id),
  CONSTRAINT fk_med_photo_user FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO schedule_templates (id, code, title, source_file) VALUES
  ('00000000-0000-4000-8000-000000000270', 'patil-chick-days', 'Chick days 1 to 21, and the vaccine list', 'patil-poultry-step-by-step-process.pdf');

INSERT INTO schedule_rows
  (id, template_id, day_from, day_to, day_label, slot, item_name, amount_text, unclear, source_file, source_page, amount_page, medicine_keys, sort_order)
VALUES
  ('00000000-0000-4000-8000-000000000271', '00000000-0000-4000-8000-000000000270', 1, 3, 'Day 1, 2, 3', 'morning', 'Electrolyte powder and vinegar', 'For 100 birds: 1 litre water, 1 g electrolyte powder, and 1 ml vinegar.', 0, 'patil-poultry-step-by-step-process.pdf', 17, NULL, 'electrolyte,vinegar', 10),
  ('00000000-0000-4000-8000-000000000272', '00000000-0000-4000-8000-000000000270', 1, 3, 'Day 1, 2, 3', 'evening', 'Limcee and B-complex', '4 litres water, 1 Limcee tablet (vitamin C), and 1 B-complex tablet.', 0, 'patil-poultry-step-by-step-process.pdf', 17, NULL, 'limcee,bcomplex', 20),
  ('00000000-0000-4000-8000-000000000273', '00000000-0000-4000-8000-000000000270', 4, 5, 'Day 4, 5', 'morning', 'Vimeral or Multistar', '1 litre water, 1 ml Vimeral or Multistar.', 0, 'patil-poultry-step-by-step-process.pdf', 18, NULL, 'vimeral', 30),
  ('00000000-0000-4000-8000-000000000274', '00000000-0000-4000-8000-000000000270', 4, 5, 'Day 4, 5', 'evening', 'Enrocin', '1 litre water, 1 ml Enrocin.', 0, 'patil-poultry-step-by-step-process.pdf', 18, NULL, 'enrocin', 40),
  ('00000000-0000-4000-8000-000000000275', '00000000-0000-4000-8000-000000000270', 6, 6, 'Day 6', 'full_day', 'Lasota vaccine', 'One drop in the eye or the nose. This day page names the vaccine. The drop is written on the vaccine list.', 0, 'patil-poultry-step-by-step-process.pdf', 19, 27, 'lasota', 50),
  ('00000000-0000-4000-8000-000000000276', '00000000-0000-4000-8000-000000000270', 7, 9, 'Day 7, 8, 9', 'morning', 'Limcee', '1 litre water, half a Limcee tablet.', 0, 'patil-poultry-step-by-step-process.pdf', 20, NULL, 'limcee', 60),
  ('00000000-0000-4000-8000-000000000277', '00000000-0000-4000-8000-000000000270', 7, 9, 'Day 7, 8, 9', 'evening', 'Brotone liver tonic', '1 litre water, 1 ml Brotone liver tonic.', 0, 'patil-poultry-step-by-step-process.pdf', 20, NULL, 'brotone', 70),
  ('00000000-0000-4000-8000-000000000278', '00000000-0000-4000-8000-000000000270', 10, 11, 'Day 10, 11', 'full_day', 'Vimeral', '1 litre water, 1 ml Vimeral. The page says the whole day.', 0, 'patil-poultry-step-by-step-process.pdf', 21, NULL, 'vimeral', 80),
  ('00000000-0000-4000-8000-000000000279', '00000000-0000-4000-8000-000000000270', 12, 13, 'Day 12, 13', 'morning', 'Toxol', '1 litre water, 1 ml Toxol.', 0, 'patil-poultry-step-by-step-process.pdf', 22, NULL, 'toxol', 90),
  ('00000000-0000-4000-8000-000000000280', '00000000-0000-4000-8000-000000000270', 12, 13, 'Day 12, 13', 'evening', 'E-Care Se', '1 litre water, 2 g E-Care Se.', 0, 'patil-poultry-step-by-step-process.pdf', 22, NULL, 'ecare', 100),
  ('00000000-0000-4000-8000-000000000281', '00000000-0000-4000-8000-000000000270', 14, 14, 'Day 14', 'full_day', 'Gumboro vaccine', 'One drop in the eye or the nose. This day page names the vaccine. The drop is written on the vaccine list.', 0, 'patil-poultry-step-by-step-process.pdf', 23, 27, 'gumboro', 110),
  ('00000000-0000-4000-8000-000000000282', '00000000-0000-4000-8000-000000000270', 15, 17, 'Day 15, 16, 17', 'full_day', 'Enrocin-BH', '1 litre water, 2 ml Enrocin-BH. The page says the whole day.', 0, 'patil-poultry-step-by-step-process.pdf', 24, NULL, 'enrocin', 120),
  ('00000000-0000-4000-8000-000000000283', '00000000-0000-4000-8000-000000000270', 18, 20, 'Day 18, 19, 20', 'morning', 'Toxol', '1 litre water, 2 ml Toxol.', 0, 'patil-poultry-step-by-step-process.pdf', 25, NULL, 'toxol', 130),
  ('00000000-0000-4000-8000-000000000284', '00000000-0000-4000-8000-000000000270', 18, 20, 'Day 18, 19, 20', 'evening', 'Brotone liver tonic', '1 litre water, 2 ml Brotone liver tonic.', 0, 'patil-poultry-step-by-step-process.pdf', 25, NULL, 'brotone', 140),
  ('00000000-0000-4000-8000-000000000285', '00000000-0000-4000-8000-000000000270', 21, 21, 'Day 21', 'full_day', 'Lasota booster', 'One drop in the eye or the nose. This day page names the vaccine. The drop is written on the vaccine list.', 0, 'patil-poultry-step-by-step-process.pdf', 26, 27, 'lasota', 150),
  ('00000000-0000-4000-8000-000000000286', '00000000-0000-4000-8000-000000000270', 1, 1, 'Day 1', 'full_day', 'Marek vaccine', '0.2 ml Marek vaccine.', 0, 'patil-poultry-step-by-step-process.pdf', 27, NULL, 'marek', 15),
  ('00000000-0000-4000-8000-000000000287', '00000000-0000-4000-8000-000000000270', 28, 28, 'Day 28', 'full_day', 'Gumboro booster', 'One drop in the eye or the nose.', 0, 'patil-poultry-step-by-step-process.pdf', 27, NULL, 'gumboro', 160),
  ('00000000-0000-4000-8000-000000000288', '00000000-0000-4000-8000-000000000270', 42, 42, 'Day 42', 'full_day', 'Fowl pox vaccine', '0.2 ml in the wing web or the neck.', 0, 'patil-poultry-step-by-step-process.pdf', 27, NULL, 'fowlpox', 170),
  ('00000000-0000-4000-8000-000000000289', '00000000-0000-4000-8000-000000000270', 56, 56, 'Day 56', 'full_day', 'R2B vaccine', '0.5 ml in the wing web, the neck, or the breast.', 0, 'patil-poultry-step-by-step-process.pdf', 27, NULL, 'r2b', 180),
  ('00000000-0000-4000-8000-000000000290', '00000000-0000-4000-8000-000000000270', NULL, NULL, 'When the bird is 600 g', 'full_day', 'Coryza vaccine', 'Check with the vet. The page says to give a Coryza vaccine when the bird is 600 g. It does not write an amount or a day number.', 1, 'patil-poultry-step-by-step-process.pdf', 27, NULL, 'coryza', 190);
