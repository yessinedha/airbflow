-- ---------------------------------------------------------------------
-- Task images — safety net and PostgREST cache reload
--
-- After a column is added, PostgREST keeps serving its cached schema and
-- rejects writes to the new column with:
--
--   PGRST204  Could not find the 'image_url' column of 'tasks'
--             in the schema cache
--
-- which looks exactly like a broken feature. The NOTIFY below tells
-- PostgREST to reload immediately.
--
-- The ALTER is repeated defensively: it is a no-op when 000700 already
-- ran, and it repairs the column if that migration was skipped or only
-- partly applied. Both statements are safe to run any number of times.
-- ---------------------------------------------------------------------

alter table tasks
  add column if not exists image_url text;

notify pgrst, 'reload schema';
