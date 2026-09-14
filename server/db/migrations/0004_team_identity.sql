-- Set the real club identity now the team is confirmed as Saffron Walden
-- Community FC, Girls U9. Additive/backfill only:
-- - Only renames a team still using the "Test Team" seed placeholder.
-- - Only fills age_group where it was never set.
-- No rows are deleted and no existing custom name/age_group is overwritten.

UPDATE team
SET name = 'Saffron Walden Community FC'
WHERE name = 'Test Team';

UPDATE team
SET age_group = 'Girls U9'
WHERE age_group IS NULL;
