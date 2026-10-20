// Small pixel editor for the 16x16 totem: pencil, eraser, fill and eyedropper, a colour picker with
// the totem's own colours, mirror painting and undo/redo. Built on the shared PixelCanvas.

import { PixelCanvas, type RGBA, type Tool } from '../../shared/pixel-canvas';
import { cloneImageData, decodeImage } from '../../core/image';
import { h } from '../../ui/dom';
import { icon, type IconName } from '../../ui/icons';
import { iconButton, tooltip } from '../../ui/components';
import { colorPicker } from '../../ui/color-picker';
import { openModal } from '../../ui/modal';
import { toHex } from '../../ui/color';
import { imageColors } from './totem';
import { t } from './i18n/text';
import { fmt } from '../../i18n/editor-text';
import { kit } from '../../ui/i18n/kit';

export function openTotemEditor(opts: { image: ImageData; generated: ImageData; onSave: (img: ImageData) => void }): void {
  const host = h('div', { class: 'tt-ed-canvas checker' });
  const colors = imageColors(opts.image);
  let color: RGBA = colors[0] ?? [255, 214, 74, 255];
  let pc: PixelCanvas | null = null;

  const TOOLS: { tool: Tool; label: string; icon: IconName }[] = [
    { tool: 'pencil', label: t.editor.pencil, icon: 'pencil' },
    { tool: 'eraser', label: t.editor.eraser, icon: 'eraser' },
    { tool: 'fill', label: t.editor.fill, icon: 'fill' },
    { tool: 'picker', label: t.editor.picker, icon: 'pipette' },
  ];
  const toolButtons = TOOLS.map((tl) => {
    const b = iconButton(tl.icon, tl.label, () => {
      pc?.setTool(tl.tool);
      showTool(tl.tool);
    }, { active: tl.tool === 'pencil', class: 'tt-ed-tool' });
    b.dataset.tool = tl.tool;
    return b;
  });
  const showTool = (tool: Tool) => toolButtons.forEach((b) => b.setActive(b.dataset.tool === tool));
  const toolRow = h('div', { class: 'tt-ed-tools', role: 'group', 'aria-label': t.editor.tools }, toolButtons);

  const picker = colorPicker({
    value: color,
    inline: true,
    onChange: (c) => {
      color = c;
      pc?.setColor(c);
    },
  });
  const swatches = h(
    'div',
    { class: 'tt-ed-swatches', role: 'list', 'aria-label': t.editor.colours },
    colors.map((c) => {
      const b = h('button', { type: 'button', class: 'tt-ed-swatch', role: 'listitem', style: { background: toHex(c) }, 'aria-label': fmt(t.editor.useColour, { colour: toHex(c) }) });
      b.addEventListener('click', () => {
        color = c;
        picker.setValue(c);
        pc?.setColor(c);
        if (pc && (pc.getSettings().tool === 'eraser' || pc.getSettings().tool === 'picker')) {
          pc.setTool('pencil');
          showTool('pencil');
        }
      });
      return b;
    }),
  );
  const undo = iconButton('undo', t.editor.undo, () => pc?.undo(), { size: 'sm', class: 'tt-ed-undo' });
  const redo = iconButton('redo', t.editor.redo, () => pc?.redo(), { size: 'sm', class: 'tt-ed-redo' });
  let mirrored = false;
  const mirror = h('button', { type: 'button', class: 'icon-btn sm tt-ed-mirror', 'aria-pressed': 'false', 'aria-label': t.editor.mirror }, icon('mirror'));
  tooltip(mirror, t.editor.mirrorTip);
  mirror.addEventListener('click', () => {
    mirrored = !mirrored;
    mirror.setAttribute('aria-pressed', String(mirrored));
    pc?.setMirror(mirrored, false);
  });
  const restart = h('button', { type: 'button', class: 'btn btn-ghost btn-sm tt-ed-restart' }, icon('reload'), h('span', { class: 'btn-label' }, t.editor.restart));
  tooltip(restart, t.editor.restartTip);
  restart.addEventListener('click', () => {
    pc?.applyFilter(() => cloneImageData(opts.generated));
  });
  const paintHistory = () => {
    undo.disabled = !pc?.canUndo();
    redo.disabled = !pc?.canRedo();
  };

  const body = h(
    'div',
    { class: 'tt-ed' },
    host,
    h(
      'div',
      { class: 'tt-ed-side' },
      toolRow,
      h('div', { class: 'tt-ed-row' }, undo, redo, mirror, restart),
      h('div', { class: 'tt-ed-colors' }, h('span', { class: 'field-label' }, t.editor.colours), swatches),
      picker,
    ),
  );

  const modal = openModal({
    title: t.editor.title,
    body,
    width: 760,
    class: 'tt-ed-modal',
    initialFocus: host,
    actions: [
      { label: kit.cancel, variant: 'secondary' },
      {
        label: t.editor.use,
        variant: 'primary',
        onClick: () => {
          if (pc) opts.onSave(pc.getImage());
        },
      },
    ],
    onClose: () => {
      pc?.destroy();
      pc = null;
    },
  });
  modal.el.classList.add('accent-gold');

  pc = new PixelCanvas(host, {
    image: cloneImageData(opts.image),
    showGrid: true,
    hud: false,
    label: t.editor.canvas,
    decodeImage: (b) => decodeImage(b),
  });
  pc.setColor(color);
  pc.on('colorpick', (c) => {
    color = c;
    picker.setValue(c);
  });
  pc.on('tool', (t) => showTool(t));
  pc.on('history', paintHistory);
  paintHistory();
  requestAnimationFrame(() => pc?.zoomToFit());
}
