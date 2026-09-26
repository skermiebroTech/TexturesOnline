// Tiny typed event emitter and reactive signal/store helpers. No DOM, safe under Node.

export type Unsubscribe = () => void;

/** Typed event emitter: `new Emitter<{ change: ImageData; saved: void }>()` */
export class Emitter<Events extends Record<string, unknown>> {
  private handlers = new Map<keyof Events, Set<(payload: never) => void>>();

  on<K extends keyof Events>(type: K, cb: (payload: Events[K]) => void): Unsubscribe {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(cb as (payload: never) => void);
    return () => this.off(type, cb);
  }

  once<K extends keyof Events>(type: K, cb: (payload: Events[K]) => void): Unsubscribe {
    const off = this.on(type, (p) => {
      off();
      cb(p);
    });
    return off;
  }

  off<K extends keyof Events>(type: K, cb: (payload: Events[K]) => void): void {
    const set = this.handlers.get(type);
    if (!set) return;
    set.delete(cb as (payload: never) => void);
    if (set.size === 0) this.handlers.delete(type);
  }

  emit<K extends keyof Events>(type: K, ...args: Events[K] extends void | undefined ? [payload?: Events[K]] : [payload: Events[K]]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const cb of Array.from(set)) {
      try {
        (cb as (payload: Events[K]) => void)(args[0] as Events[K]);
      } catch (err) {
        console.error(`Error in "${String(type)}" handler`, err);
      }
    }
  }

  listenerCount(type?: keyof Events): number {
    if (type !== undefined) return this.handlers.get(type)?.size ?? 0;
    let n = 0;
    for (const s of this.handlers.values()) n += s.size;
    return n;
  }

  clear(): void {
    this.handlers.clear();
  }
}

export interface ReadonlySignal<T> {
  readonly value: T;
  get(): T;
  /** Called with (next, previous) after every change. */
  subscribe(cb: (value: T, prev: T) => void, opts?: { immediate?: boolean }): Unsubscribe;
}

export interface Signal<T> extends ReadonlySignal<T> {
  value: T;
  set(next: T | ((prev: T) => T)): void;
  /** Re-notify subscribers after mutating the current value in place. */
  notify(): void;
}

/** Observable value. Setting an equal value (Object.is by default) is a no-op. */
export function signal<T>(initial: T, equals: (a: T, b: T) => boolean = Object.is): Signal<T> {
  let current = initial;
  const subs = new Set<(value: T, prev: T) => void>();

  const run = (prev: T) => {
    for (const cb of Array.from(subs)) {
      try {
        cb(current, prev);
      } catch (err) {
        console.error('Error in signal subscriber', err);
      }
    }
  };

  const sig: Signal<T> = {
    get value() {
      return current;
    },
    set value(v: T) {
      sig.set(v);
    },
    get: () => current,
    set(next) {
      const value = typeof next === 'function' ? (next as (prev: T) => T)(current) : next;
      if (equals(value, current)) return;
      const prev = current;
      current = value;
      run(prev);
    },
    notify() {
      run(current);
    },
    subscribe(cb, opts) {
      subs.add(cb);
      if (opts?.immediate) cb(current, current);
      return () => {
        subs.delete(cb);
      };
    },
  };
  return sig;
}

/** Derived read-only signal recomputed whenever any dependency changes. */
export function computed<T>(deps: ReadonlySignal<unknown>[], fn: () => T, equals: (a: T, b: T) => boolean = Object.is): ReadonlySignal<T> & { dispose(): void } {
  const inner = signal(fn(), equals);
  const offs = deps.map((d) => d.subscribe(() => inner.set(fn())));
  return {
    get value() {
      return inner.value;
    },
    get: inner.get,
    subscribe: inner.subscribe,
    dispose() {
      offs.forEach((off) => off());
    },
  };
}

export interface Store<T extends object> extends Signal<T> {
  /** Shallow-merge a partial update; notifies only when a key actually changed. */
  patch(partial: Partial<T>): void;
  /** Subscribe to one slice; `cb` runs only when the selected value changes. */
  select<S>(selector: (state: T) => S, cb: (value: S, prev: S) => void, equals?: (a: S, b: S) => boolean): Unsubscribe;
}

/** Immutable object store built on signal(). */
export function store<T extends object>(initial: T): Store<T> {
  const base = signal<T>(initial);
  const st = base as Store<T>;
  st.patch = (partial) => {
    const cur = base.get();
    let changed = false;
    for (const k of Object.keys(partial) as (keyof T)[]) {
      if (!Object.is(cur[k], partial[k])) {
        changed = true;
        break;
      }
    }
    if (changed) base.set({ ...cur, ...partial });
  };
  st.select = (selector, cb, equals = Object.is) => {
    let last = selector(base.get());
    return base.subscribe((state) => {
      const next = selector(state);
      if (equals(next, last)) return;
      const prev = last;
      last = next;
      cb(next, prev);
    });
  };
  return st;
}

/** Trailing-edge debounce with flush/cancel. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number): ((...args: A) => void) & { flush(): void; cancel(): void; pending(): boolean } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: A | null = null;
  const invoke = () => {
    timer = null;
    if (lastArgs) {
      const args = lastArgs;
      lastArgs = null;
      fn(...args);
    }
  };
  const d = (...args: A) => {
    lastArgs = args;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(invoke, wait);
  };
  d.flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      invoke();
    }
  };
  d.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };
  d.pending = () => timer !== null;
  return d;
}

/** Leading + trailing throttle. */
export function throttle<A extends unknown[]>(fn: (...args: A) => void, wait: number): ((...args: A) => void) & { cancel(): void } {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: A | null = null;
  const t = (...args: A) => {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      last = now;
      fn(...args);
    } else {
      lastArgs = args;
      if (timer === null) {
        timer = setTimeout(() => {
          timer = null;
          last = Date.now();
          if (lastArgs) fn(...lastArgs);
          lastArgs = null;
        }, remaining);
      }
    }
  };
  t.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };
  return t;
}
