// Runtime behaviour for prerendered content trees: tab sets (see blocks.tabbed).

/** Wires every tab set inside root; returns a cleanup function. */
export function wireContent(root: HTMLElement): () => void {
  const offs: (() => void)[] = [];
  root.querySelectorAll<HTMLElement>('.guide-tabs[data-tabs]').forEach((set) => {
    const tabs = Array.from(set.querySelectorAll<HTMLButtonElement>(':scope > [role="tablist"] > [role="tab"]'));
    const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls') ?? '') ?? set.querySelector<HTMLElement>(`#${CSS.escape(t.getAttribute('aria-controls') ?? '')}`));
    const select = (i: number, focus = false) => {
      tabs.forEach((t, j) => {
        const on = i === j;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const p = panels[j];
        if (p) p.hidden = !on;
      });
      if (focus) tabs[i]?.focus();
    };
    const onClick = (e: MouseEvent) => {
      const i = tabs.indexOf((e.target as Element).closest('[role="tab"]') as HTMLButtonElement);
      if (i >= 0) select(i);
    };
    const onKey = (e: KeyboardEvent) => {
      const i = tabs.indexOf(document.activeElement as HTMLButtonElement);
      if (i < 0) return;
      let next = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      if (next < 0) return;
      e.preventDefault();
      select(next, true);
    };
    const list = set.querySelector<HTMLElement>(':scope > [role="tablist"]');
    list?.addEventListener('click', onClick);
    list?.addEventListener('keydown', onKey);
    offs.push(() => {
      list?.removeEventListener('click', onClick);
      list?.removeEventListener('keydown', onKey);
    });
  });
  return () => offs.forEach((f) => f());
}
