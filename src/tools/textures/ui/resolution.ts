// What a pack resolution means, in one sentence (start screen and Pack tab).

export function resolutionSentence(r: number): string {
  if (r <= 16) return '16× is the classic Minecraft look: every block face is 16×16 pixels, just like the original game.';
  const detail = r === 32 ? 'twice' : r === 64 ? '4 times' : r === 128 ? '8 times' : r === 256 ? '16 times' : '32 times';
  return `${r}× gives each block face ${r}×${r} pixels — ${detail} the detail. Textures are scaled up when you start editing them, so you can add finer details.`;
}
