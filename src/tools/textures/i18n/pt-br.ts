// Brazilian Portuguese text of the Texture Pack Maker start screen, effects and pack notes (English source: ./start.ts, ./effects.ts, ./pack.ts).

import type { TexturesLanguage } from './load';

const PT: TexturesLanguage = {
  textures: {
    version: {
      bedrockLatest: 'Bedrock (mais recente)',
      bedrockPreview: 'Bedrock (prévia)',
      bedrock: 'Bedrock {version}',
    },
    hero: {
      eyebrow: 'Texture Pack Maker',
      title: 'Deixe o Minecraft {your}',
      your: 'do seu jeito',
      lead: 'Repinte qualquer bloco, item ou mob, envie suas próprias imagens ou mude o estilo de tudo com um clique. Funciona no Java e no Bedrock.',
      otherEdition: 'Pack para a outra edição? ',
      convertIt: 'Converta',
      original: 'Original',
    },
    create: {
      title: 'Novo texture pack',
      text: 'Comece com as texturas vanilla e deixe tudo com a sua cara.',
      name: 'Nome do pack',
      namePlaceholder: 'Meu pack incrível',
      edition: 'Edição',
      javaHint: 'Para Minecraft em computadores com Windows, Mac e Linux.',
      bedrockHint: 'Para celulares, tablets, consoles e Windows (a versão com Marketplace).',
      gameVersion: 'Versão do jogo',
      resolution: 'Resolução',
      description: 'Descrição (opcional)',
      descriptionPlaceholder: 'Feito com o Texture Pack Maker',
      button: 'Criar pack',
      defaultName: 'Meu texture pack',
      failed: 'Não foi possível criar o pack',
    },
    open: {
      title: 'Abrir um pack',
      text: 'Continue editando um pack feito aqui ou em qualquer outro lugar.',
      opening: 'Abrindo o pack…',
      drop: 'Solte um pack aqui ou clique para procurar',
      dropHint: '.zip para Java · .mcpack ou .mcaddon para Bedrock',
      convert: 'Converter um pack',
      convertHint: 'Java para Bedrock, Bedrock para Java ou outra versão do Java',
      merge: 'Juntar packs',
      mergeHint: 'Combine vários packs em um, o de cima primeiro',
      openedTitle: 'Pack aberto',
      openedText: '“{name}” está pronto para editar ({version}, {count, plural, one {# textura} other {# texturas}}). Algumas coisas para saber:',
      openInEditor: 'Abrir no editor',
      opened: '“{name}” aberto',
    },
    howto: {
      title: 'Como funciona',
      pick: 'Escolha',
      pickText: 'Explore todas as texturas vanilla: blocos, itens, mobs, GUI e mais.',
      paint: 'Pinte',
      paintText: 'Desenhe pixels, envie imagens ou aplique efeitos de um clique em tudo.',
      export: 'Exporte',
      exportText: 'Receba um pack pronto para instalar no Java ou no Bedrock.',
    },
    recent: {
      title: 'Seus texture packs',
      savedHere: 'Salvos só neste navegador',
      emptyTitle: 'Nenhum pack ainda',
      emptyText: 'Os packs que você criar ou abrir aparecem aqui, para continuar de onde parou.',
      moreActions: 'Mais ações para {name}',
      open: 'Abrir',
      rename: 'Renomear',
      duplicate: 'Duplicar',
      delete: 'Excluir',
      untitled: 'Sem nome',
      edited: '{count, plural, one {# editada} other {# editadas}}',
      effects: '{count, plural, one {# efeito} other {# efeitos}}',
      editedAgo: 'Editado {time}',
      renameTitle: 'Renomear pack',
      renamed: 'Pack renomeado',
      renameFailed: 'Não foi possível renomear o pack',
      copyName: '{name} (cópia)',
      copied: 'Cópia de “{name}” criada',
      copyFailed: 'Não foi possível copiar o pack',
      deleteTitle: 'Excluir este pack?',
      deleteText: '“{name}” será removido deste navegador.',
      deleted: '“{name}” excluído',
      undo: 'Desfazer',
      restoreFailed: 'Não foi possível restaurar o pack.',
      deleteFailed: 'Não foi possível excluir o pack.',
    },
    categories: {
      block: {
        label: 'Blocos',
        short: 'Bloco',
      },
      item: {
        label: 'Itens',
        short: 'Item',
      },
      entity: {
        label: 'Mobs',
        short: 'Mob',
      },
      armor: {
        label: 'Armaduras',
        short: 'Armadura',
      },
      gui: {
        label: 'GUI',
        short: 'GUI',
      },
      particle: {
        label: 'Partículas',
        short: 'Partícula',
      },
      environment: {
        label: 'Céu',
        short: 'Céu',
      },
      painting: {
        label: 'Pinturas',
        short: 'Pintura',
      },
      effect: {
        label: 'Efeitos',
        short: 'Ícone de efeito',
      },
      font: {
        label: 'Fontes',
        short: 'Fonte',
      },
      map: {
        label: 'Mapas',
        short: 'Mapa',
      },
      colormap: {
        label: 'Mapas de cor',
        short: 'Mapa de cor',
      },
      misc: {
        label: 'Diversos',
        short: 'Diversos',
      },
      other: {
        label: 'Outros',
        short: 'Outro',
      },
    },
    resolution: {
      classic: '16× é o visual clássico do Minecraft: cada face de bloco tem 16×16 pixels, igual ao jogo original.',
      hd: '{r}× dá a cada face de bloco {r}×{r} pixels, {detail} o detalhe. As texturas são ampliadas quando você começa a editá-las, para dar espaço a detalhes mais finos.',
      twice: 'o dobro de',
      times: '{n} vezes',
    },
  },
  'textures.effects': {
    effects: {
      hue: {
        label: 'Mudança de matiz',
        description: 'Gira as cores no círculo cromático, todas ou só uma faixa de cor.',
      },
      saturation: {
        label: 'Saturação',
        description: 'Cores mais vivas ou mais apagadas.',
      },
      brightness: {
        label: 'Brilho',
        description: 'Clareia ou escurece todas as texturas.',
      },
      contrast: {
        label: 'Contraste',
        description: 'Aumenta ou diminui a diferença entre claro e escuro.',
      },
      temperature: {
        label: 'Temperatura',
        description: 'Equilíbrio de cor quente (laranja) ou frio (azul).',
      },
      tint: {
        label: 'Tingir / colorir',
        description: 'Banha as texturas com uma cor ou muda a cor delas por completo.',
      },
      grayscale: {
        label: 'Tons de cinza',
        description: 'Remove a cor.',
      },
      sepia: {
        label: 'Sépia',
        description: 'Tons marrons de foto antiga.',
      },
      invert: {
        label: 'Inverter',
        description: 'Cores em negativo, ou inverte só claro e escuro mantendo os matizes.',
      },
      posterize: {
        label: 'Posterizar',
        description: 'Reduz os níveis de cor para um visual chapado e gráfico.',
      },
      pastel: {
        label: 'Pastel',
        description: 'Tons suaves, claros e cor de bala.',
      },
      vignette: {
        label: 'Bordas e relevo',
        description: 'Escurece as bordas de cada textura ou dá aos blocos um relevo 3D.',
      },
      outline: {
        label: 'Contorno',
        description: 'Desenha uma linha em volta de itens e formas, ou uma borda em volta de cada bloco.',
      },
      noise: {
        label: 'Ruído / granulação',
        description: 'Adiciona granulação de filme ou textura áspera. Igual em todos os quadros da animação.',
      },
      sharpen: {
        label: 'Nitidez',
        description: 'Detalhes mais nítidos e mais contraste entre pixels.',
      },
      blur: {
        label: 'Desfoque suave',
        description: 'Suaviza as texturas. As de blocos se desfocam sem emendas nas bordas.',
      },
      pixelate: {
        label: 'Pixelizar',
        description: 'Baixa a resolução para pixels maiores, mantendo o tamanho e a transparência.',
      },
      upscale: {
        label: 'Ampliação HD suave',
        description: 'Dobra ou quadruplica a resolução com um filtro de suavização para pixel art (Scale2x/Scale3x).',
      },
      dither: {
        label: 'Pontilhado',
        description: 'Pontilhado ordenado retrô com menos níveis de cor.',
      },
      glow: {
        label: 'Brilho intenso',
        description: 'As partes claras reluzem, com um halo opcional em volta dos itens.',
      },
      flip: {
        label: 'Espelhar',
        description: 'Espelha as texturas na horizontal e/ou na vertical (cada quadro da animação separado).',
      },
      gradientMap: {
        label: 'Mapa de gradiente',
        description: 'Troca os tons escuros, médios e claros por três cores à sua escolha.',
      },
      palette: {
        label: 'Paleta retrô',
        description: 'Ajusta cada cor a uma paleta clássica de console ou de pixel art.',
      },
    },
    params: {
      shift: 'Deslocamento',
      colours: 'Cores',
      amount: 'Quantidade',
      warmth: 'Calor',
      colour: 'Cor',
      mode: 'Modo',
      levels: 'Níveis',
      style: 'Estilo',
      strength: 'Intensidade',
      edgeWidth: 'Largura da borda',
      where: 'Onde',
      opacity: 'Opacidade',
      thickness: 'Espessura',
      includeCorners: 'Incluir cantos',
      monochromeGrain: 'Granulação monocromática',
      radius: 'Raio',
      pixelSize: 'Tamanho do pixel',
      scale: 'Escala',
      filter: 'Filtro',
      patternStrength: 'Intensidade do padrão',
      glowFromBrightness: 'Brilhar a partir de',
      haloAroundShapes: 'Halo em volta das formas',
      flipHorizontally: 'Espelhar na horizontal',
      flipVertically: 'Espelhar na vertical',
      shadows: 'Sombras',
      midtones: 'Meios-tons',
      highlights: 'Realces',
      palette: 'Paleta',
      matchBy: 'Ajustar por',
      dither: 'Pontilhado',
    },
    hints: {
      coolDown: 'Valores negativos esfriam as texturas',
      colourSteps: 'Níveis de cor por canal',
      edgeStyles: 'Usado pelos estilos de bordas e relevo',
      corners: 'Contorna também os pixels que se tocam na diagonal',
      halo: 'Adiciona luz suave no espaço transparente ao lado de pixels claros',
      paletteDither: 'Pontilhado ordenado entre as cores da paleta',
    },
    options: {
      allColours: 'Todas as cores',
      reds: 'Vermelhos',
      yellows: 'Amarelos',
      greens: 'Verdes',
      cyans: 'Cianos',
      blues: 'Azuis',
      magentas: 'Magentas',
      softTint: 'Tingimento suave',
      colorize: 'Colorir',
      multiply: 'Multiplicar',
      negative: 'Negativo (todos os canais)',
      lightnessOnly: 'Só a luminosidade (mantém os matizes)',
      softVignette: 'Vinheta suave',
      darkEdges: 'Bordas escuras',
      bevel3d: 'Relevo 3D',
      automatic: 'Automático',
      aroundShapes: 'Em volta das formas',
      insideShapeEdges: 'Dentro das bordas da forma',
      blockBorder: 'Borda do bloco',
      smoothEdges: 'Bordas suaves (Scale2x/3x)',
      sharpPixels: 'Pixels nítidos (vizinho mais próximo)',
      closestColour: 'Cor mais próxima',
      brightnessFew: 'Brilho (para paletas de 2 a 4 cores)',
    },
    presets: {
      darkMode: {
        label: 'Modo escuro',
        description: 'Mundo e menus mais escuros e sombrios, com cores um pouco mais frias.',
      },
      pastelDream: {
        label: 'Sonho pastel',
        description: 'Cores suaves de bala, claras e leves.',
      },
      neonOutline: {
        label: 'Contorno neon',
        description: 'Blocos escuros com bordas ciano brilhantes e itens contornados e reluzentes.',
      },
      retro8bit: {
        label: 'Retrô 8 bits',
        description: 'Cores fortes ajustadas a uma paleta clássica de console.',
      },
      autumn: {
        label: 'Outono',
        description: 'Folhagem laranja e vermelha com uma luz dourada e quente.',
      },
      winterFrost: {
        label: 'Geada de inverno',
        description: 'Folhas azul-petróleo geladas, cores pálidas e uma luz azul fria.',
      },
      noir: {
        label: 'Noir',
        description: 'Preto e branco de alto contraste com granulação de filme.',
      },
      sepiaMemories: {
        label: 'Memórias em sépia',
        description: 'Tons quentes de foto antiga com bordas suaves.',
      },
      inverted: {
        label: 'Invertido',
        description: 'Cores de negativo fotográfico em tudo.',
      },
      cartoon: {
        label: 'Desenho animado',
        description: 'Cores chapadas e fortes com contornos de tinta escura.',
      },
      smoothHd: {
        label: 'HD suave (2x)',
        description: 'Dobra a resolução com bordas de pixel art suavizadas.',
      },
      vivid: {
        label: 'Vívido',
        description: 'Cores mais ricas, mais contraste e detalhes mais nítidos.',
      },
      goldenHour: {
        label: 'Hora dourada',
        description: 'Brilho do pôr do sol: quente, claro e um pouco sonhador.',
      },
      gameBoy: {
        label: 'Game Boy',
        description: 'Quatro tons de verde, como o portátil original.',
      },
      blocks3d: {
        label: 'Blocos 3D',
        description: 'Um relevo em cada bloco para um visual robusto e tátil.',
      },
    },
  },
  'textures.pack': {
    notInGame: '“{file}” não é uma textura do {edition, select, java {Minecraft {version}} other {Bedrock nesta versão}}, e este pack não tem uma cópia dela.',
    emptyImage: 'A imagem está vazia.',
    soundsNotOgg: '{count, plural, one {# arquivo de som não é Ogg Vorbis, então o Java não vai tocá-lo: {files}. Substitua-o em Sons.} other {# arquivos de som não são Ogg Vorbis, então o Java não vai tocá-los: {files}. Substitua-os em Sons.}}',
  },
};

export default PT;

/** Text that is rightly the same as in English (names) */
export const SAME_AS_ENGLISH = [
  'textures:hero.eyebrow',
  'textures.effects:presets.gameBoy.label',
];
