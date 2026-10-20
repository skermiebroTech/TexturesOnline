// Spanish text of the Texture Pack Maker start screen, effects and pack notes (English source: ./start.ts, ./effects.ts, ./pack.ts).

import type { TexturesLanguage } from './load';

const ES: TexturesLanguage = {
  textures: {
    version: {
      bedrockLatest: 'Bedrock (la más reciente)',
      bedrockPreview: 'Bedrock (preview)',
      bedrock: 'Bedrock {version}',
    },
    hero: {
      eyebrow: 'Texture Pack Maker',
      title: 'Haz que Minecraft se vea {your}',
      your: 'a tu manera',
      lead: 'Repinta cualquier bloque, ítem o mob, sube tus propias imágenes o cambia el estilo de todo con un clic. Funciona en Java y Bedrock.',
      otherEdition: '¿Pack para la otra edición? ',
      convertIt: 'Conviértelo',
      original: 'Original',
    },
    create: {
      title: 'Nuevo texture pack',
      text: 'Empieza con las texturas vanilla y hazlas tuyas.',
      name: 'Nombre del pack',
      namePlaceholder: 'Mi pack increíble',
      edition: 'Edición',
      javaHint: 'Para Minecraft en ordenadores con Windows, Mac y Linux.',
      bedrockHint: 'Para móviles, tablets, consolas y Windows (la versión con Marketplace).',
      gameVersion: 'Versión del juego',
      resolution: 'Resolución',
      description: 'Descripción (opcional)',
      descriptionPlaceholder: 'Hecho con Texture Pack Maker',
      button: 'Crear pack',
      defaultName: 'Mi texture pack',
      failed: 'No se pudo crear el pack',
    },
    open: {
      title: 'Abrir un pack',
      text: 'Sigue editando un pack que hiciste aquí o en cualquier otro sitio.',
      opening: 'Abriendo el pack…',
      drop: 'Suelta un pack aquí o haz clic para buscarlo',
      dropHint: '.zip para Java · .mcpack o .mcaddon para Bedrock',
      convert: 'Convertir un pack',
      convertHint: 'Java a Bedrock, Bedrock a Java u otra versión de Java',
      merge: 'Combinar packs',
      mergeHint: 'Junta varios packs en uno, el de arriba primero',
      openedTitle: 'Pack abierto',
      openedText: '«{name}» está listo para editar ({version}, {count, plural, one {# textura} other {# texturas}}). Algunas cosas que debes saber:',
      openInEditor: 'Abrir en el editor',
      opened: '«{name}» abierto',
    },
    howto: {
      title: 'Cómo funciona',
      pick: 'Elige',
      pickText: 'Explora todas las texturas vanilla: bloques, ítems, mobs, GUI y más.',
      paint: 'Pinta',
      paintText: 'Dibuja píxeles, sube imágenes o aplica efectos de un clic a todo.',
      export: 'Exporta',
      exportText: 'Consigue un pack listo para instalar en Java o Bedrock.',
    },
    recent: {
      title: 'Tus texture packs',
      savedHere: 'Guardados solo en este navegador',
      emptyTitle: 'Aún no hay packs',
      emptyText: 'Los packs que crees o abras aparecen aquí para que sigas donde lo dejaste.',
      moreActions: 'Más acciones para {name}',
      open: 'Abrir',
      rename: 'Renombrar',
      duplicate: 'Duplicar',
      delete: 'Eliminar',
      untitled: 'Sin nombre',
      edited: '{count, plural, one {# editada} other {# editadas}}',
      effects: '{count, plural, one {# efecto} other {# efectos}}',
      editedAgo: 'Editado {time}',
      renameTitle: 'Renombrar pack',
      renamed: 'Pack renombrado',
      renameFailed: 'No se pudo renombrar el pack',
      copyName: '{name} (copia)',
      copied: 'Se hizo una copia de «{name}»',
      copyFailed: 'No se pudo copiar el pack',
      deleteTitle: '¿Eliminar este pack?',
      deleteText: '«{name}» se eliminará de este navegador.',
      deleted: '«{name}» eliminado',
      undo: 'Deshacer',
      restoreFailed: 'No se pudo restaurar el pack.',
      deleteFailed: 'No se pudo eliminar el pack.',
    },
    categories: {
      block: {
        label: 'Bloques',
        short: 'Bloque',
      },
      item: {
        label: 'Ítems',
        short: 'Ítem',
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
        label: 'Cielo',
        short: 'Cielo',
      },
      painting: {
        label: 'Cuadros',
        short: 'Cuadro',
      },
      effect: {
        label: 'Efectos',
        short: 'Icono de efecto',
      },
      font: {
        label: 'Fuentes',
        short: 'Fuente',
      },
      map: {
        label: 'Mapas',
        short: 'Mapa',
      },
      colormap: {
        label: 'Mapas de color',
        short: 'Mapa de color',
      },
      misc: {
        label: 'Varios',
        short: 'Varios',
      },
      other: {
        label: 'Otros',
        short: 'Otro',
      },
    },
    resolution: {
      classic: '16× es el aspecto clásico de Minecraft: cada cara de bloque tiene 16×16 píxeles, igual que en el juego original.',
      hd: '{r}× da a cada cara de bloque {r}×{r} píxeles: {detail} el detalle. Las texturas se amplían cuando empiezas a editarlas, para que puedas añadir detalles más finos.',
      twice: 'el doble de',
      times: '{n} veces',
    },
  },
  'textures.effects': {
    effects: {
      hue: {
        label: 'Cambio de tono',
        description: 'Gira los colores en la rueda de color, todos o solo una gama.',
      },
      saturation: {
        label: 'Saturación',
        description: 'Colores más vivos o más apagados.',
      },
      brightness: {
        label: 'Brillo',
        description: 'Aclara u oscurece todas las texturas.',
      },
      contrast: {
        label: 'Contraste',
        description: 'Aumenta o reduce la diferencia entre claro y oscuro.',
      },
      temperature: {
        label: 'Temperatura',
        description: 'Balance de color cálido (naranja) o frío (azul).',
      },
      tint: {
        label: 'Tintar / colorear',
        description: 'Baña las texturas con un color o cámbiales el color por completo.',
      },
      grayscale: {
        label: 'Escala de grises',
        description: 'Quita el color.',
      },
      sepia: {
        label: 'Sepia',
        description: 'Tonos marrones de foto antigua.',
      },
      invert: {
        label: 'Invertir',
        description: 'Colores en negativo, o invierte solo claros y oscuros manteniendo los tonos.',
      },
      posterize: {
        label: 'Posterizar',
        description: 'Reduce los pasos de color para un aspecto plano y gráfico.',
      },
      pastel: {
        label: 'Pastel',
        description: 'Tonos suaves, claros y de caramelo.',
      },
      vignette: {
        label: 'Bordes y relieve',
        description: 'Oscurece los bordes de cada textura o da a los bloques un relieve 3D.',
      },
      outline: {
        label: 'Contorno',
        description: 'Dibuja una línea alrededor de ítems y formas, o un borde alrededor de cada bloque.',
      },
      noise: {
        label: 'Ruido / grano',
        description: 'Añade grano de película o textura áspera. Igual en cada fotograma de la animación.',
      },
      sharpen: {
        label: 'Enfocar',
        description: 'Detalles más nítidos y más contraste entre píxeles.',
      },
      blur: {
        label: 'Desenfoque suave',
        description: 'Suaviza las texturas. Las de bloques se difuminan sin costuras entre bordes.',
      },
      pixelate: {
        label: 'Pixelar',
        description: 'Baja la resolución a píxeles más grandes, manteniendo el tamaño y la transparencia.',
      },
      upscale: {
        label: 'Ampliación HD suave',
        description: 'Duplica o cuadruplica la resolución con un filtro de suavizado para pixel art (Scale2x/Scale3x).',
      },
      dither: {
        label: 'Tramado',
        description: 'Tramado ordenado retro con menos pasos de color.',
      },
      glow: {
        label: 'Brillo intenso',
        description: 'Las partes claras resplandecen, con un halo opcional alrededor de los ítems.',
      },
      flip: {
        label: 'Voltear',
        description: 'Refleja las texturas en horizontal y/o vertical (cada fotograma por separado).',
      },
      gradientMap: {
        label: 'Mapa de degradado',
        description: 'Sustituye los tonos oscuros, medios y claros por tres colores a tu elección.',
      },
      palette: {
        label: 'Paleta retro',
        description: 'Ajusta cada color a una paleta clásica de consola o de pixel art.',
      },
    },
    params: {
      shift: 'Desplazamiento',
      colours: 'Colores',
      amount: 'Cantidad',
      warmth: 'Calidez',
      colour: 'Color',
      mode: 'Modo',
      levels: 'Niveles',
      style: 'Estilo',
      strength: 'Intensidad',
      edgeWidth: 'Ancho del borde',
      where: 'Dónde',
      opacity: 'Opacidad',
      thickness: 'Grosor',
      includeCorners: 'Incluir esquinas',
      monochromeGrain: 'Grano monocromo',
      radius: 'Radio',
      pixelSize: 'Tamaño de píxel',
      scale: 'Escala',
      filter: 'Filtro',
      patternStrength: 'Intensidad del patrón',
      glowFromBrightness: 'Brillar a partir de',
      haloAroundShapes: 'Halo alrededor de las formas',
      flipHorizontally: 'Voltear en horizontal',
      flipVertically: 'Voltear en vertical',
      shadows: 'Sombras',
      midtones: 'Medios tonos',
      highlights: 'Luces',
      palette: 'Paleta',
      matchBy: 'Ajustar por',
      dither: 'Tramado',
    },
    hints: {
      coolDown: 'Los valores negativos enfrían las texturas',
      colourSteps: 'Pasos de color por canal',
      edgeStyles: 'Lo usan los estilos de bordes y relieve',
      corners: 'Contornea también los píxeles que se tocan en diagonal',
      halo: 'Añade luz suave en el espacio transparente junto a los píxeles claros',
      paletteDither: 'Tramado ordenado entre los colores de la paleta',
    },
    options: {
      allColours: 'Todos los colores',
      reds: 'Rojos',
      yellows: 'Amarillos',
      greens: 'Verdes',
      cyans: 'Cianes',
      blues: 'Azules',
      magentas: 'Magentas',
      softTint: 'Tinte suave',
      colorize: 'Colorear',
      multiply: 'Multiplicar',
      negative: 'Negativo (todos los canales)',
      lightnessOnly: 'Solo luminosidad (mantiene tonos)',
      softVignette: 'Viñeta suave',
      darkEdges: 'Bordes oscuros',
      bevel3d: 'Relieve 3D',
      automatic: 'Automático',
      aroundShapes: 'Alrededor de las formas',
      insideShapeEdges: 'Dentro de los bordes de la forma',
      blockBorder: 'Borde del bloque',
      smoothEdges: 'Bordes suaves (Scale2x/3x)',
      sharpPixels: 'Píxeles nítidos (vecino más cercano)',
      closestColour: 'Color más parecido',
      brightnessFew: 'Brillo (para paletas de 2 a 4 colores)',
    },
    presets: {
      darkMode: {
        label: 'Modo oscuro',
        description: 'Mundo y menús más oscuros y sombríos, con colores un poco más fríos.',
      },
      pastelDream: {
        label: 'Sueño pastel',
        description: 'Colores suaves de caramelo, claros y ligeros.',
      },
      neonOutline: {
        label: 'Contorno neón',
        description: 'Bloques oscuros con bordes cian brillantes e ítems contorneados y relucientes.',
      },
      retro8bit: {
        label: 'Retro 8 bits',
        description: 'Colores intensos ajustados a una paleta clásica de consola.',
      },
      autumn: {
        label: 'Otoño',
        description: 'Hojas naranjas y rojas con una cálida luz dorada.',
      },
      winterFrost: {
        label: 'Escarcha invernal',
        description: 'Hojas turquesa heladas, colores pálidos y una luz azul fría.',
      },
      noir: {
        label: 'Noir',
        description: 'Blanco y negro de alto contraste con grano de película.',
      },
      sepiaMemories: {
        label: 'Recuerdos en sepia',
        description: 'Tonos cálidos de foto antigua con bordes suaves.',
      },
      inverted: {
        label: 'Invertido',
        description: 'Colores de negativo fotográfico en todas partes.',
      },
      cartoon: {
        label: 'Dibujo animado',
        description: 'Colores planos y vivos con contornos de tinta oscura.',
      },
      smoothHd: {
        label: 'HD suave (2x)',
        description: 'Duplica la resolución con bordes de pixel art suavizados.',
      },
      vivid: {
        label: 'Vívido',
        description: 'Colores más ricos, más contraste y detalles más nítidos.',
      },
      goldenHour: {
        label: 'Hora dorada',
        description: 'Brillo de atardecer: cálido, luminoso y un poco soñador.',
      },
      gameBoy: {
        label: 'Game Boy',
        description: 'Cuatro tonos de verde, como la consola portátil original.',
      },
      blocks3d: {
        label: 'Bloques 3D',
        description: 'Un relieve en cada bloque para un aspecto robusto y táctil.',
      },
    },
  },
  'textures.pack': {
    notInGame: '«{file}» no es una textura de {edition, select, java {Minecraft {version}} other {esta versión de Bedrock}}, y este pack no tiene una copia.',
    emptyImage: 'La imagen está vacía.',
    soundsNotOgg: '{count, plural, one {# archivo de sonido no es Ogg Vorbis, así que Java no lo reproducirá: {files}. Sustitúyelo en Sonidos.} other {# archivos de sonido no son Ogg Vorbis, así que Java no los reproducirá: {files}. Sustitúyelos en Sonidos.}}',
  },
};

export default ES;

/** Text that is rightly the same as in English (names) */
export const SAME_AS_ENGLISH = [
  'textures:hero.eyebrow',
  'textures.effects:presets.gameBoy.label',
];
