/**
 * Shader programs of a version: which vertex + fragment shader are compiled together with which
 * defines, and (when known) which uniform blocks / samplers the pipeline layout provides.
 * ≤ 1.21.4 read the program JSON files; newer versions use pipeline tables parsed from the game's
 * RenderPipelines class (fixture files, optional) or fall back to same-name pairs.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Define } from './glsl';
import { fixturesDir } from './sources';

export interface Program {
  label: string;
  /** e.g. 'core/terrain' */
  vsh: string;
  fsh: string;
  defines: Define[];
  /** Uniform blocks / samplers in the pipeline layout (null = unknown) */
  layout: string[] | null;
  /** Plain uniforms listed by a program JSON (≤ 1.21.4) */
  jsonUniforms: string[] | null;
}

const CORE = 'assets/minecraft/shaders/core/';

const CONSTANTS: Record<string, string> = {
  'LevelRenderer.OIT_COEFFICIENT_COUNT': '8',
  'LevelRenderer.OIT_TRANSMITTANCE_TARGET_COUNT': '2',
  'LevelRenderer.OIT_NUMBER_OF_DEPTH_BINS': '8',
  'LevelRenderer.OIT_WAVELET_RANK': '2',
};

function normDefine(d: string | [string, string]): Define {
  if (Array.isArray(d)) return [d[0], String(d[1])];
  const eq = d.indexOf('=');
  if (eq < 0) return [d, ''];
  let v = d.slice(eq + 1).trim();
  if (/^-?[\d.]+F$/.test(v)) v = v.slice(0, -1);
  return [d.slice(0, eq), CONSTANTS[v] ?? v];
}

const base = (n: string): string => {
  const p = n.includes(':') ? n.slice(n.indexOf(':') + 1) : n;
  return p.slice(p.lastIndexOf('/') + 1);
};

/** Table file for a version; versions without their own table borrow a same-format neighbour. */
const TABLE_ALIASES: Record<string, string> = { '1.21.7': '1.21.8' };

function pipelineTable(version: string): { location: string; vsh: string; fsh: string; defines: string[]; uniforms: string[] }[] | null {
  const dir = fixturesDir();
  if (!dir) return null;
  for (const v of [version, TABLE_ALIASES[version]]) {
    if (!v) continue;
    const p = join(dir, 'research-cache', 'proto', `pipelines-${v}.json`);
    if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'));
  }
  return null;
}

export function programsFor(version: string, sources: Record<string, string>): { programs: Program[]; source: 'json' | 'table' | 'pairs' } {
  const jsonKeys = Object.keys(sources).filter((k) => k.startsWith(CORE) && k.endsWith('.json'));
  if (jsonKeys.length) {
    const programs: Program[] = [];
    for (const k of jsonKeys.sort()) {
      let j: { vertex?: string; fragment?: string; defines?: { values?: Record<string, unknown>; flags?: string[] }; uniforms?: { name: string }[] };
      try {
        j = JSON.parse(sources[k]);
      } catch {
        continue;
      }
      if (typeof j.vertex !== 'string' || typeof j.fragment !== 'string') continue;
      const defines: Define[] = [
        ...Object.entries(j.defines?.values ?? {}).map(([a, b]) => [a, String(b)] as Define),
        ...(j.defines?.flags ?? []).map((f) => [f, ''] as Define),
      ];
      programs.push({
        label: k.slice(CORE.length),
        vsh: 'core/' + base(j.vertex),
        fsh: 'core/' + base(j.fragment),
        defines,
        layout: null,
        jsonUniforms: (j.uniforms ?? []).map((u) => u.name),
      });
    }
    return { programs, source: 'json' };
  }
  const table = pipelineTable(version);
  if (table) {
    return {
      programs: table.map((p) => ({ label: p.location, vsh: p.vsh, fsh: p.fsh, defines: p.defines.map(normDefine), layout: p.uniforms, jsonUniforms: null })),
      source: 'table',
    };
  }
  const programs: Program[] = [];
  for (const k of Object.keys(sources).sort()) {
    if (!k.startsWith(CORE) || !k.endsWith('.fsh')) continue;
    const b = k.slice(CORE.length, -4);
    if (sources[`${CORE}${b}.vsh`] === undefined) continue;
    programs.push({ label: b, vsh: 'core/' + b, fsh: 'core/' + b, defines: [], layout: null, jsonUniforms: null });
    if (b === 'terrain') {
      for (const a of ['0.1', '0.5']) programs.push({ label: `${b} ALPHA_CUTOUT=${a}`, vsh: 'core/' + b, fsh: 'core/' + b, defines: [['ALPHA_CUTOUT', a]], layout: null, jsonUniforms: null });
    }
  }
  return { programs, source: 'pairs' };
}
