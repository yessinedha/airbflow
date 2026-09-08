#!/usr/bin/env node
/**
 * Parses every migration and the seed file with the real PostgreSQL
 * grammar (libpg_query) so syntax errors are caught before they reach a
 * live database, then runs a few lint rules the parser cannot express.
 *
 * Run with:
 *
 *   npm run db:check
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const files = []
const migrationsDir = join(process.cwd(), 'supabase', 'migrations')

for (const name of (await readdir(migrationsDir)).sort()) {
  if (name.endsWith('.sql')) files.push(join(migrationsDir, name))
}
files.push(join(process.cwd(), 'supabase', 'seed.sql'))

let parse
try {
  const mod = await import('libpg-query')
  parse = mod.parse ?? mod.default?.parse
  if (mod.loadModule) await mod.loadModule()
} catch {
  console.error('libpg-query is not installed. Run: npm install')
  process.exit(2)
}


/**
 * Lint: bounded regex repetitions above PostgreSQL's limit.
 *
 * PostgreSQL caps `{n,m}` at 255. A larger bound is not rejected when the
 * constraint or function is created — it only blows up as
 * `2201B invalid regular expression: invalid repetition count(s)` the
 * first time the expression is actually evaluated, which can be days
 * later and on production data.
 *
 * Learned the hard way from chk_tasks_image_url, which carried {3,2000}
 * and stayed silent until the first image URL was written.
 */
const PG_MAX_REPETITION = 255

/**
 * Blanks out `--` line comments and block comments, preserving line
 * numbering, so a broken pattern quoted in a header comment is not
 * reported as a real one.
 */
function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/--[^\n]*/g, (line) => ' '.repeat(line.length))
}

function lintRepetitions(sql, fileName) {
  const problems = []
  const lines = stripSqlComments(sql).split(/\r?\n/)

  lines.forEach((line, index) => {
    for (const match of line.matchAll(/\{\s*(\d+)\s*(?:,\s*(\d*)\s*)?\}/g)) {
      const upper = match[2] === undefined || match[2] === '' ? Number(match[1]) : Number(match[2])
      if (Number.isFinite(upper) && upper > PG_MAX_REPETITION) {
        problems.push(
          `${fileName}:${index + 1}  ${match[0]} exceeds PostgreSQL's ${PG_MAX_REPETITION} repetition limit` +
            ` — use an unbounded quantifier plus a length() check instead`,
        )
      }
    }
  })

  return problems
}

let failures = 0
const lintProblems = []
for (const file of files) {
  const sql = await readFile(file, 'utf8')
  try {
    const result = await parse(sql)
    const count = result?.stmts?.length ?? 0
    const name = file.split(/[\\/]/).pop()
    lintProblems.push(...lintRepetitions(sql, name))
    console.log(`ok    ${name}  (${count} statements)`)
  } catch (err) {
    failures++
    console.error(`FAIL  ${file.split(/[\\/]/).pop()}`)
    console.error(`      ${err?.message ?? err}`)
  }
}

if (failures > 0) {
  console.error(`\n${failures} file(s) failed to parse.`)
  process.exit(1)
}

if (lintProblems.length > 0) {
  console.error(`\n${lintProblems.length} lint problem(s):`)
  for (const problem of lintProblems) console.error(`      ${problem}`)
  process.exit(1)
}

console.log('\nAll SQL files parsed and linted successfully.')
