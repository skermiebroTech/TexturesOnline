// Spanish guides (see GuideText in src/tools/guides/content.ts). Facts come from the app data
// (src/app/content/facts.ts), menu names from the Spanish (Spain) game files.

import { el, type Child, type ElNode } from '../../app/markup';
import { callout, code, ext, figure, folderTable, link, steps, strong, tabbed, uiPath } from '../../app/content/blocks';
import { F, LATEST, MIN_ENGINE, NEXT_SNAPSHOT, formatGroups, formatParts, maxFormat, mcmetaFor, mcmetaLegacy, mcmetaRange, minFormat } from '../../app/content/facts';
import type { GuideText, GuidesIndexText } from '../../tools/guides/content';
import { SHOTS } from './shots';
import { UI_ES } from './ui';
import { SKIN_PACK_LANG, SKIN_PACK_MANIFEST, SKIN_PACK_SKINS_JSON, SKIN_PACK_TREE } from '../../tools/guides/skin-pack-files';

const p = (...c: Child[]): ElNode => el('p', null, ...c);
const ul = (items: Child[]): ElNode => el('ul', { class: 'guide-list' }, items.map((i) => el('li', null, i)));
const pre = (text: string): ElNode => el('pre', { class: 'guide-code' }, el('code', null, text));
const h3 = (text: string): ElNode => el('h3', { class: 'guide-sub' }, text);
const table = (head: string[], rows: Child[][], cls = 'guide-table'): ElNode =>
  el(
    'div',
    { class: 'table-scroll' },
    el(
      'table',
      { class: cls },
      el('thead', null, el('tr', null, head.map((h) => el('th', { scope: 'col' }, h)))),
      el('tbody', null, rows.map((r) => el('tr', null, r.map((c, i) => (i === 0 ? el('th', { scope: 'row' }, c) : el('td', null, c)))))),
    ),
  );
const FOLDER = UI_ES.folderTable;
const OPTIONS = 'Opciones...';
const PACKS = 'Paquetes de recursos...';
const OPEN_FOLDER = 'Abrir carpeta de paquetes';
const VIDEO = 'Gráficos...';

export const GUIDES_INDEX: GuidesIndexText = {
  eyebrow: 'Guías',
  title: 'Guías de texture packs, skins y shaders de Minecraft',
  lead: 'Respuestas claras y comprobadas para creadores de Minecraft: cómo crear e instalar texture packs, skins y shaders en Java y Bedrock, y qué pack format necesita cada versión de Java.',
  more: ['¿Buscas instrucciones de instalación paso a paso para cada plataforma? Consulta la ', link('/help', 'guía de instalación y preguntas frecuentes'), '.'],
};

// ---------------------------------------------------------------- shared steps

const MAKE_PACK_STEPS: Child[] = [
  ['Abre el ', link('/textures', 'Texture Pack Maker'), ', ponle nombre a tu pack y elige Java o Bedrock, la versión a la que juegas y una resolución, y haz clic en ', strong('Create pack'), '.'],
  'Busca una textura con el buscador o las categorías y vuelve a pintarla en el editor de píxeles, o sube tu propio PNG.',
  'Opcional: cambia el estilo de todo el pack con efectos de un clic como Dark Mode, Pastel o Retro 8-bit.',
  ['Abre la pestaña ', strong('Pack'), ' para poner la descripción y el icono, y exporta un ', code('.zip'), ' (Java) o un ', code('.mcpack'), ' (Bedrock).'],
  ['Instala el pack en Minecraft y pruébalo. ', link('/guides/install-resource-packs', 'Cómo instalarlo'), '.'],
];

const INSTALL_JAVA_STEPS: Child[] = [
  ['Abre Minecraft Java Edition y entra en ', uiPath(OPTIONS, PACKS), '.'],
  ['Haz clic en ', uiPath(OPEN_FOLDER), '. Se abre la carpeta ', code('resourcepacks'), '.'],
  ['Suelta el ', code('.zip'), ' del pack en la carpeta (sin descomprimir). También puedes arrastrarlo a la pantalla de paquetes de recursos.'],
  ['Mueve el pack de ', strong('Disponibles'), ' a ', strong('Seleccionados'), ' con la flecha y ponlo arriba del todo si usas varios packs. Haz clic en ', strong('Hecho'), '.'],
];

const SKIN_STEPS: Child[] = [
  ['Abre el ', link('/skins', 'Skin Maker'), ' y elige un punto de partida: una skin en blanco, una plantilla por colores, un personaje inicial, un PNG que ya tengas, la skin de un jugador de Java por su nombre o una de las skins por defecto.'],
  'Elige el tipo de brazos: clásicos (4 píxeles de ancho) o delgados (3 píxeles).',
  'Pinta sobre la plantilla de 64×64 o cambia a 3D y pinta directamente sobre el modelo, ocultando partes del cuerpo para llegar a los lados de debajo. Usa el espejo para pintar los dos brazos o las dos piernas a la vez y bloquea las partes que ya hayas terminado.',
  'Dale profundidad con la capa exterior: gorros, pelo, chaquetas, mangas y perneras quedan un poco por encima del cuerpo.',
  ['Exporta un ', code('.png'), ' para Java (y una copia de 64×32 para la 1.7.10 y anteriores) o un pack de skins ', code('.mcpack'), ' para Bedrock.'],
  'Súbela: en el Minecraft Launcher (Java) o abriendo el .mcpack y eligiéndola en el Vestidor (Bedrock).',
];

const VANILLA_SHADER_STEPS: Child[] = [
  ['Abre el ', link('/shaders', 'Shader Maker'), ' y elige ', strong('Vanilla Java'), '.'],
  `Elige la versión exacta de Minecraft a la que juegas (Java 1.17 o posterior; ${LATEST} es la predeterminada).`,
  'Empieza con un preset y ajusta brillo, contraste, color, viñeta y niebla mientras se actualiza la vista previa.',
  ['Exporta el ', code('.zip'), ' e instálalo como cualquier paquete de recursos: ', uiPath(OPTIONS, PACKS, OPEN_FOLDER), '.'],
];

// ---------------------------------------------------------------- guides

const makeATexturePack: GuideText = {
  image: SHOTS.editor,
  intro: [
    p(
      'Un texture pack de Minecraft cambia las imágenes del juego (bloques, ítems, criaturas, el cielo y los menús) por las tuyas. Java Edition llama a los texture packs ',
      el('em', null, 'paquetes de recursos'),
      ': un ',
      code('.zip'),
      ' con un archivo ',
      code('pack.mcmeta'),
      ' e imágenes PNG en las mismas rutas que las originales. Bedrock usa archivos ',
      code('.mcpack'),
      ' con un ',
      code('manifest.json'),
      '. Puedes crear cualquiera de los dos en tu navegador en unos minutos.',
    ),
  ],
  quick: {
    title: 'Resumen rápido',
    items: ['Elige Java o Bedrock y la versión a la que juegas.', 'Pinta texturas, sube tus propias imágenes o aplica un efecto de un clic.', 'Exporta el pack y mételo en Minecraft.'],
  },
  howto: { name: 'Cómo crear un texture pack de Minecraft con Texture Pack Maker', steps: MAKE_PACK_STEPS },
  sections: [
    {
      id: 'step-1',
      title: 'Paso 1: crea el pack y elige tu versión',
      body: [
        p(MAKE_PACK_STEPS[0]),
        ul([
          [strong('Edición: '), 'Java Edition (PC, Mac y Linux desde el Minecraft Launcher) o Bedrock Edition (Windows, móviles, tablets y consolas). Las dos necesitan archivos distintos, así que haz un proyecto por edición. ', link('/guides/java-vs-bedrock-packs', '¿Cuál tengo?')],
          [strong('Versión: '), `Java ${LATEST} viene seleccionada por defecto; funcionan todas las versiones hasta la 1.6.1, así que puedes hacer un pack para 1.21.11, 26.2 o 1.8.9 igual de fácil. El pack recibe el `, code('pack.mcmeta'), ' correcto para esa versión.'],
          [strong('Resolución: '), '16× es el aspecto vanilla (16×16 píxeles por cara de bloque). 32× y 64× dejan sitio para más detalle; 128× o más son para packs realistas.'],
        ]),
        p('Después tu navegador descarga las texturas originales de esa versión directamente de Mojang y las guarda en tu dispositivo, así el siguiente pack empieza al instante.'),
        figure(SHOTS.newPack),
      ],
    },
    {
      id: 'step-2',
      title: 'Paso 2: busca y vuelve a pintar texturas',
      body: [
        p(MAKE_PACK_STEPS[1]),
        p(
          'Cada textura se muestra sobre su modelo 3D real: un horno enseña su frente, sus lados y su parte de arriba, las escaleras y las losas su forma, y las criaturas sus partes del cuerpo. Pinta con el lápiz, el relleno, la línea, las formas, el ruido y el selector de color, pinta en espejo y deshaz lo que quieras. La vista en mosaico muestra cómo se repite un bloque en el suelo, para que no se noten las juntas.',
        ),
        p(
          '¿Prefieres ver el bloque mientras pintas? Cambia el editor a ',
          strong('3D'),
          ' (o pulsa D) y pinta directamente sobre el modelo: cada cara pinta la textura que muestra. Arrastra el fondo o usa dos dedos para girar el bloque. Las texturas de criaturas funcionan igual: elige Mobs en la lista de texturas y oculta partes del cuerpo para llegar a los lados de debajo.',
        ),
        ul([
          'Empieza por los bloques que ves todo el rato: hierba, tierra, piedra, troncos y tablones.',
          'La hierba, las hojas, las enredaderas y el agua se guardan en gris y el juego los colorea según el bioma. Mantenlos en gris claro.',
          'Las texturas animadas, como el agua, la lava y las linternas marinas, se pueden editar fotograma a fotograma.',
        ]),
        figure(SHOTS.editor),
      ],
    },
    {
      id: 'step-3',
      title: 'Paso 3: cambia el estilo de todo el pack con un clic (opcional)',
      body: [
        p(MAKE_PACK_STEPS[2]),
        p('Los efectos se apilan entre sí y sobre tu propia pintura sin cambiarla, y se aplican a todas las texturas al exportar. Combina Autumn con Smooth HD, o Dark Mode con Neon Outline, y sigue pintando a mano.'),
        figure(SHOTS.effects),
      ],
    },
    {
      id: 'step-4',
      title: 'Paso 4: añade un icono y una descripción, y exporta',
      body: [
        p(MAKE_PACK_STEPS[3]),
        p(
          'En Java también puedes elegir un rango de compatibilidad, para que un pack cargue en varias versiones sin el aviso de «diseñado para una versión anterior». La exportación escribe todos los archivos que necesita el juego: ',
          code('pack.mcmeta'),
          ' y ',
          code('pack.png'),
          ' en Java, o ',
          code('manifest.json'),
          ' con ID únicos nuevos y ',
          code('pack_icon.png'),
          ' en Bedrock.',
        ),
        figure(SHOTS.packSettings),
        figure(SHOTS.export),
      ],
    },
    {
      id: 'step-5',
      title: 'Paso 5: instálalo y pruébalo',
      body: [
        p(MAKE_PACK_STEPS[4]),
        ul([
          ['Java: abre ', uiPath(OPTIONS, PACKS, OPEN_FOLDER), ', suelta el ', code('.zip'), ' dentro (sin descomprimir) y mueve el pack a ', strong('Seleccionados'), '. Pulsa F3 + T en el juego para recargar después de hacer cambios.'],
          ['Bedrock: abre el ', code('.mcpack'), ' y actívalo en ', uiPath('Ajustes', 'Recursos globales'), '.'],
        ]),
        p('¿Algo se ve mal? ', link('/guides/texture-pack-not-working', 'Texture pack que no funciona: soluciones'), '.'),
      ],
    },
    {
      id: 'inside',
      title: '¿Qué hay dentro de un texture pack?',
      body: [
        h3('Java Edition (.zip)'),
        ul([
          [code('pack.mcmeta'), ' en la raíz del zip (obligatorio): la descripción del pack y las versiones del juego para las que está hecho.'],
          [code('pack.png'), ' (opcional): el icono en la lista de packs. El de Minecraft mide 128×128 y se muestra a 32×32.'],
          [code('assets/minecraft/textures/…'), ': tus imágenes, con las mismas carpetas y nombres de archivo que las originales, por ejemplo ', code('assets/minecraft/textures/block/stone.png'), '. Las versiones anteriores a la 1.13 usan las carpetas ', code('blocks'), ' e ', code('items'), ' en vez de ', code('block'), ' e ', code('item'), '.'],
          ['Las texturas animadas tienen un archivo ', code('.png.mcmeta'), ' a juego junto a la imagen.'],
        ]),
        h3('Bedrock Edition (.mcpack)'),
        ul([
          [code('manifest.json'), ' en la raíz (obligatorio): el nombre, dos ID únicos, un número de versión que sube con cada actualización y la versión más antigua del juego compatible (aquí, por defecto, ', code(`"min_engine_version": ${MIN_ENGINE}`), ').'],
          [code('pack_icon.png'), ' (opcional): el icono del pack.'],
          ['Texturas en ', code('textures/'), ', por ejemplo ', code('textures/blocks/stone.png'), '. Algunas texturas vanilla son archivos ', code('.tga'), '; conserva el mismo nombre y la misma extensión que el original.'],
        ]),
        callout('tip', 'Los nombres de archivo importan', 'Minecraft solo reemplaza una textura cuando tu archivo tiene exactamente la misma ruta que el original. En Java, las rutas deben ir en minúsculas (a-z, 0-9, _ - . y /). Texture Pack Maker se encarga de esto por ti.'),
        h3('Estructura de carpetas comparada'),
        pre(
          [
            'Java: MyPack.zip',
            '├── pack.mcmeta',
            '├── pack.png',
            '└── assets/minecraft/textures/',
            '    ├── block/stone.png',
            '    └── item/diamond_sword.png',
            '',
            'Bedrock: MyPack.mcpack',
            '├── manifest.json',
            '├── pack_icon.png',
            '└── textures/',
            '    ├── blocks/stone.png',
            '    └── items/diamond_sword.png',
          ].join('\n'),
        ),
        table(
          ['', 'pack.mcmeta de Java', 'manifest.json de Bedrock'],
          [
            ['Obligatorio', 'Sí, en la raíz del zip', 'Sí, en la raíz del .mcpack'],
            ['Identifica el pack por', 'Su nombre de archivo o carpeta', 'Dos ID únicos (UUID)'],
            ['Versión del juego', `Números de pack format (${LATEST} usa ${F(LATEST)})`, [code('min_engine_version'), ', la versión más antigua compatible']],
            ['Actualizaciones', 'Reemplazar el archivo', 'Subir el número de versión y mantener los ID'],
          ],
        ),
      ],
    },
    {
      id: 'mcmeta',
      title: 'El archivo pack.mcmeta (Java)',
      body: [
        p('Este archivo le dice a Minecraft para qué versiones es el pack. El número de formato cambia en casi cada actualización: Java ', LATEST, ' usa el formato de paquete de recursos ', strong(F(LATEST)), '. Un pack hecho solo para ', LATEST, ' tiene este aspecto:'),
        pre(mcmetaFor(LATEST, `Mi pack para Minecraft ${LATEST}`)),
        p(
          'Desde la 1.21.9 los packs indican un rango con ',
          code('min_format'),
          ' y ',
          code('max_format'),
          '. Un pack que también tenga que cargar en versiones anteriores necesita además ',
          code('pack_format'),
          ' y ',
          code('supported_formats'),
          '. Texture Pack Maker escribe la combinación correcta para la versión y el rango que elijas. Mira ',
          link('/guides/minecraft-pack-format-versions', 'el pack format de cada versión'),
          '.',
        ),
        callout('warn', '¿Falta la descripción?', `En Java ${LATEST}, un pack cuyo pack.mcmeta no tiene descripción, o no es JSON válido, ni siquiera aparece en la lista. Deja pack.mcmeta en la raíz del zip, no dentro de una carpeta.`),
      ],
    },
    {
      id: 'by-hand',
      title: 'Crear un texture pack a mano',
      body: [
        p('También puedes montar un pack tú mismo con cualquier editor de imágenes. Lleva más tiempo, pero enseña cómo funciona un pack:'),
        h3('Java Edition'),
        steps([
          ['Busca las texturas originales: copia ', code('versions/<version>/<version>.jar'), ' de tu carpeta ', code('.minecraft'), ', cambia la extensión de la copia a ', code('.zip'), ' y ábrela. Las imágenes están en ', code('assets/minecraft/textures'), '.'],
          ['Crea una carpeta nueva para tu pack con un ', code('pack.mcmeta'), ' (ver abajo) y las mismas carpetas ', code('assets/minecraft/textures/…'), ' que las originales.'],
          'Copia solo los PNG que quieras cambiar y edítalos, manteniendo sus nombres y tamaños proporcionales (16×16, 32×32, etc.).',
          ['Comprime el ', strong('contenido'), ' de la carpeta, no la carpeta en sí, para que ', code('pack.mcmeta'), ' quede en la raíz del zip. Suelta el zip en ', code('resourcepacks'), '.'],
        ]),
        h3('Bedrock Edition'),
        steps([
          ['Consigue las texturas originales del repositorio ', ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'), ' de Mojang (', code('resource_pack/textures'), ').'],
          ['Crea una carpeta con un ', code('manifest.json'), ' que tenga dos ID únicos nuevos (UUID) y tus imágenes editadas en ', code('textures/'), '.'],
          ['Comprime el contenido de la carpeta, cambia la extensión de ', code('.zip'), ' a ', code('.mcpack'), ' y ábrelo para importarlo.'],
        ]),
        callout('tip', 'Ahórrate el trabajo pesado', 'Texture Pack Maker se encarga de copiar, de los nombres de carpeta, del pack.mcmeta, de los UUID y de comprimir, y te muestra cada textura sobre su modelo 3D mientras pintas.'),
      ],
    },
    {
      id: 'tips',
      title: 'Consejos para un buen pack',
      body: [
        ul([
          'Empieza poco a poco: vuelve a pintar unos cuantos bloques que ves todo el rato (hierba, tierra, piedra, madera) y pruébalos en el juego antes de hacerlo todo.',
          'Mantén la misma resolución en todo el pack. Mezclar texturas de 16× y 64× queda desigual.',
          'Usa la vista previa 3D del bloque para ver cómo encajan sus lados.',
          'Usa la vista en mosaico en los bloques que se repiten, para que no se noten las juntas.',
          'Pon tu pack arriba del todo en la lista de seleccionados. Los packs de más arriba ganan.',
        ]),
      ],
    },
  ],
  faq: [
    {
      id: 'both',
      q: '¿Un mismo texture pack funciona en Java y en Bedrock?',
      a: [p('No. Las dos ediciones usan archivos y carpetas distintos. Haz el pack para una edición y luego pásalo a la otra con el ', link('/texture-pack-converter', 'convertidor de texture packs'), '. ', link('/guides/java-vs-bedrock-packs', 'Packs de Java vs Bedrock'), '.')],
    },
    {
      id: 'free',
      q: '¿Tengo que instalar algún programa?',
      a: [p('No. Texture Pack Maker funciona en el navegador de tu ordenador, móvil o tablet, y no se sube nada.')],
    },
    {
      id: 'edit',
      q: '¿Puedo cambiar un texture pack que ya existe?',
      a: [p('Sí. En Texture Pack Maker elige ', strong('Open a pack'), ' y selecciona un ', code('.zip'), ' o un ', code('.mcpack'), '. Puedes seguir editándolo y exportarlo de nuevo.'), figure(SHOTS.openPack)],
    },
    {
      id: 'code',
      q: '¿Necesito saber programar para crear un texture pack?',
      a: [p('No. Un texture pack son imágenes y un pequeño archivo de descripción, y Texture Pack Maker escribe ese archivo por ti. Solo tienes que pintar.')],
    },
    {
      id: 'older',
      q: '¿Cómo creo un texture pack para una versión antigua, como la 1.21.11 o la 1.8.9?',
      a: [p('Elige esa versión al crear el pack. La herramienta carga las texturas y los nombres de carpeta de esa versión y escribe su pack format. ', link('/guides/minecraft-pack-format-versions', 'Pack format de cada versión'), '.')],
    },
    {
      id: 'originals',
      q: '¿Dónde encuentro las texturas originales de Minecraft?',
      a: [p('Dentro del archivo ', code('.jar'), ' del juego en Java (', code('assets/minecraft/textures'), ') y en el repositorio bedrock-samples de Mojang en Bedrock. Texture Pack Maker las descarga de Mojang por ti cuando eliges una versión.')],
    },
    {
      id: 'mobile',
      q: '¿Puedo crear un texture pack en el móvil?',
      a: [p('Sí. Texture Pack Maker funciona en el navegador en Android, iPhone y iPad, igual que en ordenadores y Chromebooks. En Bedrock, abre el ', code('.mcpack'), ' exportado y Minecraft lo importa.')],
    },
    {
      id: 'time',
      q: '¿Cuánto se tarda en crear un texture pack?',
      a: [p('Unos minutos para un pack pequeño que cambia unos pocos bloques, o para un efecto para todo el pack como Dark Mode. Un pack completo pintado a mano con cientos de texturas puede llevar semanas; puedes exportarlo y probarlo en cualquier momento.')],
    },
    {
      id: 'hd',
      q: '¿Qué resolución debería tener mi texture pack?',
      a: [p('16× es como el juego vanilla y lo más rápido de pintar. 32× y 64× dejan sitio para más detalle; 128× o más son para packs realistas y necesitan un ordenador más potente. Usa una sola resolución en todo el pack.')],
    },
  ],
  ctaLabel: 'Abrir Texture Pack Maker',
};

const notWorking: GuideText = {
  image: SHOTS.packSettings,
  intro: [
    p(
      'La mayoría de los problemas con texture packs vienen de tres cosas: falta el archivo de descripción del pack (',
      code('pack.mcmeta'),
      ' en Java, ',
      code('manifest.json'),
      ' en Bedrock) o está en otro sitio, el pack se hizo para otra versión del juego, o una textura no está exactamente en la ruta que busca Minecraft. Busca abajo lo que ves y aplica la solución.',
    ),
  ],
  quick: {
    title: 'Revisa esto primero',
    items: [
      ['Java: al abrir el zip se ven directamente ', code('pack.mcmeta'), ' y ', code('assets'), ', no una carpeta.'],
      'El pack se hizo para la versión a la que juegas (o su rango de compatibilidad la incluye).',
      'El pack está en la lista de seleccionados (Java) o de activos (Bedrock), por encima de packs que cambian las mismas texturas.',
      'Los nombres de archivo y las carpetas coinciden exactamente con los originales, en minúsculas en Java.',
    ],
  },
  sections: [
    {
      id: 'not-listed',
      title: 'El pack no sale en la lista',
      body: [
        p('Java solo muestra un pack cuando encuentra un ', code('pack.mcmeta'), ' válido en la raíz del zip o de la carpeta.'),
        ul([
          [strong('Carpeta dentro de otra: '), 'si comprimes la propia carpeta del pack, todo queda un nivel más abajo (', code('MyPack.zip/MyPack/pack.mcmeta'), '). Comprime el contenido de la carpeta.'],
          [strong('pack.mcmeta roto: '), `una coma o unas comillas que faltan lo convierten en JSON no válido. En Java ${LATEST}, un pack sin descripción tampoco aparece.`],
          [strong('Carpeta equivocada: '), 'el zip tiene que estar en ', code('resourcepacks'), ', no en ', code('shaderpacks'), ' ni en ', code('mods'), '. Usa ', uiPath(OPTIONS, PACKS, OPEN_FOLDER), ' para abrir la correcta.'],
          [strong('Descarga a medias o bloqueada: '), 'a veces los navegadores guardan un archivo descargado a medias como ', code('.crdownload'), ' o ', code('.part'), '. Descarga el pack otra vez.'],
        ]),
      ],
    },
    {
      id: 'version',
      title: '«Diseñado para una versión de Minecraft anterior / posterior»',
      body: [
        p(
          'Java compara el pack format de ',
          code('pack.mcmeta'),
          ' con el suyo (',
          LATEST,
          ' usa ',
          strong(F(LATEST)),
          '). Un pack que solo cambia texturas suele funcionar igual si pulsas ',
          strong('Sí'),
          ', pero las texturas que faltan o cambiaron de nombre pueden verse mal. La solución limpia es exportar el pack de nuevo para tu versión, o darle un rango de compatibilidad que la incluya. Para un pack antiguo que no hiciste tú, el ',
          link('/texture-pack-converter', 'convertidor de texture packs'),
          ' renombra sus texturas para tu versión y escribe un pack.mcmeta nuevo.',
        ),
        p(
          'Desde la 1.21.9, un pack que solo tiene un número ',
          code('pack_format'),
          ', o campos que rompen las reglas nuevas, puede aparecer como ',
          el('em', null, 'roto o incompatible'),
          '. Los packs nuevos usan ',
          code('min_format'),
          ' y ',
          code('max_format'),
          '. ',
          link('/guides/minecraft-pack-format-versions', 'El pack format de cada versión'),
          '.',
        ),
        figure(SHOTS.packSettings),
      ],
    },
    {
      id: 'purple',
      title: 'Bloques morados y negros',
      body: [
        p(
          'El tablero morado y negro es la «textura que falta». Un modelo pide una imagen que no existe en esa ruta: el archivo se renombró, está en otra carpeta o el pack usa nombres de carpeta de otra versión. Por ejemplo, las versiones anteriores a la 1.13 usan ',
          code('textures/blocks'),
          ' y ',
          code('textures/items'),
          ', mientras que la 1.13 y posteriores usan ',
          code('textures/block'),
          ' y ',
          code('textures/item'),
          '.',
        ),
        p('Si añadiste modelos propios, revisa cada ruta de textura dentro de ellos. Los packs hechos con Texture Pack Maker usan las rutas exactas de la versión que elegiste.'),
      ],
    },
    {
      id: 'some-textures',
      title: 'Solo cambiaron algunas texturas',
      body: [
        ul([
          [strong('El nombre o la ruta difieren en una letra: '), 'el archivo debe tener exactamente el mismo nombre y la misma carpeta que el original. Java ignora las rutas con mayúsculas o espacios.'],
          [strong('Gana otro pack: '), 'los packs de más arriba en la lista reemplazan las mismas texturas. Mueve el tuyo arriba del todo, o junta los packs en uno con ', link('/merge-texture-packs', 'Combinar texture packs'), ', en el orden que quieras.'],
          [strong('Archivo equivocado para ese bloque: '), 'algunos bloques usan varias imágenes (el frente, el lado y la parte de arriba del horno; la parte de arriba, el lado y la capa lateral del bloque de hierba). Edítalas todas, o usa la vista previa 3D para ver qué imagen va en cada sitio.'],
          [strong('Tipo de imagen equivocado en Bedrock: '), 'algunas texturas vanilla de Bedrock son archivos ', code('.tga'), '. Conserva el mismo nombre y tipo de archivo que el original para que el tuyo lo reemplace.'],
        ]),
      ],
    },
    {
      id: 'grey',
      title: 'La hierba y las hojas se ven grises',
      body: [
        p(
          'En el archivo de imagen es normal. La hierba, las hojas, las enredaderas, el agua y algunas texturas más se guardan en gris y el juego las colorea según el bioma, así que píntalas en grises claros y revísalas en el juego. Si las pintas de verde, se verán mucho más oscuras o con colores raros cuando el juego las tiña.',
        ),
      ],
    },
    {
      id: 'animation',
      title: 'Una textura animada se ve como una tira larga',
      body: [
        p(
          'Las texturas animadas son una imagen alta con los fotogramas apilados uno sobre otro, más un archivo ',
          code('.png.mcmeta'),
          ' con el mismo nombre (por ejemplo ',
          code('sea_lantern.png.mcmeta'),
          '). Sin ese archivo, Java aplasta toda la tira en un bloque. Bedrock enumera las texturas animadas en ',
          code('textures/flipbook_textures.json'),
          '. Texture Pack Maker escribe estos archivos cuando editas fotogramas de animación.',
        ),
      ],
    },
    {
      id: 'all-off',
      title: 'Se desactivaron todos mis paquetes de recursos (Java)',
      body: [
        p(
          'Cuando un paquete de recursos contiene un shader que no compila, Java desactiva todos los packs y vuelve a los valores por defecto. Pasa con shader packs vanilla hechos para otra versión, porque Mojang cambia a menudo esos archivos de shaders. Quita el pack o expórtalo de nuevo para tu versión exacta; cada shader que escribe el ',
          link('/shaders', 'Shader Maker'),
          ' se comprueba antes al compilar.',
        ),
      ],
    },
    {
      id: 'bedrock-import',
      title: 'Bedrock: la importación falló',
      body: [
        ul([
          [strong('Error al importar: '), 'falta ', code('manifest.json'), ', no es válido o no está en la raíz del archivo. Exporta el pack de nuevo y abre el archivo nuevo.'],
          [strong('Pack duplicado: '), 'ya hay instalado un pack con los mismos ID y el mismo número de versión. Sube la versión (Texture Pack Maker lo hace en cada exportación) o borra la copia antigua en ', uiPath('Ajustes', 'Almacenamiento'), '.'],
          [strong('Tipo de archivo equivocado: '), 'un ', code('.zip'), ' de Java renombrado a ', code('.mcpack'), ' no funciona; Bedrock necesita sus propios archivos y carpetas. Conviértelo con el ', link('/texture-pack-converter', 'convertidor de texture packs'), '.'],
          [strong('Consola: '), 'Xbox, PlayStation y Switch no pueden importar archivos. Entra en un mundo, Realm o servidor que lleve el pack.'],
        ]),
      ],
    },
    {
      id: 'bedrock-nothing',
      title: 'Bedrock: importado, pero no cambia nada',
      body: [
        ul([
          ['Actívalo: ', uiPath('Ajustes', 'Recursos globales', 'Mis packs'), ', selecciona el pack y pulsa ', strong('Activar'), '. Para un solo mundo, usa ', uiPath('Editar mundo', 'Paquetes de recursos'), '.'],
          'Ponlo por encima de otros packs activos que cambien las mismas texturas.',
          ['Si el pack necesita un juego más nuevo que el tuyo, su ', code('min_engine_version'), ' es demasiado alta: actualiza Minecraft o exporta con un mínimo más bajo.'],
          'Los packs hechos para los gráficos clásicos pueden verse distintos, o desactivarse, con Visuales vibrantes. Prueba a cambiar el modo de gráficos.',
        ]),
      ],
    },
    {
      id: 'shaders',
      title: 'Un shader pack no aparece',
      body: [
        ul([
          ['Los shader packs de Iris y OptiFine van en la carpeta ', code('shaderpacks'), ', que se abre desde ', uiPath(OPTIONS, VIDEO, 'Shader Packs...'), ', no en ', code('resourcepacks'), '.'],
          ['Iris necesita OpenGL. En Java 26.2 y posteriores, pon ', strong('API de gráficos'), ' en ', strong('Por defecto'), ' u ', strong('OpenGL'), ' si Iris dice que no puede funcionar con Vulkan.'],
          ['Los shader packs vanilla (sin mods) son paquetes de recursos y solo funcionan en la versión para la que se hicieron. ', link('/guides/make-shaders-without-mods', 'Shaders sin mods'), '.'],
        ]),
      ],
    },
  ],
  faq: [
    {
      id: 'why-red',
      q: '¿Por qué mi texture pack sale en rojo en la lista de paquetes de recursos?',
      a: [p('El rojo significa que el formato del pack no coincide con tu versión del juego. Puede funcionar igual; expórtalo de nuevo para tu versión para ir sobre seguro.')],
    },
    {
      id: 'reload',
      q: '¿Tengo que reiniciar Minecraft después de cambiar un pack?',
      a: [p('No. En Java pulsa F3 + T para recargar los paquetes de recursos, o desactiva y vuelve a activar el pack. En Bedrock, sal del mundo y vuelve a entrar.')],
    },
    {
      id: 'server',
      q: '¿Por qué un servidor cambia mis texturas?',
      a: [p('Los servidores pueden enviar su propio paquete de recursos, que queda por encima del tuyo. Puedes rechazarlo en los ajustes del servidor en la pantalla de multijugador, aunque algunos servidores lo exigen.')],
    },
  ],
  ctaLabel: 'Abrir Texture Pack Maker',
};

const install: GuideText = {
  intro: [
    p(
      'En ',
      strong('Java'),
      ', pon el ',
      code('.zip'),
      ' del pack en la carpeta ',
      code('resourcepacks'),
      ' y actívalo en Opciones › Paquetes de recursos. En ',
      strong('Bedrock'),
      ', abre el archivo ',
      code('.mcpack'),
      ' y Minecraft lo importa; luego actívalo en Ajustes › Recursos globales. Los shader packs para Java necesitan Iris u OptiFine.',
    ),
  ],
  quick: {
    title: 'Respuesta rápida',
    items: [
      ['Java: ', uiPath(OPTIONS, PACKS, OPEN_FOLDER), ', suelta el ', code('.zip'), ' dentro, mueve el pack a Seleccionados y haz clic en Hecho.'],
      ['Bedrock: abre el archivo ', code('.mcpack'), ' y actívalo en ', uiPath('Ajustes', 'Recursos globales'), '.'],
      ['Shaders (Java): instala Iris u OptiFine y pon el zip del shader en la carpeta ', code('shaderpacks'), '.'],
    ],
  },
  howto: { name: 'Cómo instalar un paquete de recursos en Minecraft Java Edition', steps: INSTALL_JAVA_STEPS },
  sections: [
    {
      id: 'java',
      title: 'Instalar un paquete de recursos en Java',
      body: [steps(INSTALL_JAVA_STEPS), h3('¿Dónde está la carpeta resourcepacks?'), folderTable('resourcepacks', FOLDER)],
    },
    {
      id: 'order',
      title: 'Usar más de un pack',
      body: [
        p(
          'Puedes activar todos los packs que quieras. Cuando dos packs cambian la misma textura, gana el que está más arriba en la lista de ',
          strong('Seleccionados'),
          ' (Java) o de activos (Bedrock), y todo lo que no cambia pasa a los packs de debajo. Una configuración típica es un pack pequeño con tus propios retoques arriba y un pack completo debajo.',
        ),
        p('Para convertir esa pila en un solo pack, para compartirlo o para un servidor que envía un único paquete de recursos, usa ', link('/merge-texture-packs', 'Combinar texture packs'), ': sigue la misma regla, así que gana el pack de arriba de su lista.'),
        p('Los launchers de terceros como Lunar Client y Badlion Client usan por defecto la misma carpeta ', code('resourcepacks'), ' dentro de ', code('.minecraft'), ' y tienen su propio menú de paquetes de recursos para activarlos.'),
      ],
    },
    {
      id: 'bedrock',
      title: 'Instalar un .mcpack en Bedrock',
      body: [
        tabbed(
          'install-bedrock',
          [
            {
              value: 'windows',
              label: 'Windows',
              icon: 'monitor',
              content: [
                steps([
                  ['Haz doble clic en el ', code('.mcpack'), '. Minecraft se abre y muestra ', el('em', null, 'Importación iniciada...'), ' y después que se importó con éxito.'],
                  ['Ve a ', uiPath('Ajustes', 'Recursos globales', 'Mis packs'), ', selecciona el pack y pulsa ', strong('Activar'), '.'],
                ]),
              ],
            },
            {
              value: 'mobile',
              label: 'Android e iOS',
              icon: 'smartphone',
              content: [
                steps([
                  ['Descarga el ', code('.mcpack'), ' en el móvil o la tablet.'],
                  [strong('Android: '), 'ábrelo desde Descargas o la app de archivos y elige Minecraft. ', strong('iPhone / iPad: '), 'tócalo en la app Archivos y luego ', uiPath('Compartir', 'Minecraft'), '.'],
                  ['Actívalo en ', uiPath('Ajustes', 'Recursos globales'), '.'],
                ]),
              ],
            },
            {
              value: 'console',
              label: 'Consolas',
              icon: 'gamepad',
              content: [p('Xbox, PlayStation y Switch no pueden importar archivos. Añade el pack a un mundo en un PC o un móvil y entra en ese mundo, o juega en un Realm o servidor que lo incluya.')],
            },
          ],
          UI_ES.platform,
        ),
        callout('tip', '¿Solo un mundo?', 'Abre ', uiPath('Editar mundo', 'Paquetes de recursos'), ' y activa el pack ahí en vez de en Recursos globales.'),
      ],
    },
    {
      id: 'shaders',
      title: 'Instalar un shader pack',
      body: [
        ul([
          [strong('Iris (Java):'), ' instala Iris con el instalador de ', ext('https://www.irisshaders.dev/', 'irisshaders.dev'), ', juega una vez con el perfil de Iris y luego abre ', uiPath(OPTIONS, VIDEO, 'Shader Packs...'), ', haz clic en ', strong('Abrir carpeta de Shader Packs...'), ' y suelta el zip dentro.'],
          [strong('OptiFine (Java):'), ' ', uiPath(OPTIONS, VIDEO, 'Shaders...'), ' y luego ', strong('Carpeta de shaders'), '.'],
          [strong('Shaders vanilla (Java, sin mods):'), ' son paquetes de recursos. Instálalos en la carpeta ', code('resourcepacks'), ' como cualquier otro pack.'],
          [strong('Visuales vibrantes (Bedrock):'), ' abre el ', code('.mcpack'), ', actívalo y luego pon ', uiPath('Ajustes', 'Vídeo', 'Modo de gráficos'), ' en Visuales vibrantes.'],
        ]),
        folderTable('shaderpacks', FOLDER),
      ],
    },
    {
      id: 'skins',
      title: 'Instalar una skin',
      body: [
        ul([
          [strong('Java:'), ' Minecraft Launcher › Aspectos › Nuevo aspecto, elige Clásico o Delgado, busca el PNG y haz clic en Guardar y usar. O súbela en tu perfil de minecraft.net.'],
          [strong('Bedrock:'), ' abre un pack de skins ', code('.mcpack'), ' y elige la skin en Vestidor › Aspectos clásicos, o importa ahí un solo PNG.'],
        ]),
        p('Más detalles en ', link('/guides/make-a-skin', 'Cómo hacer tu propia skin de Minecraft'), '.'),
      ],
    },
    {
      id: 'troubleshooting',
      title: '¿No funciona el pack?',
      body: [
        p('Abajo están los problemas más comunes. ', link('/guides/texture-pack-not-working', 'Todas las soluciones, con explicaciones'), '.'),
        table(
          ['Lo que ves', 'Por qué', 'Solución'],
          [
            ['«Diseñado para una versión de Minecraft anterior / posterior»', 'El pack format de pack.mcmeta no es el de tu juego.', 'Exporta de nuevo para tu versión o amplía el rango de compatibilidad. Los packs que solo cambian texturas suelen funcionar si pulsas Sí.'],
            ['«Roto o incompatible» (Java 1.21.9+)', 'pack.mcmeta solo tiene pack_format, o sus campos rompen las reglas.', 'Vuelve a exportar desde Texture Pack Maker, que escribe min_format y max_format.'],
            ['El pack no aparece en la lista', 'Falta pack.mcmeta, no está en la raíz del zip, no es JSON válido o no tiene descripción.', 'Asegúrate de que al abrir el zip se ven directamente pack.mcmeta y assets, no una carpeta.'],
            ['Bedrock dice que la importación falló', 'Falta manifest.json, no está en la raíz del archivo o no es válido.', 'Exporta de nuevo como .mcpack y abre el archivo nuevo.'],
            ['El pack de Bedrock no cambia nada', 'Otro pack por encima reemplaza las mismas texturas.', 'Mueve tu pack arriba del todo en la lista de activos.'],
          ],
        ),
      ],
    },
  ],
  faq: [
    {
      id: 'unzip',
      q: '¿Tengo que descomprimir un paquete de recursos?',
      a: [p('No. Java carga los packs comprimidos directamente. Una carpeta descomprimida también funciona si pack.mcmeta está justo dentro, pero dejar el zip es más sencillo.')],
    },
    {
      id: 'order',
      q: '¿Qué pack gana cuando dos cambian la misma textura?',
      a: [p('El que está más arriba en la lista de seleccionados (Java) o de activos (Bedrock). ', link('/merge-texture-packs', 'Combinar texture packs'), ' usa el mismo orden para juntar varios packs en uno.')],
    },
    {
      id: 'realms',
      q: '¿Los jugadores de consola pueden usar packs personalizados?',
      a: [p('No importando archivos. Pueden entrar en un mundo, Realm o servidor que lleve el pack.')],
    },
  ],
  ctaLabel: 'Guía de instalación completa para cada plataforma',
};

const packFormats: GuideText = {
  intro: [
    p(
      'Cada paquete de recursos de Java Edition indica un ',
      strong('pack format'),
      ' en su archivo ',
      code('pack.mcmeta'),
      ', y Minecraft lo compara con el suyo para decidir si el pack encaja. ',
      strong(`Minecraft Java ${LATEST} usa el formato de paquete de recursos ${F(LATEST)}.`),
      ' Los paquetes de recursos llegaron en la 1.6.1; las versiones anteriores usaban texture packs, que funcionan de otra manera.',
    ),
  ],
  quick: {
    title: `Respuesta rápida: Minecraft ${LATEST}`,
    items: [
      ['Formato de paquete de recursos: ', strong(F(LATEST)), '.'],
      ['En ', code('pack.mcmeta'), ' escribe ', code(`"min_format": ${minFormat(LATEST)}`), ' y ', code(`"max_format": ${maxFormat(LATEST)}`), ' (desde la 1.21.9 el formato se divide en un número principal y uno secundario).'],
      ['Un pack que también sea para versiones anteriores necesita además ', code('pack_format'), ' y ', code('supported_formats'), '. La tabla de abajo enumera todas las versiones.'],
    ],
  },
  sections: [
    {
      id: 'table',
      title: 'Formato de paquete de recursos de cada versión de Java',
      body: [
        p('Todas las versiones completas de 1.6.1 a ', LATEST, '. Las snapshots, pre-releases y release candidates tienen sus propios números.'),
        table(
          ['Pack format', 'Versiones de Minecraft Java'],
          formatGroups()
            .reverse()
            .map((g) => [g.format, g.versions.join(', ')]),
          'guide-table formats-table',
        ),
        p(
          'Desde el ciclo de la 1.21.9, un formato también puede tener un número secundario: ',
          F(LATEST),
          ` significa principal ${formatParts(LATEST).major}, secundario ${formatParts(LATEST).minor}. Mojang sube el número secundario con añadidos que no rompen los packs anteriores. Al escribir esto, la primera snapshot de la ${NEXT_SNAPSHOT.version} usa ${NEXT_SNAPSHOT.format}.`,
        ),
      ],
    },
    {
      id: 'eras',
      title: 'Cómo ha cambiado pack.mcmeta',
      body: [
        table(
          ['Versiones del juego', 'Campos que lee el juego'],
          [
            ['1.6.1 – 1.8.7', [code('pack_format'), ' y ', code('description'), '. No hay ninguna comprobación de versión, así que carga cualquier número.']],
            ['1.8.8 – 1.20.1', ['Solo ', code('pack_format'), '. El pack se considera compatible si coincide con el número del juego; si no, Minecraft avisa pero deja usarlo.']],
            ['1.20.2 – 1.21.8', [code('pack_format'), ' (obligatorio) más un rango opcional ', code('supported_formats'), ' como ', code('[15, 64]'), '.']],
            [`1.21.9 – ${LATEST}`, [code('min_format'), ' y ', code('max_format'), ' (obligatorios juntos). Un pack cuyo rango llega hasta el formato 64 o menos también tiene que llevar ', code('pack_format'), ' y ', code('supported_formats'), '; un pack solo para 1.21.9+ no debe usar ', code('supported_formats'), '.']],
          ],
        ),
      ],
    },
    {
      id: 'examples',
      title: 'Ejemplos',
      body: [
        h3(`Solo Java ${LATEST}`),
        pre(mcmetaFor(LATEST, `Mi pack para Minecraft ${LATEST}`)),
        p('Un número solo en ', code('max_format'), ` significa «cualquier versión secundaria», así que ${maxFormat(LATEST)} cubre ${maxFormat(LATEST)}.0 y ${F(LATEST)}. Escribir `, code(`[${maxFormat(LATEST)}, 0]`), ` ahí haría que el pack fuera demasiado antiguo para ${LATEST}.`),
        h3(`De 1.20.1 a ${LATEST}`),
        pre(mcmetaRange('1.20.1', LATEST, `Mi pack para Minecraft 1.20.1 - ${LATEST}`)),
        p('La 1.20.1 lee ', code('pack_format'), ', de la 1.20.2 a la 1.21.8 leen ', code('supported_formats'), ' y la 1.21.9 y posteriores leen ', code('min_format'), ' y ', code('max_format'), '.'),
        h3('Solo 1.20.1 (y 1.20)'),
        pre(mcmetaLegacy('1.20.1', 'Mi pack para Minecraft 1.20.1')),
        callout('tip', 'Deja que lo haga la herramienta', 'En Texture Pack Maker, elige tu versión y, si quieres, un rango de compatibilidad en la pestaña Pack. La exportación lleva exactamente los campos que necesita cada versión.'),
      ],
    },
    {
      id: 'bedrock',
      title: '¿Y Bedrock?',
      body: [
        p(
          'Los packs de Bedrock no tienen número de pack format. Su ',
          code('manifest.json'),
          ' usa ',
          code('"format_version": 2'),
          ' y una ',
          code('min_engine_version'),
          ' como ',
          code(MIN_ENGINE),
          '. Los números de versión de Bedrock ahora siguen el año (la 26.0 salió en febrero de 2026), pero los manifiestos mantienen el estilo antiguo, así que la 26.50 se escribe ',
          code('[1, 26, 50]'),
          '.',
        ),
      ],
    },
  ],
  faq: [
    {
      id: 'latest',
      q: `¿Cuál es el formato de paquete de recursos de Minecraft ${LATEST}?`,
      a: [p(`${F(LATEST)}. Escribe "min_format": ${minFormat(LATEST)} y "max_format": ${maxFormat(LATEST)} en pack.mcmeta para un pack solo de ${LATEST}.`)],
    },
    {
      id: '1211',
      q: '¿Qué pack format usan la 1.21.1 y la 1.20.1?',
      a: [p(`La 1.21 y la 1.21.1 usan ${F('1.21.1')}; la 1.20 y la 1.20.1 usan ${F('1.20.1')}. La 1.8.9 y las versiones 1.x anteriores desde la 1.6.1 usan ${F('1.8.9')}.`)],
    },
    {
      id: 'broken',
      q: '¿Por qué mi pack dice «Roto o incompatible»?',
      a: [p('En la 1.21.9 y posteriores, un pack con solo un pack_format alto (más de 64) y sin min_format / max_format no pasa la comprobación. Se puede activar igual, pero es mejor añadir los dos campos.')],
    },
  ],
  ctaLabel: 'Crear un pack con el formato correcto',
};

const makeASkin: GuideText = {
  image: SHOTS.skin2d,
  intro: [
    p(
      'Una skin de Minecraft es una imagen PNG de 64×64 píxeles que envuelve el modelo del jugador. Puedes diseñar una en tu navegador: pinta sobre la plantilla, revísala en un modelo 3D y súbela en el Minecraft Launcher (Java) o impórtala como pack de skins (Bedrock).',
    ),
  ],
  quick: {
    title: 'Resumen rápido',
    items: ['Abre el Skin Maker y elige una plantilla o una skin inicial.', 'Píntala mirando la vista previa 3D.', 'Exporta un PNG para Java o un .mcpack para Bedrock y súbelo.'],
  },
  howto: { name: 'Cómo hacer una skin de Minecraft online', steps: SKIN_STEPS },
  sections: [
    { id: 'steps', title: 'Paso a paso', body: [steps(SKIN_STEPS), figure(SHOTS.skin2d), figure(SHOTS.skin3d)] },
    {
      id: 'template',
      title: 'Cómo funciona la plantilla de skin',
      body: [
        ul([
          ['La imagen mide ', strong('64×64'), ' píxeles. Java 1.7.10 y anteriores usan el formato antiguo de ', strong('64×32'), ', sin brazo ni pierna izquierdos propios; Bedrock también acepta skins HD de ', strong('128×128'), '.'],
          ['Hay dos capas. La ', strong('capa base'), ' es el cuerpo; la ', strong('capa exterior'), ' (gorro, chaqueta, mangas y perneras) flota justo encima y puede ser transparente.'],
          ['Los brazos ', strong('clásicos'), ' (Steve) miden 4 píxeles de ancho y los ', strong('delgados'), ' (Alex) 3 píxeles. Sube la skin con el mismo modelo con el que la pintaste.'],
          'Las zonas que no se usan de la plantilla deben quedar totalmente transparentes.',
        ]),
      ],
    },
    {
      id: 'java',
      title: 'Usarla en Java',
      body: [
        steps([
          ['Abre el Minecraft Launcher y ve a ', uiPath('Minecraft: Java Edition', 'Aspectos'), '.'],
          ['Haz clic en ', strong('Nuevo aspecto'), ', ponle nombre y elige ', strong('Clásico'), ' o ', strong('Delgado'), '.'],
          ['Haz clic en ', strong('Examinar'), ', elige tu PNG y luego ', strong('Guardar y usar'), '.'],
        ]),
        p('También puedes subirla en tu perfil de ', ext('https://www.minecraft.net/', 'minecraft.net'), '.'),
      ],
    },
    {
      id: 'bedrock',
      title: 'Hacer tu propio pack de skins de Bedrock',
      body: [
        p(
          'Un pack de skins es un ',
          code('.mcpack'),
          ' con una o varias skins. El Skin Maker lo monta por ti; dentro lleva un ',
          code('manifest.json'),
          ' (tipo de módulo ',
          code('skin_pack'),
          '), un ',
          code('skins.json'),
          ' que enumera cada skin con el modelo clásico (',
          code('geometry.humanoid.custom'),
          ') o delgado (',
          code('geometry.humanoid.customSlim'),
          ') y ',
          code('"type": "free"'),
          ', los PNG de las skins en la raíz y los nombres en ',
          code('texts/en_US.lang'),
          '.',
        ),
        steps([
          ['Pinta cada skin como un proyecto propio. Las skins clásicas y delgadas pueden compartir pack.'],
          ['Elige ', strong('Export'), ' › ', strong('Bedrock skin pack'), ', ponle nombre al pack y marca las otras skins que quieras incluir.'],
          'Abre el .mcpack (doble clic en Windows, «Abrir con Minecraft» en Android, Compartir › Minecraft en iPhone y iPad).',
          ['En Minecraft ve a ', uiPath('Vestidor', 'Aspectos clásicos'), ', busca tu pack, elige la skin y pulsa ', strong('Equipar'), '.'],
        ]),
        figure(SHOTS.skinPack),
        callout('warn', 'Ten en cuenta', 'Las consolas no pueden importar archivos de skins. Los jugadores que activan «Permitir únicamente aspectos de confianza» ven las skins personalizadas como skins por defecto. Los packs de skins importados no admiten modelos propios, solo clásico y delgado.'),
        p('Instalarlo, actualizarlo y los archivos que lleva, paso a paso: ', link('/guides/make-a-bedrock-skin-pack', 'Cómo hacer un pack de skins de Minecraft Bedrock'), '.'),
      ],
    },
  ],
  faq: [
    { id: 'size', q: '¿Qué tamaño debe tener una skin de Minecraft?', a: [p('64×64 píxeles, guardada como PNG. Usa 64×32 solo para Java 1.7.10 y anteriores.')] },
    { id: 'username', q: '¿Puedo empezar con la skin de otra persona?', a: [p('Sí. El Skin Maker puede cargar la skin actual de cualquier jugador de Java por su nombre de usuario, para que la remezcles. Respeta el trabajo de los demás.')] },
    { id: 'phone', q: '¿Puedo hacer una skin en el móvil?', a: [p('Sí. El editor funciona con pantalla táctil, incluido el zoom con dos dedos.')] },
    {
      id: 'slim-pack',
      q: '¿Un pack de skins puede mezclar skins clásicas y delgadas?',
      a: [p('Sí. Cada skin de un pack tiene su propio modelo, así que un pack de skins propio puede tener skins clásicas (brazos de 4 píxeles) y delgadas (brazos de 3 píxeles) juntas.')],
    },
    {
      id: 'update-pack',
      q: '¿Cómo actualizo un pack de skins que ya importé?',
      a: [p('Expórtalo de nuevo desde el mismo proyecto y abre el .mcpack nuevo. El pack mantiene sus ID y recibe un número de versión más alto, así que Minecraft reemplaza el antiguo en vez de añadir una copia.')],
    },
  ],
  ctaLabel: 'Abrir el Skin Maker',
};

const shadersWithoutMods: GuideText = {
  image: SHOTS.shaderVanilla,
  intro: [
    p(
      strong('Sí, con límites.'),
      ` No necesitas OptiFine, Iris ni ningún otro mod para efectos de shader básicos. En Java 1.17 y posteriores, un paquete de recursos normal puede reemplazar algunos de los archivos de shaders del propio Minecraft, así que consigues gradación de color, viñeta, cambios en la niebla y, en ${LATEST}, bloom sin instalar nada. En Bedrock no se permite código de shaders propio, pero un pack de Visuales vibrantes ajusta la iluminación, el cielo, la niebla y el agua integrados. Las sombras y los reflejos reales en Java siguen necesitando Iris u OptiFine.`,
    ),
  ],
  howto: { name: 'Cómo crear un shader pack de Minecraft Java sin mods', steps: VANILLA_SHADER_STEPS },
  sections: [
    {
      id: 'java',
      title: 'Java: shaders en un paquete de recursos',
      body: [
        p('Desde la 1.17, Minecraft dibuja el mundo con archivos de shaders que un paquete de recursos puede reemplazar. Lo que puede hacer un shader pack vanilla depende de la versión:'),
        table(
          ['Efecto', 'Funciona en'],
          [
            ['Gradación de color (brillo, contraste, saturación, calidez, blanco y negro, sepia)', 'Java 1.17 y posteriores'],
            ['Viñeta', 'Java 1.17 y posteriores'],
            ['Distancia y color de la niebla', 'Java 1.17 y posteriores'],
            ['Bloom (brillo a pantalla completa)', `Java ${LATEST} y posteriores`],
            ['Plantas que se mueven', 'Solo 1.17 – 1.21.4 y 1.21.6 – 1.21.10'],
            ['Sombras reales, reflejos, rayos de luz', 'No es posible sin Iris u OptiFine'],
          ],
        ),
        p(`Java ${LATEST} añadió un efecto a pantalla completa siempre activo, por eso ahí funcionan el bloom y una gradación de color más limpia. Las versiones 1.16.5 y anteriores no tienen shaders del mundo reemplazables.`),
        callout('warn', 'Una versión exacta', 'Mojang cambia a menudo estos archivos de shaders, así que un shader pack vanilla solo funciona en la versión para la que se hizo. Un shader roto puede hacer que Minecraft desactive todos tus paquetes de recursos; por eso cada shader que escribe el Shader Maker se comprueba antes al compilar.'),
        h3('Crea uno'),
        steps(VANILLA_SHADER_STEPS),
        figure(SHOTS.shaderVanilla),
      ],
    },
    {
      id: 'bedrock',
      title: 'Bedrock: Visuales vibrantes en lugar de shaders',
      body: [
        p('Bedrock dejó de cargar código de shaders propio cuando pasó al motor RenderDragon (1.16.200 en Windows y consolas, 1.18.30 en otros dispositivos). Las herramientas que cambian los archivos de shaders compilados del juego necesitan instalaciones modificadas y se rompen con las actualizaciones.'),
        p(
          'La vía oficial es ',
          strong('Visuales vibrantes'),
          ' (Vibrant Visuals): el renderizador moderno de Bedrock, en el juego estable desde la 1.21.90 (junio de 2025). Un paquete de recursos puede cambiar sus ajustes: la luz del sol y de la luna, los colores del cielo, la niebla, el agua, las sombras y la gradación de color, según la hora del día y el bioma. ',
          link('/guides/bedrock-vibrant-visuals-settings', 'Ajustes de Visuales vibrantes explicados'),
          '.',
        ),
      ],
    },
    {
      id: 'mods',
      title: 'Shaders sin OptiFine: usa Iris',
      body: [
        p(
          `Si «sin mods» quiere decir «sin OptiFine», la respuesta es Iris. Carga los mismos shader packs (sombras reales del sol, hojas que se mueven, agua con reflejos, rayos de luz), funciona junto al mod de rendimiento Sodium y está disponible para Java 1.16.5 a ${LATEST}. Al escribir esto, OptiFine llega hasta la 26.2.`,
        ),
        steps([
          ['Descarga el instalador de Iris de ', ext('https://www.irisshaders.dev/', 'irisshaders.dev'), ' y ejecútalo. Instala Iris y Sodium para la versión que elijas.'],
          'Inicia el juego una vez con el nuevo perfil de Iris en el Minecraft Launcher.',
          ['Abre ', uiPath(OPTIONS, VIDEO, 'Shader Packs...'), ', haz clic en ', strong('Abrir carpeta de Shader Packs...'), ' y suelta dentro el zip de un shader pack.'],
          'Elige el pack en la lista y haz clic en Aplicar. Los packs más ligeros van bien en portátiles; los más pesados necesitan una buena tarjeta gráfica.',
        ]),
        figure(SHOTS.shaderIris),
        p('En Forge o NeoForge, busca una adaptación de Iris para ese loader. También puedes crear tu propio shader pack de Iris / OptiFine, con presets y vista previa en vivo, en el ', link('/shaders', 'Shader Maker'), '.'),
      ],
    },
  ],
  faq: [
    { id: 'optifine', q: '¿Hace falta OptiFine para los shaders vanilla?', a: [p('No. Los shader packs vanilla son paquetes de recursos normales. Funcionan sin ningún mod en la versión para la que se hicieron.')] },
    { id: 'servers', q: '¿Los shader packs vanilla funcionan en servidores?', a: [p('Sí. Los paquetes de recursos los aplica tu propio juego, así que también funcionan cuando juegas en un servidor.')] },
    { id: 'bedrock', q: '¿Puedo usar shaders de Java en Bedrock?', a: [p('No. Bedrock no puede cargar código de shaders desde packs. Usa un pack de Visuales vibrantes.')] },
  ],
  ctaLabel: 'Abrir el Shader Maker',
};

const javaVsBedrock: GuideText = {
  intro: [
    p(
      'Java y Bedrock tienen paquetes de recursos, pero los archivos no son intercambiables. Un pack de ',
      strong('Java'),
      ' es un ',
      code('.zip'),
      ' con ',
      code('pack.mcmeta'),
      ' y texturas PNG en ',
      code('assets/minecraft/textures/'),
      '. Un pack de ',
      strong('Bedrock'),
      ' es un ',
      code('.mcpack'),
      ' con ',
      code('manifest.json'),
      ' y texturas en ',
      code('textures/'),
      '. Para tener los dos, haces el pack dos veces.',
    ),
  ],
  quick: {
    title: 'Respuesta rápida: ¿los texture packs de Java funcionan en Bedrock?',
    items: [
      'No. Bedrock no puede cargar un .zip de Java, y cambiarle la extensión a .mcpack no ayuda.',
      'Las dos ediciones usan carpetas, nombres de archivo y archivos de descripción distintos.',
      'Puedes convertir un pack moviendo y renombrando sus imágenes y añadiendo un manifest.json, o rehacerlo en un proyecto de Bedrock.',
    ],
  },
  sections: [
    {
      id: 'compare',
      title: 'Lado a lado',
      body: [
        table(
          ['', 'Java Edition', 'Bedrock Edition'],
          [
            ['Archivo', [code('.zip'), ' (o una carpeta)'], [code('.mcpack'), ' (un zip renombrado)']],
            ['Archivo de descripción', [code('pack.mcmeta')], [code('manifest.json'), ' con dos UUID y un número de versión']],
            ['Versión de destino', ['Un número de pack format, p. ej. ', F(LATEST), ' para ', LATEST], ['Una versión mínima del motor, p. ej. ', code(MIN_ENGINE)]],
            ['Ejemplo de ruta de textura', [code('assets/minecraft/textures/block/stone.png')], [code('textures/blocks/stone.png')]],
            ['Formatos de imagen', 'PNG', 'PNG o TGA (conserva la extensión del archivo vanilla)'],
            ['Icono', [code('pack.png')], [code('pack_icon.png')]],
            ['Instalación', ['Soltarlo en la carpeta ', code('resourcepacks')], 'Abrir el archivo; Minecraft lo importa'],
            ['Shaders', 'Shader packs de Iris / OptiFine, o paquetes de recursos de shaders vanilla (1.17+)', 'Sin código de shaders propio; packs de ajustes de Visuales vibrantes'],
            ['Skins', 'Un PNG subido en el launcher o en minecraft.net', 'Un pack de skins (.mcpack) o un PNG importado en el Vestidor'],
            ['Consolas', 'No aplica', 'No pueden importar archivos; usa un mundo, Realm o servidor que tenga el pack'],
          ],
        ),
      ],
    },
    {
      id: 'textures',
      title: 'Diferencias de texturas a tener en cuenta',
      body: [
        ul([
          'Los nombres de archivo cambian entre ediciones, por ejemplo block/grass_block_top.png en Java y blocks/grass_top.png en Bedrock.',
          'Muchas texturas de Bedrock usan sus píxeles transparentes para guardar máscaras de tinte o de color, así que un editor nunca debe descartar el color de los píxeles invisibles. Texture Pack Maker conserva los píxeles exactos.',
          'Java puede mezclar versiones en un pack con un rango de compatibilidad; los packs de Bedrock declaran una sola versión mínima.',
        ]),
      ],
    },
    {
      id: 'convert',
      title: '¿Se puede convertir un texture pack de Java a Bedrock?',
      body: [
        p('Sí, pero no cambiando el nombre del archivo. Convertir significa rehacer el pack con la estructura de Bedrock:'),
        steps([
          ['Copia las imágenes de ', code('assets/minecraft/textures/'), ' a las carpetas ', code('textures/'), ' de Bedrock (', code('block'), ' → ', code('blocks'), ', ', code('item'), ' → ', code('items'), ').'],
          ['Renombra los archivos cuyo nombre cambia, por ejemplo ', code('grass_block_top.png'), ' → ', code('grass_top.png'), '. Las texturas sin equivalente en Bedrock se omiten.'],
          ['Escribe un ', code('manifest.json'), ' con dos UUID nuevos, una versión y una ', code('min_engine_version'), ', y renombra ', code('pack.png'), ' a ', code('pack_icon.png'), '.'],
          ['Revisa los casos especiales: las animaciones de Bedrock se enumeran en ', code('textures/flipbook_textures.json'), ' en vez de en archivos ', code('.png.mcmeta'), ', y algunas texturas son archivos ', code('.tga'), ' que guardan máscaras de tinte en sus píxeles transparentes.'],
          ['Comprime el contenido y cambia la extensión del zip a ', code('.mcpack'), '.'],
        ]),
        p(
          'La referencia de Mojang es ',
          ext('https://learn.microsoft.com/es-es/minecraft/creator/documents/convertingtexturepacks', 'Converting Texture Packs from Java Edition to Bedrock Edition'),
          '. El camino rápido es el ',
          link('/texture-pack-converter', 'convertidor de texture packs'),
          ': mueve y renombra cada textura, convierte las animaciones en entradas de flipbook, escribe el manifiesto y enumera lo que no pudo convertir.',
        ),
      ],
    },
    {
      id: 'mcpack',
      title: '¿Un .mcpack es solo un archivo zip?',
      body: [
        p(
          'Sí. Un ',
          code('.mcpack'),
          ' es un zip normal con otra extensión, para que Bedrock sepa que tiene que importarlo. Cámbiale la extensión a ',
          code('.zip'),
          ' para ver lo que hay dentro. Lo que lo convierte en un pack de Bedrock es su contenido: ',
          code('manifest.json'),
          ' en la raíz y la estructura de carpetas de Bedrock. Los archivos ',
          code('.mcaddon'),
          ' agrupan varios packs, y los ',
          code('.mcworld'),
          ' contienen un mundo entero.',
        ),
      ],
    },
    {
      id: 'both',
      title: 'Crear un pack para las dos ediciones',
      body: [
        steps([
          ['Crea un proyecto de Java en el ', link('/textures', 'Texture Pack Maker'), ' y pinta tus texturas.'],
          'Crea un proyecto de Bedrock y vuelve a pintar (o sube) las mismas texturas ahí; la lista de archivos es la de Bedrock.',
          'Exporta cada uno y comparte los dos archivos.',
        ]),
      ],
    },
  ],
  faq: [
    { id: 'convert', q: '¿Puedo convertir un pack de Java a Bedrock?', a: [p('No cambiando el nombre del archivo. Las carpetas, los nombres y el archivo de descripción son distintos, así que hay que mover y renombrar las imágenes y darles un manifest.json. El ', link('/texture-pack-converter', 'convertidor de texture packs'), ' lo hace por ti.')] },
    { id: 'back', q: '¿Puedo convertir un pack de Bedrock a Java?', a: [p('Igual pero al revés: mueve las imágenes a ', code('assets/minecraft/textures/'), ', renómbralas con los nombres de Java, convierte los .tga a PNG y añade un ', code('pack.mcmeta'), '.')] },
    { id: 'missing', q: '¿Por qué faltan algunas texturas después de convertir?', a: [p('Cada edición tiene texturas que la otra no tiene, y algunas se dividen o se combinan de otra forma (por ejemplo los cofres, los cuadros y la interfaz). Esas hay que volver a pintarlas para la otra edición.')] },
    { id: 'which', q: '¿A qué edición juego?', a: [p('Si juegas en consola, móvil o tablet, o compraste Minecraft en Microsoft Store como «Minecraft para Windows», es Bedrock. Java funciona en Windows, macOS y Linux desde el Minecraft Launcher.')] },
  ],
  ctaLabel: 'Abrir Texture Pack Maker',
};

// ---------------------------------------------------------------- vibrant visuals

const VV_STEPS: Child[] = [
  ['Crea un pack con el ', link('/shaders', 'Shader Maker'), ' (elige ', strong('Bedrock Vibrant Visuals'), ') y exporta el ', code('.mcpack'), '.'],
  'Abre el archivo. Minecraft lo importa automáticamente.',
  ['Ve a ', uiPath('Ajustes', 'Recursos globales', 'Mis packs'), ' y activa el pack. Desactiva los texture packs clásicos que no admitan Visuales vibrantes.'],
  ['Abre ', uiPath('Ajustes', 'Vídeo'), ' y pon el ', strong('Modo de gráficos'), ' en ', strong('Visuales vibrantes'), '.'],
];

const vibrantVisuals: GuideText = {
  image: SHOTS.vibrantVisuals,
  intro: [
    p(
      strong('Visuales vibrantes'),
      ' (Vibrant Visuals) es el modo gráfico moderno de Minecraft Bedrock, con luz solar direccional, sombras suaves, niebla volumétrica, agua con reflejos y materiales con renderizado físico (PBR). Salió de los experimentos en la 1.21.90 (junio de 2025) y es el modo gráfico por defecto en los dispositivos compatibles. Un paquete de recursos puede ajustar sus valores, pero no puede añadir código de shaders nuevo.',
    ),
  ],
  howto: { name: 'Cómo usar un pack de Visuales vibrantes en Minecraft Bedrock', steps: VV_STEPS },
  sections: [
    {
      id: 'settings',
      title: 'Qué puede cambiar un pack de Visuales vibrantes',
      body: [
        table(
          ['Carpeta del pack', 'Qué controla'],
          [
            [code('lighting/'), 'El brillo, el color y la inclinación de la trayectoria del sol y la luna, la luz ambiental (en cuevas), la luz del cielo y lo coloridos que son los bloques que brillan.'],
            [code('atmospherics/'), 'Los colores del cielo en lo alto y en el horizonte, y cómo se dispersa la luz en el aire (densidad del cielo, brillo del atardecer).'],
            [code('color_grading/'), 'El operador de mapeo de tonos, el contraste, la saturación, la ganancia, la gamma y la temperatura de color: el aspecto de película.'],
            [code('water/'), 'El color del agua, las olas y las cáusticas (los dibujos de luz bajo el agua).'],
            [code('shadows/'), 'Sombras pixeladas o suaves.'],
            [code('fogs/'), 'La densidad y el color de la niebla volumétrica, y la niebla de distancia clásica.'],
            [code('local_lighting/'), 'El color de la luz de bloques como antorchas y faroles.'],
          ],
        ),
        p('Los ajustes pueden cambiar con la hora del día, y los valores del propio Minecraft varían según el bioma, así que un buen pack ajusta cada bioma en vez de reemplazar un único archivo global.'),
        p(strong('No se puede ajustar con packs: '), 'el bloom, la exposición, los reflejos en espacio de pantalla, la iluminación de las nubes, la propia curva de mapeo de tonos, la distancia de renderizado y el suavizado. Todo eso está en el motor gráfico del juego, no en los paquetes de recursos.'),
      ],
    },
    {
      id: 'devices',
      title: 'Qué dispositivos lo admiten',
      body: [
        ul(['PC con Windows y DirectX 12.', 'Xbox Series y PlayStation 5; en Xbox One y PS4 viene desactivado por defecto.', 'iPhone y iPad con chip A12 o posterior.', 'Muchos dispositivos Android recientes.']),
        p('No está disponible en la Nintendo Switch original, en Chromebooks ni en tablets Fire. Los servidores pueden desactivarlo, y la pantalla dividida usa en su lugar los gráficos clásicos.'),
      ],
    },
    {
      id: 'enable',
      title: 'Actívalo con un pack',
      body: [
        steps(VV_STEPS),
        callout(
          'warn',
          '¿Visuales vibrantes sale en gris?',
          'Minecraft solo lo permite cuando todos los paquetes de recursos activos lo admiten. Los texture packs clásicos lo desactivan, así que desactívalos (o usa un pack hecho para Visuales vibrantes). Además, la opción necesita un dispositivo compatible.',
        ),
        figure(SHOTS.vibrantVisuals),
      ],
    },
  ],
  faq: [
    { id: 'what', q: '¿Qué es Visuales vibrantes en Minecraft?', a: [p('El modo gráfico moderno integrado en Bedrock, que llegó en la 1.21.90. Añade iluminación direccional, sombras, niebla volumétrica, reflejos en el agua y materiales PBR sin complementos.')] },
    { id: 'textures', q: '¿Visuales vibrantes necesita un texture pack especial?', a: [p('No, funciona con las texturas por defecto. Pero un texture pack clásico que no declara compatibilidad con Visuales vibrantes desactiva el modo mientras está activo.')] },
    { id: 'classic-fog', q: '¿Los cambios de niebla funcionan sin Visuales vibrantes?', a: [p('La niebla de distancia clásica se puede cambiar en cualquier modo gráfico. La niebla volumétrica y los ajustes de iluminación solo se aplican con Visuales vibrantes.')] },
  ],
  ctaLabel: 'Crear un pack de Visuales vibrantes',
};

// ---------------------------------------------------------------- convert java to bedrock

const CONVERT_STEPS: Child[] = [
  ['Abre el ', link('/texture-pack-converter', 'convertidor de texture packs'), ' y elige tu pack: un ', code('.zip'), ' de Java, un ', code('.mcpack'), ' de Bedrock o texturas PNG.'],
  ['Elige a qué convertirlo: ', strong('Bedrock Edition'), ', o ', strong('Java Edition'), ' y una versión.'],
  ['Haz clic en ', strong('Convert'), '. Tu navegador carga la lista de texturas de la edición de destino y convierte todas las que puede.'],
  'Lee el informe: cuántas texturas se convirtieron, cuáles se saltaron y por qué.',
  'Descarga el pack convertido, o ábrelo en el editor para volver a pintar antes las texturas que se saltaron.',
];

const convertJavaToBedrock: GuideText = {
  image: SHOTS.convertResult,
  intro: [
    p(
      'Un texture pack de Java no funciona en Bedrock, y cambiar el ',
      code('.zip'),
      ' a ',
      code('.mcpack'),
      ' no sirve: las dos ediciones usan carpetas, nombres de archivo y archivos de descripción distintos. Para convertir un pack hay que mover cada textura a la carpeta de Bedrock, ponerle el nombre de archivo de Bedrock y añadir un ',
      code('manifest.json'),
      '. El ',
      link('/texture-pack-converter', 'convertidor de texture packs'),
      ' gratuito lo hace en tu navegador en unos segundos, y también funciona al revés.',
    ),
  ],
  quick: {
    title: 'Resumen rápido',
    items: [
      ['Abre el ', link('/texture-pack-converter', 'convertidor de texture packs'), ' y elige tu ', code('.zip'), ' de Java.'],
      ['Elige ', strong('Bedrock Edition'), ' y haz clic en ', strong('Convert to Bedrock'), '.'],
      ['Descarga el ', code('.mcpack'), ' y ábrelo: Minecraft lo importa.'],
    ],
  },
  howto: { name: 'Cómo convertir un texture pack de Java a Bedrock', steps: CONVERT_STEPS },
  sections: [
    { id: 'steps', title: 'Paso a paso', body: [steps(CONVERT_STEPS), figure(SHOTS.convertPack), figure(SHOTS.convertResult)] },
    {
      id: 'what',
      title: 'Qué se convierte y qué no',
      body: [
        p('El convertidor sabe qué textura de Java cumple la misma función que cada textura de Bedrock, algo calculado a partir de los archivos del juego de las dos ediciones. La mayoría de las texturas tienen la misma imagen en ambas, así que se pueden copiar tal cual.'),
        table(
          ['Se convierte', 'No se convierte'],
          [
            ['La mayoría de las texturas de bloques e ítems (unas cuatro de cada cinco)', 'Texturas que solo existen en una edición'],
            ['Muchas texturas de criaturas y del entorno (sol, luna, nubes)', 'Texturas con otra distribución: cofres, muchas skins de criaturas, estandartes, los menús y las partículas'],
            ['Texturas animadas: el .png.mcmeta pasa a ser una entrada de flipbook', 'Modelos, sonidos, fuentes, textos de bienvenida y shaders'],
            ['El icono, el nombre y la descripción del pack', 'Extras de OptiFine como texturas conectadas y texturas de ítems personalizadas'],
          ],
        ),
        p('Todo lo que se salta aparece en el informe con el motivo, así sabes exactamente qué volver a pintar. Abre el pack convertido en el ', link('/textures', 'Texture Pack Maker'), ' para arreglar esas texturas sobre sus modelos 3D antes de descargarlo.'),
        callout('tip', 'El mismo pack en dos ediciones', 'Guarda tu pack de Java como original y vuelve a convertirlo después de cada cambio. Antes de importar la versión nueva en Bedrock, borra la antigua en Ajustes › Almacenamiento para no acabar con dos copias.'),
      ],
    },
    {
      id: 'bedrock-to-java',
      title: 'Convertir un pack de Bedrock a Java',
      body: [
        p(
          'Elige un ',
          code('.mcpack'),
          ' (o ',
          code('.mcaddon'),
          ') de Bedrock y selecciona ',
          strong('Java Edition'),
          ' y la versión a la que juegas. Las texturas pasan a las carpetas y nombres de Java, las imágenes ',
          code('.tga'),
          ' se convierten en PNG, las animaciones de flipbook pasan a archivos ',
          code('.png.mcmeta'),
          ' y el pack recibe el ',
          code('pack.mcmeta'),
          ' correcto para esa versión.',
        ),
      ],
    },
    {
      id: 'old-java',
      title: 'Actualizar un pack antiguo de Java a una versión nueva',
      body: [
        p(
          'El mismo convertidor actualiza packs de Java entre versiones. Muchas texturas cambiaron de nombre con los años, sobre todo en la 1.13, cuando ',
          code('textures/blocks'),
          ' pasó a ser ',
          code('textures/block'),
          ' y cientos de archivos recibieron nombres nuevos. Elige el pack antiguo, selecciona ',
          strong('Java'),
          ' y tu versión, y cada textura renombrada pasa a su nombre nuevo. También se actualizan los nombres de textura dentro de los modelos del propio pack.',
        ),
        p(`También funciona hacia atrás, por ejemplo para convertir un pack de la ${LATEST} en uno para la 1.8.9.`),
      ],
    },
    {
      id: 'install',
      title: 'Instalar el pack convertido',
      body: [
        ul([
          ['Bedrock: abre el ', code('.mcpack'), ' (doble clic en Windows, «Abrir con Minecraft» en el móvil) y actívalo en ', uiPath('Ajustes', 'Recursos globales'), '.'],
          ['Java: pon el ', code('.zip'), ' en la carpeta ', code('resourcepacks'), ' y pásalo a Seleccionados.'],
        ]),
        p('Más detalles en ', link('/guides/install-resource-packs', 'Cómo instalar texture packs'), '. Si algo se ve mal, consulta ', link('/guides/texture-pack-not-working', 'El texture pack no funciona'), '.'),
      ],
    },
  ],
  faq: [
    { id: 'free', q: '¿El convertidor es gratis?', a: [p('Sí, sin cuenta y sin límites. El pack se convierte en tu navegador y nunca se sube.')] },
    { id: 'look', q: '¿El pack se verá igual en Bedrock?', a: [p('Las texturas convertidas se ven igual. Las que se saltan usan las de Bedrock, y la iluminación de Bedrock y Visuales vibrantes pueden hacer que los colores se vean un poco distintos.')] },
    { id: 'shaders', q: '¿Puedo convertir un shader pack de Java a Bedrock?', a: [p('No. Bedrock no carga código de shaders propio. Usa en su lugar un pack de ', link('/guides/bedrock-vibrant-visuals-settings', 'Visuales vibrantes'), ', que puedes crear con el ', link('/shaders', 'Shader Maker'), '.')] },
    { id: 'png', q: '¿Puedo convertir archivos PNG en un .mcpack?', a: [p('Sí. Elige un PNG, o un zip de PNG, con los nombres de las texturas del juego (por ejemplo ', code('stone.png'), ') y conviértelo a Bedrock.')] },
    { id: 'console', q: '¿Puedo usar el pack convertido en una consola?', a: [p('Las consolas no pueden importar archivos. Añade el pack a un mundo en un PC o un móvil y entra en ese mundo, o usa un Realm o un servidor que lo tenga.')] },
  ],
  ctaLabel: 'Abrir el convertidor de texture packs',
};

// ---------------------------------------------------------------- merge packs

const MERGE_STEPS: Child[] = [
  ['Abre ', link('/merge-texture-packs', 'Combinar texture packs'), ' y añade de dos a ocho packs: archivos ', code('.zip'), ' de Java o ', code('.mcpack'), ' de Bedrock.'],
  'Ordénalos arrastrándolos o con los botones de flecha. El pack de arriba gana donde dos packs cambian el mismo archivo.',
  'Ponle nombre al pack combinado y elige su icono. Para Java, elige también la versión a la que juegas.',
  ['Haz clic en ', strong('Merge'), ' y revisa la lista de conflictos.'],
  'Descarga el pack combinado, o ábrelo en el editor para seguir trabajando en él.',
];

const mergePacks: GuideText = {
  image: SHOTS.mergeResult,
  intro: [
    p(
      'Minecraft ya puede apilar texture packs: activa varios y el que está más arriba en la lista gana donde dos cambian la misma textura. Combinar crea un solo pack a partir de varios, con ese mismo orden ya integrado. Viene bien para un servidor o un Realm que solo admite un pack, para compartir tu combinación favorita o para tener una lista de packs corta. La herramienta gratuita ',
      link('/merge-texture-packs', 'Combinar texture packs'),
      ' lo hace en tu navegador.',
    ),
  ],
  quick: {
    title: 'Resumen rápido',
    items: [
      ['Abre ', link('/merge-texture-packs', 'Combinar texture packs'), ' y añade de dos a ocho packs de la misma edición.'],
      'Arrástralos para ordenarlos: el pack de arriba gana todos los conflictos.',
      'Haz clic en Merge, revisa la lista de conflictos y descarga el pack.',
    ],
  },
  howto: { name: 'Cómo combinar texture packs de Minecraft', steps: MERGE_STEPS },
  sections: [
    { id: 'steps', title: 'Paso a paso', body: [steps(MERGE_STEPS), figure(SHOTS.mergeSettings), figure(SHOTS.mergeResult)] },
    {
      id: 'wins',
      title: '¿Qué pack gana?',
      body: [
        p('La misma regla que usa Minecraft: en cada archivo gana el pack que está más arriba en la lista. Una textura y su archivo de animación siempre van juntos, así que la animación de un pack de abajo nunca acaba pegada a la imagen de un pack de arriba.'),
        p('Algunos archivos se combinan en lugar de reemplazarse, para no perder nada útil:'),
        ul([
          [strong('Java: '), 'archivos de idioma (clave a clave), ', code('sounds.json'), ' (sonido a sonido), atlas de texturas y fuentes.'],
          [strong('Bedrock: '), code('terrain_texture.json'), ', ', code('item_texture.json'), ', ', code('flipbook_textures.json'), ', ', code('blocks.json'), ', definiciones de sonido y archivos de idioma.'],
        ]),
        p('El resultado enumera cada conflicto, como «block/stone.png del pack A, por encima del pack B», y cuántos archivos aportó cada pack.'),
      ],
    },
    {
      id: 'versions',
      title: 'Packs para distintas versiones',
      body: [
        p(
          'Se pueden combinar packs de Java hechos para versiones distintas: elige la versión a la que juegas y los packs más antiguos reciben antes sus nombres de textura (los mismos cambios de nombre que usa el ',
          link('/texture-pack-converter', 'convertidor'),
          `), así que un pack de la 1.12 y uno de la ${LATEST} encajan. Los packs de Java y de Bedrock no se pueden combinar directamente: convierte uno de ellos primero.`,
        ),
      ],
    },
    {
      id: 'by-hand',
      title: 'Combinar packs a mano',
      body: [
        steps([
          'Descomprime cada pack en su propia carpeta.',
          'Crea una carpeta nueva y copia primero el pack de menor prioridad, luego cada pack superior encima, reemplazando archivos cuando te lo pregunte.',
          ['Combina a mano los archivos que deben juntarse (', code('sounds.json'), ', archivos de idioma, atlas), o ganará la última copia.'],
          ['Deja un solo ', code('pack.mcmeta'), ' (Java) o escribe un ', code('manifest.json'), ' nuevo con ID nuevos (Bedrock) y comprime el contenido en un zip.'],
        ]),
        p('La herramienta hace todo esto, incluidos los archivos combinados y el formato de pack correcto, así que hacerlo a mano solo merece la pena con packs poco habituales.'),
      ],
    },
  ],
  faq: [
    { id: 'how-many', q: '¿Cuántos packs puedo combinar?', a: [p('De dos a ocho a la vez. Para combinar más, vuelve a combinar el resultado con los siguientes packs.')] },
    { id: 'shaders', q: '¿Puedo combinar shader packs?', a: [p('No. Los shader packs de Iris y OptiFine solo funcionan de uno en uno. Los paquetes de recursos de shaders vanilla se pueden combinar como cualquier paquete de recursos, pero dos packs que cambian el mismo archivo de shader no suman sus efectos.')] },
    { id: 'server', q: '¿Puedo usar un pack combinado como paquete de recursos del servidor?', a: [p('Sí. Sube el ', code('.zip'), ' combinado donde alojes los packs del servidor y configúralo en ', code('server.properties'), ' como cualquier otro pack.')] },
    { id: 'upload', q: '¿Se suben mis packs?', a: [p('No. Los packs se combinan en tu navegador y se quedan en tu dispositivo.')] },
  ],
  ctaLabel: 'Abrir Combinar texture packs',
};

// ---------------------------------------------------------------- bedrock skin pack

const SKIN_PACK_STEPS: Child[] = [
  ['Abre el ', link('/skin-pack-maker', 'creador de packs de skins'), ' y empieza una skin: una plantilla en blanco o por colores, un PNG que ya tengas, la skin de un jugador de Java por su nombre de usuario o una de las skins por defecto. Elige brazos clásicos (4 píxeles) o delgados (3 píxeles).'],
  'Píntala sobre la plantilla de 64×64 o directamente sobre el modelo 3D. Cada skin se guarda en tu dispositivo como un proyecto propio, y su nombre es el que verán los jugadores en el juego.',
  'Haz igual el resto de skins del pack.',
  ['Abre una de ellas, elige ', strong('Export'), ' › ', strong('Bedrock skin pack (.mcpack)'), ', ponle nombre al pack, marca las otras skins que quieras incluir y pulsa ', strong('Download pack'), '.'],
  ['Abre el ', code('.mcpack'), ' en Windows, Android, iPhone o iPad. Minecraft lo importa.'],
  ['En Minecraft ve a ', uiPath('Vestidor', 'Aspectos clásicos'), ', busca tu pack, elige una skin y pulsa ', strong('Equipar'), '.'],
];

const bedrockSkinPack: GuideText = {
  image: SHOTS.skinPack,
  intro: [
    p(
      strong('Sí, puedes hacer tu propio pack de skins para Minecraft Bedrock, y gratis.'),
      ' Un pack de skins (skin pack) es un archivo ',
      code('.mcpack'),
      ' con una o varias skins y dos pequeños archivos de descripción, ',
      code('manifest.json'),
      ' y ',
      code('skins.json'),
      '. Pinta o sube tus skins en el ',
      link('/skin-pack-maker', 'creador de packs de skins'),
      ', descarga el pack, ábrelo en Windows, Android, iPhone o iPad y ponte tus skins desde el Vestidor. Vender un pack en el Marketplace de Minecraft es otra cosa: allí solo publican los socios del Marketplace aprobados por Mojang.',
    ),
  ],
  quick: {
    title: 'Resumen rápido',
    items: [
      ['Pinta o sube cada skin en el ', link('/skin-pack-maker', 'creador de packs de skins'), ', con brazos clásicos o delgados.'],
      ['Elige ', strong('Export'), ' › ', strong('Bedrock skin pack (.mcpack)'), ', ponle nombre al pack y marca las otras skins.'],
      ['Abre el ', code('.mcpack'), ' y equípate una skin en ', uiPath('Vestidor', 'Aspectos clásicos'), '.'],
    ],
  },
  howto: { name: 'Cómo hacer un pack de skins de Minecraft Bedrock', steps: SKIN_PACK_STEPS },
  sections: [
    {
      id: 'what',
      title: '¿Qué hay dentro de un pack de skins?',
      body: [
        p('Un pack de skins es un archivo zip con la extensión cambiada a ', code('.mcpack'), '. En su raíz están estos archivos:'),
        table(
          ['Archivo', 'Para qué sirve'],
          [
            [code('manifest.json'), ['El nombre del pack, dos ID únicos (UUID) y un número de versión. Su tipo de módulo ', code('skin_pack'), ' le dice a Minecraft que es un pack de skins y no un texture pack.']],
            [code('skins.json'), ['La lista de skins: de cada una, su clave de nombre, su PNG, el modelo (', code('geometry.humanoid.custom'), ' para brazos clásicos, ', code('geometry.humanoid.customSlim'), ' para delgados) y ', code('"type": "free"'), '.']],
            ['Imágenes de las skins', ['Un PNG de 64×64 por skin, junto al ', code('manifest.json'), '.']],
            [code('texts/en_US.lang'), ['Los nombres que se ven en el Vestidor, del pack y de cada skin. ', code('texts/languages.json'), ' enumera los archivos de idioma.']],
          ],
        ),
        p(code('"type": "free"'), ' significa que cualquiera que tenga el pack puede ponerse la skin. Los packs del Marketplace marcan la mayoría de sus skins como ', code('"paid"'), ', que solo se desbloquean al comprar el pack, así que un pack hecho por ti siempre usa «free».'),
      ],
    },
    {
      id: 'steps',
      title: 'Hazlo con el creador de packs de skins',
      body: [
        steps(SKIN_PACK_STEPS),
        figure(SHOTS.skinPack),
        p(
          'El creador escribe por ti ',
          code('manifest.json'),
          ', ',
          code('skins.json'),
          ' y el archivo de idioma, con ID nuevos para cada pack. Las skins clásicas y delgadas pueden compartir pack, cada skin conserva su nombre, y el nombre de pack que escribas es el título que los jugadores ven encima de las skins.',
        ),
        figure(SHOTS.skin3d),
      ],
    },
    {
      id: 'install',
      title: 'Instálalo en Windows, Android e iOS',
      body: [
        tabbed(
          'install-skin-pack',
          [
            {
              value: 'windows',
              label: 'Windows',
              icon: 'monitor',
              content: [
                steps([
                  ['Haz doble clic en el ', code('.mcpack'), '. Minecraft se abre y muestra ', el('em', null, 'Importación iniciada...'), ' y después que se importó con éxito.'],
                  ['Abre ', uiPath('Vestidor', 'Aspectos clásicos'), ', elige una skin de tu pack y pulsa ', strong('Equipar'), '.'],
                ]),
              ],
            },
            {
              value: 'mobile',
              label: 'Android e iOS',
              icon: 'smartphone',
              content: [
                steps([
                  ['Descarga el ', code('.mcpack'), ' en el móvil o la tablet.'],
                  [strong('Android: '), 'ábrelo desde Descargas o la app de archivos y elige Minecraft. ', strong('iPhone / iPad: '), 'tócalo en la app Archivos y luego ', uiPath('Compartir', 'Minecraft'), '.'],
                  ['Abre ', uiPath('Vestidor', 'Aspectos clásicos'), ' y equípate una skin de tu pack.'],
                ]),
              ],
            },
            {
              value: 'console',
              label: 'Consolas',
              icon: 'gamepad',
              content: [p('Xbox, PlayStation y Switch no pueden importar packs de skins ni archivos de skins. En consola, los aspectos personalizados vienen del Creador de personajes o de packs de skins del Marketplace.')],
            },
          ],
          UI_ES.platform,
        ),
        callout(
          'tip',
          '¿Solo una skin?',
          'Para una sola skin no hace falta un pack: en Aspectos clásicos abre tus aspectos, elige Importar y selecciona un PNG de 64×64. Un pack es más cómodo para varias skins, conserva sus nombres y se instala igual en cualquier dispositivo.',
        ),
      ],
    },
    {
      id: 'update',
      title: 'Actualizar o borrar un pack de skins',
      body: [
        p('Para cambiar un pack que ya importaste, edita las skins, exporta otra vez el pack desde el mismo proyecto y abre el archivo nuevo. El creador mantiene los dos ID del pack y sube su versión (1.0.0, luego 1.0.1, etc.), así Minecraft reemplaza el pack instalado en vez de mostrarlo dos veces.'),
        p('¿Hiciste el pack a mano? Mantén los dos UUID y sube la versión en el ', code('manifest.json'), ', tanto en el encabezado como en el módulo. Con UUID nuevos tendrás un segundo pack, y la misma versión no se vuelve a importar porque ese pack ya está instalado.'),
        p('Para borrar un pack, ve a ', uiPath('Ajustes', 'Almacenamiento'), ', selecciónalo y bórralo.'),
      ],
    },
    {
      id: 'arms',
      title: 'Brazos clásicos o delgados',
      body: [
        p(
          'Cada skin de un pack tiene su propio modelo, así que un pack puede mezclar los dos. Los brazos ',
          strong('clásicos'),
          ' (Steve) miden 4 píxeles de ancho y usan ',
          code('geometry.humanoid.custom'),
          '; los ',
          strong('delgados'),
          ' (Alex) miden 3 píxeles y usan ',
          code('geometry.humanoid.customSlim'),
          '. El modelo tiene que coincidir con cómo se pintó la skin; si no, los brazos se ven cortados o con una franja transparente.',
        ),
        p('Los packs importados solo pueden usar estos dos modelos. No se permiten formas propias, como una cabeza enorme, en un pack de skins que importas tú.'),
      ],
    },
    {
      id: 'by-hand',
      title: 'Hacer un pack de skins a mano',
      body: [
        p('También puedes escribir los archivos tú mismo con cualquier editor de texto. Un pack con dos skins tiene esta pinta:'),
        pre(SKIN_PACK_TREE),
        p(code('manifest.json'), ' necesita dos UUID distintos. Genera los tuyos con cualquier generador de UUID en lugar de copiar los de abajo, y guárdalos para futuras actualizaciones:'),
        pre(SKIN_PACK_MANIFEST.trimEnd()),
        p(code('skins.json'), ' enumera las skins. ', code('serialize_name'), ' y ', code('localization_name'), ' son el ID del pack: una sola palabra sin espacios que no use ningún otro pack. El creador de packs de skins añade el principio del UUID del pack para asegurarse.'),
        pre(SKIN_PACK_SKINS_JSON.trimEnd()),
        p(code('texts/en_US.lang'), ' guarda los nombres que se ven en el juego, y ', code('texts/languages.json'), ' contiene ', code('["en_US"]'), ':'),
        pre(SKIN_PACK_LANG.trimEnd()),
        steps([
          ['Pon los archivos en una carpeta como se muestra, con los PNG junto al ', code('manifest.json'), '.'],
          'Selecciona los archivos de dentro de la carpeta, no la carpeta en sí, y comprímelos en un zip.',
          ['Cambia la extensión del zip de ', code('.zip'), ' a ', code('.mcpack'), ' y ábrelo.'],
        ]),
        p('Si la importación falla, lo normal es que haya una carpeta envolviendo los archivos dentro del zip, una errata en el JSON o dos UUID iguales. El ', link('/skin-pack-maker', 'creador de packs de skins'), ' escribe exactamente estos archivos, así que también puedes exportar un pack, cambiarle la extensión a ', code('.zip'), ' y mirar dentro.'),
      ],
    },
    {
      id: 'marketplace',
      title: 'Packs del Marketplace y packs personales',
      body: [
        p('¿Quieres hacer un pack de skins para el Marketplace de Minecraft? Allí solo publican los socios del Marketplace: estudios y creadores que Mojang ha aceptado en su programa de socios y que envían cada pack a revisión. No hay forma de subir un pack al Marketplace desde el juego ni desde una web.'),
        ul([
          [strong('Pack de skins personal: '), 'gratis, lo puede hacer cualquiera y se importa desde un ', code('.mcpack'), ' en Windows, Android, iPhone y iPad. Puedes compartir el archivo con tus amigos.'],
          [strong('Pack de skins del Marketplace: '), 'hecho por un socio aprobado, se compra con Minecoins o es gratis, y está disponible en todos los dispositivos, consolas incluidas.'],
        ]),
        p('Mete en un pack solo skins que hayas hecho tú o que tengas permiso para compartir.'),
      ],
    },
    {
      id: 'trusted',
      title: 'Por qué tus amigos pueden ver una skin por defecto',
      body: [
        p('Bedrock tiene un ajuste llamado ', strong('Permitir únicamente aspectos de confianza'), '. Los jugadores que lo activan ven todas las skins personalizadas, también las de packs importados, como una skin por defecto, por ejemplo Steve o Alex. Es un ajuste de su lado, así que no puedes cambiarlo por ellos. Los demás ven tu skin tal como la hiciste.'),
      ],
    },
  ],
  faq: [
    { id: 'free', q: '¿Se pueden hacer packs de skins para Minecraft Bedrock gratis?', a: [p('Sí. Los packs de skins personales son gratis de hacer y de usar en Windows, Android, iPhone y iPad. El creador de packs de skins no necesita cuenta y tus skins se quedan en tu dispositivo.')] },
    { id: 'java', q: '¿Los packs de skins funcionan en Java Edition?', a: [p('No. Los packs de skins son de Bedrock. En Java llevas una skin cada vez, subida como PNG en el Minecraft Launcher. ', link('/guides/make-a-skin', 'Cómo hacer una skin'), '.')] },
    { id: 'console', q: '¿Puedo usar un pack de skins propio en Xbox, PlayStation o Switch?', a: [p('No. Las consolas no pueden importar packs de skins ni archivos de skins. Windows, Android, iPhone y iPad sí.')] },
    { id: 'marketplace', q: '¿Puedo vender mi pack de skins en el Marketplace?', a: [p('Solo como socio aprobado del Marketplace de Minecraft. Un pack personal se puede compartir como archivo .mcpack, pero no venderse en el juego.')] },
    { id: 'failed', q: '¿Por qué falla la importación?', a: [p('Normalmente el zip tiene una carpeta envolviendo los archivos, el JSON tiene una errata, los dos UUID son iguales o ya hay instalado un pack con los mismos ID y la misma versión. Los packs exportados con el creador de packs de skins evitan los cuatro problemas.')] },
  ],
  ctaLabel: 'Abrir el creador de packs de skins',
};

export const GUIDES: Record<string, GuideText> = {
  'make-a-texture-pack': makeATexturePack,
  'texture-pack-not-working': notWorking,
  'install-resource-packs': install,
  'minecraft-pack-format-versions': packFormats,
  'make-a-skin': makeASkin,
  'make-shaders-without-mods': shadersWithoutMods,
  'java-vs-bedrock-packs': javaVsBedrock,
  'bedrock-vibrant-visuals-settings': vibrantVisuals,
  'convert-java-to-bedrock-texture-pack': convertJavaToBedrock,
  'merge-texture-packs': mergePacks,
  'make-a-bedrock-skin-pack': bedrockSkinPack,
};
