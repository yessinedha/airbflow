-- ---------------------------------------------------------------------
-- Task images
--
-- Adds an illustration to each verification task. The column holds a URL,
-- which may point either at the Supabase Storage bucket created below or
-- at any external image the operator prefers.
--
-- The image is decoration for the member's benefit. Nothing in the reward
-- calculation, the timer or the claim path reads it.
-- ---------------------------------------------------------------------

alter table tasks
  add column if not exists image_url text;

comment on column tasks.image_url is
  'Optional illustration shown on the task card. Decorative only: no business rule reads it.';

-- Reject anything that is not an absolute https URL or a site-relative path.
-- This keeps `javascript:` and `data:` out of an <img src> even if the admin
-- form were bypassed.
--
-- Written with LIKE and length() rather than a bounded regex repetition:
-- PostgreSQL caps a repetition count at 255, and a larger bound only fails
-- when the expression is first evaluated, not when it is created. Migration
-- 20260101000900 repairs databases where the earlier version was applied.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_tasks_image_url'
  ) then
    alter table tasks
      add constraint chk_tasks_image_url check (
        image_url is null
        or (
          length(image_url) between 4 and 2000
          and (image_url like 'https://%' or image_url like '/%')
          and image_url ~ '^[^[:space:]]+$'
        )
      );
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Storage bucket
--
-- Public read so an <img> tag needs no signed URL; writes are restricted
-- to admins by the policies below. The whole block is tolerant: on a
-- Postgres role without rights over the storage schema it emits a notice
-- instead of failing the migration, and the URL field still works.
-- ---------------------------------------------------------------------
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'task-images',
    'task-images',
    true,
    2097152,                                            -- 2 MB
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  )
  on conflict (id) do update
    set public             = excluded.public,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- Anyone may read: the bucket is public and holds nothing sensitive.
  drop policy if exists task_images_read on storage.objects;
  create policy task_images_read on storage.objects
    for select to public
    using (bucket_id = 'task-images');

  -- Only admins may add, replace or delete an illustration.
  drop policy if exists task_images_insert on storage.objects;
  create policy task_images_insert on storage.objects
    for insert to authenticated
    with check (bucket_id = 'task-images' and is_admin(auth.uid()));

  drop policy if exists task_images_update on storage.objects;
  create policy task_images_update on storage.objects
    for update to authenticated
    using (bucket_id = 'task-images' and is_admin(auth.uid()))
    with check (bucket_id = 'task-images' and is_admin(auth.uid()));

  drop policy if exists task_images_delete on storage.objects;
  create policy task_images_delete on storage.objects
    for delete to authenticated
    using (bucket_id = 'task-images' and is_admin(auth.uid()));

exception
  when insufficient_privilege or undefined_table then
    raise notice
      'Storage bucket task-images was not configured (%). Create it in the Supabase dashboard, or keep using external image URLs.',
      sqlerrm;
end $$;
