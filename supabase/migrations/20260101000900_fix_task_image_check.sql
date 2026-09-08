-- ---------------------------------------------------------------------
-- Fix chk_tasks_image_url
--
-- Migration 000700 wrote the constraint as
--
--   image_url ~ '^https://[^\s]{3,2000}$'
--
-- PostgreSQL's regex engine caps a bounded repetition at 255, so {3,2000}
-- is rejected — but only when the expression is actually evaluated. The
-- constraint therefore created cleanly and stayed silent while image_url
-- was null (the `is null` branch short-circuits), then failed the first
-- time a URL was written:
--
--   2201B  invalid regular expression: invalid repetition count(s)
--
-- Rewritten with LIKE for the prefix, length() for the bound, and an
-- unbounded character class for the whitespace rule. Same intent, no
-- repetition count: an https:// address or a site-relative path, at most
-- 2000 characters, containing no whitespace — so `javascript:` and `data:`
-- can never reach an <img src>.
-- ---------------------------------------------------------------------

alter table tasks
  drop constraint if exists chk_tasks_image_url;

alter table tasks
  add constraint chk_tasks_image_url check (
    image_url is null
    or (
      length(image_url) between 4 and 2000
      and (image_url like 'https://%' or image_url like '/%')
      and image_url ~ '^[^[:space:]]+$'
    )
  );

notify pgrst, 'reload schema';
