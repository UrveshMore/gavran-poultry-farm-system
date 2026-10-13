DROP TABLE IF EXISTS sex_counts;

DELETE FROM batch_movements
WHERE movement_type IN ('to_range', 'from_range')
   OR (from_shed_id IS NULL AND to_shed_id IS NULL);

ALTER TABLE batch_movements DROP FOREIGN KEY fk_movements_to_range;
ALTER TABLE batch_movements DROP FOREIGN KEY fk_movements_from_range;
ALTER TABLE batch_movements
  DROP COLUMN from_range_area_id,
  DROP COLUMN to_range_area_id;

ALTER TABLE batch_movements
  MODIFY movement_type ENUM('opening', 'transfer', 'sale', 'mortality', 'culling', 'other_exit') NOT NULL;

DROP TABLE IF EXISTS range_areas;

ALTER TABLE bird_types DROP COLUMN strain_note;
