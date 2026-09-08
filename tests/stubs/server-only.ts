/**
 * Stand-in for the `server-only` package under Vitest.
 *
 * In a Next.js build that import is a marker that makes the bundler fail if
 * a module ever reaches a client bundle. Tests run in plain Node, where the
 * marker has nothing to assert, so it resolves to this empty module.
 */
export {}
