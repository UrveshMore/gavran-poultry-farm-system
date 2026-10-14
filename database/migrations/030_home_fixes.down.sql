ALTER TABLE egg_categories DROP COLUMN purpose;
ALTER TABLE batches DROP COLUMN egg_set_on;
DROP TABLE IF EXISTS notification_settings;
ALTER TABLE users DROP COLUMN home_tour_seen_at;
