import type { SwapLanguage } from './load';

const ES: SwapLanguage = {
  'textures.swap': {
    button: 'Cambiar un color',
    buttonHint: 'Sustituye un color por otro en esta textura, en la selección o en todo el pack',
    title: 'Cambiar un color',
    from: 'Color que se sustituye',
    to: 'Color nuevo',
    exchange: 'Intercambiar los dos colores',
    pickFrom: 'Elígelo de esta textura:',
    tolerance: 'Colores parecidos',
    toleranceHint: 'También toma colores así de cercanos. Cada uno conserva su pequeña diferencia, así que el sombreado se mantiene.',
    ramp: 'Cambiar toda la escala de tonos',
    rampHint: 'Sus tonos más oscuros y más claros de esta textura se mueven con él y conservan su cambio de matiz.',
    rampShades: '{count, plural, one {# tono} other {# tonos}}',
    where: 'Dónde',
    scope: {
      texture: 'Esta textura',
      selection: 'Selección',
      pack: 'Todo el pack',
    },
    layersNote: 'Cambian todas las capas no bloqueadas de la textura.',
    selectionNote: 'Solo cambia la zona seleccionada de la capa en la que pintas.',
    before: 'Antes',
    after: 'Después',
    pixels: '{count, plural, =0 {No cambia ningún píxel} one {Cambia # píxel} other {Cambian # píxeles}}',
    packNote: 'Texturas de tu pack que usan el color:',
    gameToo: 'Buscar también en las texturas del juego (más lento)',
    searching: 'Revisando {done} de {total} texturas…',
    none: 'Ninguna textura usa este color.',
    rowPixels: '{count, plural, one {# píxel} other {# píxeles}}',
    include: 'Cambiar {name}',
    apply: 'Cambiar',
    applyCount: '{count, plural, one {Cambiar en # textura} other {Cambiar en # texturas}}',
    done: 'Color cambiado en {name}',
    doneMany: '{count, plural, one {Color cambiado en # textura} other {Color cambiado en # texturas}}',
    nothing: 'No hay nada que cambiar: ningún píxel tiene ese color.',
    locked: 'La capa en la que pintas está bloqueada u oculta.',
  },
};

export default ES;
