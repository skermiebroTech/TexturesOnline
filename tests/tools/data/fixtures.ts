import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Directory holding the research fixtures (real game jars, Bedrock samples, version lists).
 * Set TO_FIXTURES to point at it; otherwise the build machine's scratch area is searched.
 * Tests that need a fixture skip themselves when it is missing.
 */
export function fixturesDir(): string {
  if (process.env.TO_FIXTURES) return process.env.TO_FIXTURES;
  try {
    for (const a of readdirSync('/tmp')) {
      const base = join('/tmp', a, '-home-user-TexturesOnline');
      if (!existsSync(base)) continue;
      for (const b of readdirSync(base)) {
        const dir = join(base, b, 'scratchpad');
        if (existsSync(join(dir, 'research-cache'))) return dir;
      }
    }
  } catch {
    /* no fixtures on this machine */
  }
  return '/nonexistent-fixtures';
}
