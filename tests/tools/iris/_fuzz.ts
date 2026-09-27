import { generateIrisPack, defaults } from '../../../src/tools/shaders/iris/index';
import { accidentalDirectives, strayBlockKeys, propertiesFor } from './properties';
import { defineLineProblems, parsePackOptions } from './glsl-check';
import { mulberry32 } from './fixtures';
const rand = mulberry32(5);
const chars = ' #/\\*%=:!.-_abcXYZ019"\'<>{}[]()\n\tblock.ifdefendifé✨';
const base = generateIrisPack(defaults(), { name: 'x', description: '' }) as Record<string, string>;
const m = { MC_VERSION: '260300', IS_IRIS: '', IRIS_TAG_SUPPORT: '2' };
let bad = 0;
for (let i = 0; i < 2000; i++) {
  let name = '';
  const n = Math.floor(rand() * 30);
  for (let k = 0; k < n; k++) name += [...chars][Math.floor(rand() * [...chars].length)];
  const f = generateIrisPack(defaults(), { name, description: name }) as Record<string, string>;
  const probs = [
    ...['shaders.properties', 'block.properties', 'item.properties', 'entity.properties'].flatMap((p) => accidentalDirectives(f[`shaders/${p}`])),
    ...strayBlockKeys(f['shaders/block.properties']), ...defineLineProblems(f), ...parsePackOptions(f).problems,
  ];
  for (const p of ['shaders.properties', 'block.properties']) if (JSON.stringify(propertiesFor(f[`shaders/${p}`], m)) !== JSON.stringify(propertiesFor(base[`shaders/${p}`], m))) probs.push('entries differ ' + p);
  for (const [p, c] of Object.entries(f)) if (/\.(glsl|vsh|fsh|properties)$/.test(p) && !/^[\x09\x0a\x20-\x7e]*$/.test(c)) probs.push('non-ascii ' + p);
  if (probs.length) { bad++; if (bad < 5) console.log(JSON.stringify(name), probs); }
}
console.log('bad', bad);
