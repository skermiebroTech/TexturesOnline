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

export function openTotemEditor(opts: { image: ImageData; generated: ImageData; onSave: (img: ImageData) => void }): void {
  const host = h('div', { class: 'tt-ed-canvas checker' });
  const colors = imageColors(opts.image);
  let color: RGBA = colors[0] ?? [255, 214, 74, 255];
  let pc: PixelCanvas | null = null;

  const TOOLS: { tool: Tool; label: string; icon: IconName }[] = [
    { tool: 'pencil', label: 'Pencil (B)', icon: 'pencil' },
    { tool: 'eraser', label: 'Eraser (E)', icon: 'eraser' },
    { tool: 'fill', label: 'Fill (G)', icon: 'fill' },
    { tool: 'picker', label: 'Pick a colour (I)', icon: 'pipette' },
  ];
  const toolButtons = TOOLS.map((t) => {
    const b = iconButton(t.icon, t.label, () => {
      pc?.setTool(t.tool);
      showTool(t.tool);
    }, { active: t.tool === 'pencil', class: 'tt-ed-tool' });
    b.dataset.tool = t.tool;
    return b;
  });
  const showTool = (t: Tool) => toolButtons.forEach((b) => b.setActive(b.dataset.tool === t));
  const toolRow = h('div', { class: 'tt-ed-tools', role: 'group', 'aria-label': 'Tools' }, toolButtons);

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
    { class: 'tt-ed-swatches', role: 'list', 'aria-label': 'Colours in this totem' },
    colors.map((c) => {
      const b = h('button', { type: 'button', class: 'tt-ed-swatch', role: 'listitem', style: { background: toHex(c) }, 'aria-label': `Use ${toHex(c)}` });
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
  const undo = iconButton('undo', 'Undo', () => pc?.undo(), { size: 'sm', class: 'tt-ed-undo' });
  const redo = iconButton('redo', 'Redo', () => pc?.redo(), { size: 'sm', class: 'tt-ed-redo' });
  let mirrored = false;
  const mirror = h('button', { type: 'button', class: 'icon-btn sm tt-ed-mirror', 'aria-pressed': 'false', 'aria-label': 'Mirror painting (left and right)' }, icon('mirror'));
  tooltip(mirror, 'Mirror painting');
  mirror.addEventListener('click', () => {
    mirrored = !mirrored;
    mirror.setAttribute('aria-pressed', String(mirrored));
    pc?.setMirror(mirrored, false);
  });
  const restart = h('button', { type: 'button', class: 'btn btn-ghost btn-sm tt-ed-restart' }, icon('reload'), h('span', { class: 'btn-label' }, 'Start over'));
  tooltip(restart, 'Back to the generated totem (undo brings your edits back)');
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
      h('div', { class: 'tt-ed-colors' }, h('span', { class: 'field-label' }, 'Colours in this totem'), swatches),
      picker,
    ),
  );

  const modal = openModal({
    title: 'Edit the totem pixels',
    body,
    width: 760,
    class: 'tt-ed-modal',
    initialFocus: host,
    actions: [
      { label: 'Cancel', variant: 'secondary' },
      {
        label: 'Use this totem',
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
    label: 'Totem texture, 16 by 16 pixels. Paint with the current tool.',
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
