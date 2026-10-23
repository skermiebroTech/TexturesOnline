import type { StampsLanguage } from './load';

const PT_BR: StampsLanguage = {
  'textures.stamps': {
    choose: 'Escolher um carimbo',
    current: 'Carimbo: {name}',
    title: 'Carimbos',
    presets: 'Predefinidos',
    presetsHint: 'Os predefinidos são desenhados em tons da sua cor principal.',
    yours: 'Seus carimbos',
    none: 'Você ainda não tem carimbos próprios. Selecione uma área e salve-a como carimbo.',
    names: {
      ore: 'Manchas de minério',
      cracks: 'Rachaduras',
      moss: 'Musgo',
      dither: 'Retícula',
      sparkles: 'Brilhos',
      pebbles: 'Pedrinhas',
    },
    stampName: 'Carimbo {n}',
    size: '{width} × {height}',
    save: 'Salvar a seleção como carimbo',
    saveHint: 'Primeiro selecione uma área (até 32 × 32 pixels)',
    saved: '“{name}” foi salvo como carimbo.',
    tooBig: 'Carimbos podem ter até 32 × 32 pixels. Selecione uma área menor.',
    empty: 'A seleção não tem pixels para fazer um carimbo.',
    delete: 'Excluir “{name}”',
    deleted: '“{name}” foi excluído.',
    undo: 'Desfazer',
    rotate: 'Girar o carimbo (R)',
    rotateTouch: 'Girar o carimbo',
    flipH: 'Espelhar o carimbo na horizontal (H)',
    flipHTouch: 'Espelhar o carimbo na horizontal',
    flipV: 'Espelhar o carimbo na vertical (Shift + H)',
    flipVTouch: 'Espelhar o carimbo na vertical',
    hint: 'Clique para carimbar. Segure e arraste para posicioná-lo primeiro e depois solte. O clique direito carimba a forma dele na cor secundária.',
    hintTouch: 'Toque para carimbar. Segure e arraste para posicioná-lo primeiro e depois levante o dedo.',
    kept: 'Seus carimbos ficam neste navegador, e os salvos neste pack vão junto no arquivo de projeto dele.',
  },
};

export default PT_BR;
