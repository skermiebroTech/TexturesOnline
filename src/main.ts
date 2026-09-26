// Temporary landing page shown while the full app is being built.
const style = document.createElement('style');
style.textContent = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; font-family: 'Pixelify Sans', system-ui, sans-serif; color: #eef1f7;
    background: radial-gradient(1200px 600px at 50% -10%, rgba(91,211,91,.18), transparent 60%),
      radial-gradient(800px 500px at 90% 110%, rgba(176,124,255,.14), transparent 60%), #0d0f14; }
  main { max-width: 960px; margin: 0 auto; padding: 72px 20px 48px; text-align: center; }
  canvas { width: 128px; height: 128px; image-rendering: pixelated; filter: drop-shadow(0 16px 32px rgba(91,211,91,.35)); animation: bob 3s ease-in-out infinite; }
  @keyframes bob { 50% { transform: translateY(-8px); } }
  h1 { font-size: clamp(36px, 7vw, 64px); margin: 28px 0 8px; letter-spacing: 1px; text-shadow: 0 4px 0 #1b3a1b; }
  p.lead { color: #b4bccb; font-size: 20px; margin: 0 0 40px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; text-align: left; }
  .card { background: #181c25; border: 1px solid #2a3140; border-radius: 8px; padding: 22px; box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 10px 30px rgba(0,0,0,.35); }
  .card h2 { margin: 0 0 8px; font-size: 22px; }
  .card p { margin: 0; color: #9aa3b2; line-height: 1.5; }
  .dot { display: inline-block; width: 10px; height: 10px; margin-right: 10px; }
  .badge { display: inline-block; margin-top: 44px; padding: 8px 14px; border-radius: 4px; background: #1f2430; border: 1px solid #3a4254; color: #ffcf4a; }
  footer { margin-top: 56px; color: #7d8699; font-size: 14px; }
`;
document.head.append(style);

// Original procedurally drawn pixel-art grass block.
function grassBlock(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const px = (x: number, y: number, col: string) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  const shade = (base: number[], k: number) => `rgb(${base.map(v => Math.max(0, Math.min(255, v * k))).join(',')})`;
  // isometric cube: top diamond, left + right faces
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const dx = Math.abs(x - 15.5), top = y < 16 && dx / 2 + Math.abs(y - 7.5) <= 8;
    const side = y >= 8 && y < 32 - dx / 2 && dx < 16 && !top;
    if (!top && !side) continue;
    const n = 0.85 + rnd() * 0.3;
    if (top) px(x, y, shade([98, 186, 70], n));
    else {
      const depth = y - (8 + (16 - dx) / 2);
      const face = x < 16 ? 0.8 : 0.62;
      const base = depth < 3 + (rnd() < 0.4 ? 1 : 0) ? [98, 186, 70] : [134, 96, 67];
      px(x, y, shade(base, n * face));
    }
  }
  return c;
}

const app = document.getElementById('app')!;
app.innerHTML = `
  <main>
    <div id="logo"></div>
    <h1>TexturesOnline</h1>
    <p class="lead">Make Minecraft texture packs, skins &amp; shaders — right in your browser.</p>
    <div class="cards">
      <div class="card"><h2><span class="dot" style="background:#5bd35b"></span>Texture Packs</h2><p>Browse every vanilla texture, paint pixels, apply one-click effects, open existing packs. Java 26.3 + every version, and Bedrock.</p></div>
      <div class="card"><h2><span class="dot" style="background:#4fb3ff"></span>Skins</h2><p>Paint on the 64×64 template with a live 3D preview. Classic &amp; slim. Export for Java or as a Bedrock skin pack.</p></div>
      <div class="card"><h2><span class="dot" style="background:#b07cff"></span>Shaders</h2><p>Sliders and presets for Iris/OptiFine shader packs, no-mod vanilla shaders, and Bedrock Vibrant Visuals.</p></div>
    </div>
    <div class="badge">Under construction — the full app is on its way</div>
    <footer>Not affiliated with Mojang or Microsoft.</footer>
  </main>`;
document.getElementById('logo')!.append(grassBlock());
