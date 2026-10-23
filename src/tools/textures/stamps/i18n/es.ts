import type { StampsLanguage } from './load';

const ES: StampsLanguage = {
  'textures.stamps': {
    choose: 'Elegir un sello',
    current: 'Sello: {name}',
    title: 'Sellos',
    presets: 'Predefinidos',
    presetsHint: 'Los predefinidos se dibujan en tonos de tu color principal.',
    yours: 'Tus sellos',
    none: 'Aún no tienes sellos propios. Selecciona una zona y guárdala como sello.',
    names: {
      ore: 'Manchas de mineral',
      cracks: 'Grietas',
      moss: 'Musgo',
      dither: 'Trama',
      sparkles: 'Destellos',
      pebbles: 'Guijarros',
    },
    stampName: 'Sello {n}',
    size: '{width} × {height}',
    save: 'Guardar la selección como sello',
    saveHint: 'Primero selecciona una zona (hasta 32 × 32 píxeles)',
    saved: 'Se guardó «{name}» como sello.',
    tooBig: 'Los sellos pueden medir hasta 32 × 32 píxeles. Selecciona una zona más pequeña.',
    empty: 'La selección no tiene píxeles para hacer un sello.',
    delete: 'Eliminar «{name}»',
    deleted: 'Se eliminó «{name}».',
    undo: 'Deshacer',
    rotate: 'Girar el sello (R)',
    rotateTouch: 'Girar el sello',
    flipH: 'Voltear el sello de izquierda a derecha (H)',
    flipHTouch: 'Voltear el sello de izquierda a derecha',
    flipV: 'Voltear el sello de arriba abajo (Mayús + H)',
    flipVTouch: 'Voltear el sello de arriba abajo',
    hint: 'Haz clic para sellar. Mantén pulsado y arrastra para colocarlo primero y luego suelta. El clic derecho sella su forma con el color secundario.',
    hintTouch: 'Toca para sellar. Mantén y arrastra para colocarlo primero y luego levanta el dedo.',
    kept: 'Tus sellos se guardan en este navegador, y los guardados en este pack van en su archivo de proyecto.',
  },
};

export default ES;
