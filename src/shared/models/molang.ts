// A small Molang evaluator for posing Bedrock models at rest: numbers, arithmetic, comparisons,
// logic, the ternary and null-coalescing operators, `this`, math.* functions (angles in degrees, as
// in the game) and queries / variables, which all read as 0 (an entity standing still at time 0) unless
// given. Statements, loops and arrays are not supported: they give null. Pure.

export interface MolangContext {
  /** Value of `this` (the channel's value before the animation) */
  this?: number;
  /** Values of queries / variables by name ('query.is_baby', 'variable.x'...), default 0 */
  vars?: Record<string, number>;
}

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

function tokenize(src: string): Tok[] | null {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?f?/i.exec(src.slice(i));
    if (num && /[\d.]/.test(c)) {
      out.push({ t: 'num', v: parseFloat(num[0]) });
      i += num[0].length;
      continue;
    }
    const id = /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)*/i.exec(src.slice(i));
    if (id) {
      out.push({ t: 'id', v: id[0].toLowerCase() });
      i += id[0].length;
      continue;
    }
    const op = /^(&&|\|\||==|!=|<=|>=|\?\?|[-+*/()<>!?:,])/.exec(src.slice(i));
    if (!op) return null;
    out.push({ t: 'op', v: op[0] });
    i += op[0].length;
  }
  return out;
}

const DEG = Math.PI / 180;
const FUNCS: Record<string, (...a: number[]) => number> = {
  'math.cos': (x) => Math.cos(x * DEG),
  'math.sin': (x) => Math.sin(x * DEG),
  'math.abs': Math.abs,
  'math.sqrt': Math.sqrt,
  'math.floor': Math.floor,
  'math.ceil': Math.ceil,
  'math.round': Math.round,
  'math.trunc': Math.trunc,
  'math.pow': Math.pow,
  'math.exp': Math.exp,
  'math.ln': Math.log,
  'math.min': Math.min,
  'math.max': Math.max,
  'math.mod': (a, b) => a % b,
  'math.clamp': (x, a, b) => Math.min(Math.max(x, a), b),
  'math.lerp': (a, b, t) => a + (b - a) * t,
  'math.lerprotate': (a, b, t) => a + (b - a) * t,
  'math.atan': (x) => Math.atan(x) / DEG,
  'math.atan2': (y, x) => Math.atan2(y, x) / DEG,
  'math.asin': (x) => Math.asin(x) / DEG,
  'math.acos': (x) => Math.acos(x) / DEG,
  'math.hermite_blend': (t) => 3 * t * t - 2 * t * t * t,
  'math.random': (a = 0) => a,
  'math.random_integer': (a = 0) => a,
  'math.die_roll': () => 0,
  'math.die_roll_integer': () => 0,
};
const CONSTS: Record<string, number> = { 'math.pi': Math.PI, true: 1, false: 0 };

/** The value of a Molang expression (or a plain number / boolean), or null when it can't be evaluated. */
export function evalMolang(src: unknown, ctx: MolangContext = {}): number | null {
  if (typeof src === 'number') return Number.isFinite(src) ? src : null;
  if (typeof src === 'boolean') return src ? 1 : 0;
  if (typeof src !== 'string') return null;
  if (/[;{}[\]=]/.test(src.replace(/==|!=|<=|>=/g, ''))) return null;
  const toks = tokenize(src);
  if (!toks || !toks.length) return null;
  let i = 0;
  const peek = (): Tok | undefined => toks[i];
  const isOp = (v: string) => peek()?.t === 'op' && peek()!.v === v;
  const fail = (): never => {
    throw new Error('molang');
  };
  const expect = (v: string) => (isOp(v) ? i++ : fail());

  const primary = (): number => {
    const t = toks[i++];
    if (!t) return fail();
    if (t.t === 'num') return t.v;
    if (t.t === 'op') {
      if (t.v === '(') {
        const x = ternary();
        expect(')');
        return x;
      }
      if (t.v === '-') return -unary();
      if (t.v === '+') return unary();
      if (t.v === '!') return unary() ? 0 : 1;
      return fail();
    }
    const name = t.v;
    if (isOp('(')) {
      i++;
      const args: number[] = [];
      if (!isOp(')')) {
        args.push(ternary());
        while (isOp(',')) {
          i++;
          args.push(ternary());
        }
      }
      expect(')');
      const f = FUNCS[name];
      if (f) return f(...args);
      // query functions (query.foo(1)) read as 0 at rest
      return /^(q|query|v|variable|t|temp|c|context)\./.test(name) ? (ctx.vars?.[name] ?? 0) : fail();
    }
    if (name === 'this') return ctx.this ?? 0;
    if (name in CONSTS) return CONSTS[name];
    if (/^(q|query|v|variable|t|temp|c|context)\./.test(name)) {
      const full = name.replace(/^q\./, 'query.').replace(/^v\./, 'variable.');
      return ctx.vars?.[full] ?? 0;
    }
    return fail();
  };
  const unary = (): number => primary();
  const mul = (): number => {
    let x = unary();
    while (isOp('*') || isOp('/')) {
      const op = toks[i++].v;
      const y = unary();
      x = op === '*' ? x * y : y === 0 ? 0 : x / y;
    }
    return x;
  };
  const add = (): number => {
    let x = mul();
    while (isOp('+') || isOp('-')) {
      const op = toks[i++].v;
      const y = mul();
      x = op === '+' ? x + y : x - y;
    }
    return x;
  };
  const cmp = (): number => {
    let x = add();
    while (isOp('<') || isOp('>') || isOp('<=') || isOp('>=')) {
      const op = toks[i++].v;
      const y = add();
      x = (op === '<' ? x < y : op === '>' ? x > y : op === '<=' ? x <= y : x >= y) ? 1 : 0;
    }
    return x;
  };
  const eq = (): number => {
    let x = cmp();
    while (isOp('==') || isOp('!=')) {
      const op = toks[i++].v;
      const y = cmp();
      x = (op === '==' ? x === y : x !== y) ? 1 : 0;
    }
    return x;
  };
  const and = (): number => {
    let x = eq();
    while (isOp('&&')) {
      i++;
      const y = eq();
      x = x && y ? 1 : 0;
    }
    return x;
  };
  const or = (): number => {
    let x = and();
    while (isOp('||')) {
      i++;
      const y = and();
      x = x || y ? 1 : 0;
    }
    return x;
  };
  const coalesce = (): number => {
    const x = or();
    if (isOp('??')) {
      i++;
      const y = coalesce();
      return x ?? y;
    }
    return x;
  };
  const ternary = (): number => {
    const c = coalesce();
    if (isOp('?')) {
      i++;
      const a = ternary();
      if (isOp(':')) {
        i++;
        const b = ternary();
        return c ? a : b;
      }
      return c ? a : 0;
    }
    return c;
  };
  try {
    const x = ternary();
    return i === toks.length && Number.isFinite(x) ? x : null;
  } catch {
    return null;
  }
}
