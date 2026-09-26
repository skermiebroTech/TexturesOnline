// Writes public/favicon.svg from the same generator as the in-app logo.
// Run: npx tsx tests/tools/ui/gen-favicon.ts
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { logoSvgMarkup } from '../../../src/ui/logo';

const out = fileURLToPath(new URL('../../../public/favicon.svg', import.meta.url));
writeFileSync(out, `${logoSvgMarkup()}\n`);
console.log(`wrote ${out}`);
