import type { SwapLanguage } from './load';

const PT_BR: SwapLanguage = {
  'textures.swap': {
    button: 'Trocar uma cor',
    buttonHint: 'Substitua uma cor por outra nesta textura, na seleção ou no pack inteiro',
    title: 'Trocar uma cor',
    from: 'Cor a substituir',
    to: 'Cor nova',
    exchange: 'Inverter as duas cores',
    pickFrom: 'Escolha nesta textura:',
    tolerance: 'Cores parecidas',
    toleranceHint: 'Pega também cores próximas assim. Cada uma mantém sua pequena diferença, então o sombreado continua.',
    ramp: 'Trocar a escala de tons inteira',
    rampHint: 'Os tons mais escuros e mais claros dela nesta textura vão junto e mantêm a variação de matiz.',
    rampShades: '{count, plural, one {# tom} other {# tons}}',
    where: 'Onde',
    scope: {
      texture: 'Esta textura',
      selection: 'Seleção',
      pack: 'Pack inteiro',
    },
    layersNote: 'Todas as camadas não bloqueadas da textura mudam.',
    selectionNote: 'Só a área selecionada da camada em que você pinta muda.',
    before: 'Antes',
    after: 'Depois',
    pixels: '{count, plural, =0 {Nenhum pixel muda} one {# pixel muda} other {# pixels mudam}}',
    packNote: 'Texturas do seu pack que usam a cor:',
    gameToo: 'Procurar também nas texturas do jogo (mais lento)',
    searching: 'Procurando em {done} de {total} texturas…',
    none: 'Nenhuma textura usa esta cor.',
    rowPixels: '{count, plural, one {# pixel} other {# pixels}}',
    include: 'Mudar {name}',
    apply: 'Trocar',
    applyCount: '{count, plural, one {Trocar em # textura} other {Trocar em # texturas}}',
    done: 'Cor trocada em {name}',
    doneMany: '{count, plural, one {Cor trocada em # textura} other {Cor trocada em # texturas}}',
    nothing: 'Nada para trocar: nenhum pixel tem essa cor.',
    locked: 'A camada em que você pinta está bloqueada ou oculta.',
  },
};

/** Portuguese says “pixel” and “pixels” too */
export const SAME_AS_ENGLISH = ['textures.swap:rowPixels'];

export default PT_BR;
