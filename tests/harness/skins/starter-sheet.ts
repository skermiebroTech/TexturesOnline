// Renders every starter skin (classic and slim rows) to a PNG contact sheet for visual review.
// Run: npx tsx tests/harness/skins/starter-sheet.ts out.png
import { writeFileSync } from 'node:fs';
import { encode } from 'fast-png';
import '../../../src/core/image';
import { STARTERS, createStarterSkin } from '../../../src/tools/skins/starters';
const S = 5; // scale
const cols = STARTERS.length;
const W = cols * (64 * S + 10), H = 2 * (64 * S + 10);
const out = new Uint8Array(W * H * 4);
for (let i = 0; i < out.length; i += 4) { out[i] = 40; out[i+1] = 44; out[i+2] = 52; out[i+3] = 255; }
STARTERS.forEach((s, ci) => {
  (['classic', 'slim'] as const).forEach((m, ri) => {
    const img = createStarterSkin(s.id, m);
    const ox = ci * (64 * S + 10), oy = ri * (64 * S + 10);
    for (let y = 0; y < 64 * S; y++) for (let x = 0; x < 64 * S; x++) {
      const si = (Math.floor(y / S) * 64 + Math.floor(x / S)) * 4;
      const a = img.data[si + 3];
      const di = ((oy + y) * W + ox + x) * 4;
      const chk = ((Math.floor(x / S) + Math.floor(y / S)) % 2) ? 70 : 90;
      for (let k = 0; k < 3; k++) out[di + k] = Math.round(img.data[si + k] * a / 255 + chk * (1 - a / 255));
      out[di + 3] = 255;
    }
  });
});
writeFileSync(process.argv[2], encode({ width: W, height: H, data: out, channels: 4, depth: 8 }));
