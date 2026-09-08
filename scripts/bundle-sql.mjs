#!/usr/bin/env node
/**
 * Concatenates every migration and the seed into supabase/full-setup.sql,
 * a single script that can be pasted into the Supabase SQL Editor.
 *
 *   npm run db:bundle
 *
 * This exists for the case where `supabase link` is inconvenient — it needs
 * an interactive login. The bundle is a generated artifact: edit the files
 * in supabase/migrations, never the bundle.
 *
 * Every migration is written to be re-runnable (`create or replace`,
 * `if not exists`, `on conflict do nothing`), so running the bundle twice is
 * harmless.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const migrationsDir = join(process.cwd(), 'supabase', 'migrations')
const names = (await readdir(migrationsDir)).filter((n) => n.endsWith('.sql')).sort()

const parts = [
  `-- =====================================================================
-- full-setup.sql  —  GENERATED FILE, DO NOT EDIT
--
-- Produced by \`npm run db:bundle\` from supabase/migrations/*.sql plus
-- supabase/seed.sql, in that order.
--
-- Paste the whole file into the Supabase SQL Editor and run it. Safe to run
-- more than once.
--
-- Source files, in order:
${names.map((n) => `--   ${n}`).join('\n')}
--   seed.sql
-- =====================================================================
`,
]

for (const name of names) {
  const sql = await readFile(join(migrationsDir, name), 'utf8')
  parts.push(`\n\n-- ###########################################################\n-- ## ${name}\n-- ###########################################################\n\n${sql.trim()}\n`)
}

const seed = await readFile(join(process.cwd(), 'supabase', 'seed.sql'), 'utf8')
parts.push(`\n\n-- ###########################################################\n-- ## seed.sql\n-- ###########################################################\n\n${seed.trim()}\n`)

const out = join(process.cwd(), 'supabase', 'full-setup.sql')
await writeFile(out, parts.join(''), 'utf8')

const lines = parts.join('').split('\n').length
console.log(`Wrote supabase/full-setup.sql (${names.length} migrations + seed, ${lines} lines)`)
