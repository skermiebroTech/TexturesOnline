// Minimal preprocessor for shader pack .properties files, as the loaders run it before parsing:
// #if / #elif with integer comparisons, defined(), !, && and ||, plus #ifdef / #ifndef / #else / #endif.

type Macros = Record<string, string>;

function evalExpr(expr: string, macros: Macros): boolean {
  const tokens = expr.match(/defined\s*\(\s*\w+\s*\)|defined\s+\w+|\w+|&&|\|\||[<>=!]=|[<>!()]/g) ?? [];
  let i = 0;
  const peek = (): string | undefined => tokens[i];
  const take = (): string => tokens[i++];
  const value = (tok: string): number => {
    const d = /^defined\s*\(?\s*(\w+)\s*\)?$/.exec(tok);
    if (d) return d[1] in macros ? 1 : 0;
    if (/^-?\d+$/.test(tok)) return Number(tok);
    const m = macros[tok];
    return m !== undefined && /^-?\d+$/.test(m) ? Number(m) : m !== undefined && m === '' ? 1 : 0;
  };
  const primary = (): number => {
    const t = take();
    if (t === '(') {
      const v = or();
      take();
      return v;
    }
    if (t === '!') return primary() ? 0 : 1;
    return value(t);
  };
  const cmp = (): number => {
    let left = primary();
    while (peek() && ['<', '>', '<=', '>=', '==', '!='].includes(peek()!)) {
      const op = take();
      const right = primary();
      left = Number(op === '<' ? left < right : op === '>' ? left > right : op === '<=' ? left <= right : op === '>=' ? left >= right : op === '==' ? left === right : left !== right);
    }
    return left;
  };
  const and = (): number => {
    let v = cmp();
    while (peek() === '&&') {
      take();
      const r = cmp();
      v = Number(!!v && !!r);
    }
    return v;
  };
  const or = (): number => {
    let v = and();
    while (peek() === '||') {
      take();
      const r = and();
      v = Number(!!v || !!r);
    }
    return v;
  };
  return !!or();
}

/** Returns the lines that survive preprocessing (directives removed). */
export function preprocessProperties(text: string, macros: Macros): string[] {
  const out: string[] = [];
  // Each frame: [active, anyBranchTaken, parentActive]
  const stack: Array<[boolean, boolean, boolean]> = [];
  const active = (): boolean => (stack.length ? stack[stack.length - 1][0] : true);
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    let m: RegExpExecArray | null;
    if ((m = /^#ifdef\s+(\w+)$/.exec(line))) {
      const parent = active();
      const cond = m[1] in macros;
      stack.push([parent && cond, cond, parent]);
    } else if ((m = /^#ifndef\s+(\w+)$/.exec(line))) {
      const parent = active();
      const cond = !(m[1] in macros);
      stack.push([parent && cond, cond, parent]);
    } else if ((m = /^#if\s+(.+)$/.exec(line))) {
      const parent = active();
      const cond = evalExpr(m[1], macros);
      stack.push([parent && cond, cond, parent]);
    } else if ((m = /^#elif\s+(.+)$/.exec(line))) {
      const top = stack[stack.length - 1];
      if (!top) throw new Error('#elif without #if');
      const cond = !top[1] && evalExpr(m[1], macros);
      top[0] = top[2] && cond;
      top[1] = top[1] || cond;
    } else if (/^#else\b/.test(line)) {
      const top = stack[stack.length - 1];
      if (!top) throw new Error('#else without #if');
      top[0] = top[2] && !top[1];
      top[1] = true;
    } else if (/^#endif\b/.test(line)) {
      if (!stack.pop()) throw new Error('#endif without #if');
    } else if (active()) {
      out.push(raw);
    }
  }
  if (stack.length) throw new Error('unterminated #if');
  return out;
}

/** key=value entries of the preprocessed file (comments and blank lines dropped). */
export function propertiesFor(text: string, macros: Macros): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const raw of preprocessProperties(text, macros)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    out.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
  }
  return out;
}
