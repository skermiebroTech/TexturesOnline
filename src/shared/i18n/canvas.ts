// English text of the pixel editor canvas (src/shared/pixel-canvas.ts), shared by the texture,
// skin and totem editors. Key names (B, Shift, Ctrl/Cmd, Enter, Esc, Delete) stay as they are on
// the keyboard. Translations: src/shared/i18n/<lang>.ts.

import { defineText } from '../../i18n/editor-text';

export const canvasText = defineText('shared.canvas', {
  roleDescription: 'pixel editor',
  label: 'Pixel editor',
  help: 'Arrow keys move the keyboard cursor, Enter uses the current tool there. Tool shortcuts: B pencil, E eraser, G fill, I picker, L line, U rectangle, O ellipse, M select, V move. Ctrl+Z undo.',
  pasteFailed: 'The pasted image could not be read',
  transparent: 'transparent',
  /** Keyboard and pointer gestures in the shortcut list (plain key names are not translated) */
  keys: {
    altHold: 'Alt (hold)',
    shiftClick: 'Shift + click',
    rightClick: 'Right click',
    arrows: 'Arrow keys',
    pan: 'Space + drag, middle drag',
    wheel: 'Mouse wheel, pinch',
    twoFingerTap: 'Two-finger tap',
  },
  shortcuts: {
    pencil: 'Pencil',
    eraser: 'Eraser',
    fill: 'Fill bucket',
    picker: 'Color picker',
    tempPicker: 'Temporary color picker',
    line: 'Line (hold Shift to snap angles)',
    rect: 'Rectangle (press again for filled)',
    ellipse: 'Ellipse (hold Shift for a circle)',
    select: 'Select',
    move: 'Move',
    stamp: 'Stamp (R turns it, H / Shift + H flips it)',
    swap: 'Swap primary and secondary colors',
    brush: 'Smaller / bigger brush',
    straight: 'Straight line from the last point',
    secondary: 'Paint with the secondary color',
    undo: 'Undo',
    redo: 'Redo',
    selectAll: 'Select all, deselect',
    clipboard: 'Copy, cut, paste',
    clear: 'Clear the selection',
    drop: 'Drop the moved selection, deselect',
    nudge: 'Nudge the selection (Shift: 8 px)',
    flip: 'Flip horizontally, vertically',
    rotate: 'Rotate 90°',
    grid: 'Toggle pixel grid',
    fit: 'Zoom to fit',
    zoomInOut: 'Zoom in / out',
    panAction: 'Pan',
    zoom: 'Zoom',
    touchUndo: 'Undo (touch screens)',
  },
});

export type CanvasText = typeof canvasText;
