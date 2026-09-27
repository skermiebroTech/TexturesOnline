import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Directory holding the research fixtures (real game jars, Bedrock samples, version lists).
 * Set TO_FIXTURES to point at it. Tests that need a fixture skip themselves when it is missing.
 */
export function fixturesDir(): string {
  return process.env.TO_FIXTURES || '/nonexistent-fixtures';
}
