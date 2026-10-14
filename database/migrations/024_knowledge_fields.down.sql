-- Rolls back the structured knowledge columns. The old page-fragment rows are not restored.

DELETE FROM medicine_records;
UPDATE health_observations SET entry_id = NULL;
DELETE FROM knowledge_approvals;
DELETE FROM knowledge_entries;

ALTER TABLE knowledge_entries DROP INDEX uq_knowledge_entry;
ALTER TABLE knowledge_entries
  DROP COLUMN precautions,
  DROP COLUMN schedule_text,
  DROP COLUMN how_to_give,
  DROP COLUMN symptoms,
  DROP COLUMN used_for,
  DROP COLUMN kind;
ALTER TABLE knowledge_entries ADD UNIQUE KEY uq_knowledge_page (source_file, source_page);
