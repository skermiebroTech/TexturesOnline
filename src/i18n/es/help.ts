// Spanish help page (see HelpText in src/tools/help/content.ts). Menu names are the ones the Spanish
// (Spain) game shows (Java: assets/minecraft/lang/es_es.json, Bedrock: texts/es_ES.lang).

import { el, type Child } from '../../app/markup';
import { callout, code, ext, folderTable, link, steps, strong, tabbed, uiPath } from '../../app/content/blocks';
import { REPO_URL } from '../../app/site';
import { F, LATEST, maxFormat, minFormat } from '../../app/content/facts';
import type { HelpText } from '../../tools/help/content';
import { UI_ES } from './ui';

const p = (...c: Child[]) => el('p', null, ...c);
const FOLDER = UI_ES.folderTable;

const JAVA_PACK_STEPS: Child[] = [
  ['Exporta tu pack desde Texture Pack Maker. Obtienes un archivo como ', code('Mi pack.zip'), '.'],
  ['Abre Minecraft Java Edition y entra en ', uiPath('Opciones...', 'Paquetes de recursos...'), '.'],
  ['Haz clic en ', uiPath('Abrir carpeta de paquetes'), '. Se abre la carpeta ', code('resourcepacks'), '.'],
  ['Suelta el ', code('.zip'), ' en esa carpeta. También puedes arrastrarlo directamente a la pantalla de paquetes de recursos.'],
  ['Pasa el ratón por tu pack en la lista ', strong('Disponibles'), ' y haz clic en la flecha para moverlo a ', strong('Seleccionados'), '. Los packs más arriba ganan. Haz clic en ', strong('Hecho'), '.'],
];

const BEDROCK_PACK_STEPS: Child[] = [
  ['Exporta tu pack. Obtienes un archivo como ', code('Mi pack.mcpack'), '.'],
  ['Haz doble clic en el archivo. Minecraft se abre y muestra ', el('em', null, 'Importación iniciada...'), ' y después que se importó con éxito.'],
  ['Ve a ', uiPath('Ajustes', 'Recursos globales', 'Mis packs'), ', selecciona tu pack y pulsa ', strong('Activar'), '.'],
  '¿Usas varios packs? Mueve el tuyo arriba del todo para que gane.',
];

const JAVA_SKIN_STEPS: Child[] = [
  ['Abre el Minecraft Launcher y elige ', uiPath('Minecraft: Java Edition', 'Aspectos'), '.'],
  ['Haz clic en ', strong('Nuevo aspecto'), ' (la tarjeta con el +).'],
  ['Ponle nombre y elige el modelo de jugador: ', strong('Clásico'), ' o ', strong('Delgado'), '.'],
  ['Haz clic en ', strong('Examinar'), ', elige tu PNG y luego ', strong('Guardar y usar'), '.'],
];

const BEDROCK_SKIN_STEPS: Child[] = [
  ['Exporta como ', strong('Bedrock skin pack'), '. Obtienes un archivo ', code('.mcpack'), '.'],
  'Abre el archivo (doble clic en Windows, «Abrir con Minecraft» en móviles y tablets) para importarlo.',
  ['En Minecraft ve a ', uiPath('Vestidor', 'Aspectos clásicos'), '. Tu pack aparece con los packs importados.'],
  ['Elige tu skin y pulsa ', strong('Equipar'), '.'],
];

const IRIS_STEPS: Child[] = [
  ['Descarga el Iris Installer de ', ext('https://www.irisshaders.dev/', 'irisshaders.dev'), '. Instala Fabric Loader, Iris y Sodium para tu versión de una vez.'],
  ['Abre el Minecraft Launcher, elige el nuevo perfil ', strong('Iris & Sodium'), ' y juega una vez.'],
  ['Exporta tu shader pack desde el Shader Maker (un ', code('.zip'), ': no lo descomprimas).'],
  ['En el juego abre ', uiPath('Opciones...', 'Gráficos...', 'Shader Packs...'), ' y haz clic en ', strong('Abrir carpeta de Shader Packs...'), '. Suelta el zip dentro.'],
  ['Selecciona tu pack y haz clic en ', strong('Aplicar'), '. El botón ', strong('Configuración del Shader Pack...'), ' te deja afinar las opciones en el juego.'],
];

const VANILLA_SHADER_STEPS: Child[] = [
  ['Exporta con el destino ', strong('Vanilla Java'), '. Obtienes un paquete de recursos ', code('.zip'), '.'],
  ['Instálalo como un texture pack: ', uiPath('Opciones...', 'Paquetes de recursos...', 'Abrir carpeta de paquetes'), ' y suelta el zip dentro.'],
  'Muévelo a Seleccionados y haz clic en Hecho. El nuevo aspecto se aplica al momento.',
];

const VIBRANT_STEPS: Child[] = [
  ['Exporta tu pack (', code('.mcpack'), ') y abre el archivo para importarlo.'],
  ['Ve a ', uiPath('Ajustes', 'Recursos globales', 'Mis packs'), ' y actívalo.'],
  ['Abre ', uiPath('Ajustes', 'Vídeo'), ' y pon ', strong('Modo de gráficos'), ' en ', strong('Visuales vibrantes'), '.'],
];

export const HELP: HelpText = {
  sections: {
    'java-packs': {
      title: 'Texture packs en Java',
      short: 'Packs de Java',
      howto: { name: 'Cómo instalar un texture pack (paquete de recursos) en Minecraft Java Edition', steps: JAVA_PACK_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Java Edition llama a los texture packs ', el('em', null, 'paquetes de recursos'), '. Lo que exportas es un archivo ', code('.zip'), ': no lo descomprimas.'),
        steps(JAVA_PACK_STEPS),
        callout(
          'info',
          '¿Ves «Diseñado para una versión de Minecraft anterior» (o posterior)?',
          'Los packs se escriben para la versión que eliges en el editor. Si juegas a otra versión, cambia la versión de destino o el rango de compatibilidad en la pestaña ',
          strong('Pack'),
          ' y exporta de nuevo. Los packs que solo cambian texturas suelen funcionar igual: puedes pulsar ',
          strong('Sí'),
          ' para usarlo de todos modos.',
        ),
        el('h3', { class: 'guide-sub' }, 'Dónde está la carpeta'),
        folderTable('resourcepacks', FOLDER),
      ],
    },
    'bedrock-packs': {
      title: 'Texture packs en Bedrock',
      short: 'Packs de Bedrock',
      howto: { name: 'Cómo instalar un texture pack de Bedrock (.mcpack) en Windows', steps: BEDROCK_PACK_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Los packs de Bedrock se exportan como archivos ', code('.mcpack'), '. Al abrir uno, Minecraft lo importa automáticamente.'),
        tabbed(
          'bedrock-packs',
          [
            { value: 'windows', label: 'Windows', icon: 'monitor', content: [steps(BEDROCK_PACK_STEPS)] },
            {
              value: 'mobile',
              label: 'Android e iOS',
              icon: 'smartphone',
              content: [
                steps([
                  ['Descarga el ', code('.mcpack'), ' en tu móvil o tablet.'],
                  [strong('Android: '), 'ábrelo desde Descargas o la app de archivos y elige ', strong('Minecraft'), '. ', strong('iPhone / iPad: '), 'en la app Archivos toca el archivo y luego ', uiPath('Compartir', 'Minecraft'), '.'],
                  ['Minecraft importa el pack. Después abre ', uiPath('Ajustes', 'Recursos globales'), ' y actívalo.'],
                ]),
              ],
            },
            {
              value: 'console',
              label: 'Consolas',
              icon: 'gamepad',
              content: [
                el(
                  'p',
                  { class: 'muted' },
                  'Xbox, PlayStation y Switch no pueden importar archivos .mcpack. Añade el pack a un mundo en un PC o un móvil y entra en ese mundo, o juega en un Realm o servidor que incluya el pack.',
                ),
              ],
            },
          ],
          UI_ES.platform,
        ),
        callout('tip', '¿Solo para un mundo?', 'En lugar de Recursos globales, abre ', uiPath('Editar mundo', 'Paquetes de recursos'), ' y activa el pack ahí.'),
        callout('info', 'Actualizar un pack que ya importaste', 'Cada exportación mantiene el mismo ID de pack y sube su número de versión, así que al importarlo de nuevo se reemplaza la copia antigua en vez de añadir un duplicado.'),
      ],
    },
    'java-skins': {
      title: 'Skins en Java',
      short: 'Skins de Java',
      howto: { name: 'Cómo cambiar tu skin en Minecraft Java Edition', steps: JAVA_SKIN_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Exporta tu skin como ', code('.png'), '. Recuerda si pintaste el modelo ', strong('Clásico'), ' (brazos de 4 píxeles) o el ', strong('Delgado'), ' (brazos de 3 píxeles).'),
        tabbed(
          'java-skins',
          [
            { value: 'launcher', label: 'Minecraft Launcher', icon: 'monitor', content: [steps(JAVA_SKIN_STEPS)] },
            {
              value: 'web',
              label: 'minecraft.net',
              icon: 'globe',
              content: [
                steps([
                  ['Inicia sesión en ', ext('https://www.minecraft.net/', 'minecraft.net'), ' y abre tu perfil.'],
                  ['En la sección de skins elige el modelo ', strong('Clásico'), ' o ', strong('Delgado'), '.'],
                  ['Sube tu PNG y confirma. Aparece en el juego la próxima vez que entres en un mundo o servidor.'],
                ]),
              ],
            },
          ],
          UI_ES.platform,
        ),
        callout('info', '¿Juegas a la 1.7.10 o anterior?', 'Esas versiones solo entienden el formato antiguo de 64×32. Usa la opción de exportación ', strong('Legacy 64×32'), '.'),
      ],
    },
    'bedrock-skins': {
      title: 'Skins en Bedrock',
      short: 'Skins de Bedrock',
      howto: { name: 'Cómo instalar un pack de skins de Bedrock (.mcpack)', steps: BEDROCK_SKIN_STEPS },
      body: [
        tabbed(
          'bedrock-skins',
          [
            { value: 'pack', label: 'Pack de skins (.mcpack)', icon: 'package', content: [steps(BEDROCK_SKIN_STEPS)] },
            {
              value: 'png',
              label: 'Un solo PNG',
              icon: 'image',
              content: [
                steps([
                  ['Exporta la skin como ', code('.png'), '.'],
                  ['Abre ', uiPath('Vestidor', 'Aspectos clásicos'), ' y en ', strong('De tu propiedad'), ' elige la casilla vacía ', strong('Importar'), '.'],
                  ['Elige tu PNG y luego el modelo de brazos clásico o delgado.'],
                ]),
              ],
            },
          ],
          UI_ES.platform,
        ),
        callout(
          'warn',
          '¿Tus amigos ven una skin por defecto?',
          'Los jugadores que tienen activado ',
          strong('Permitir únicamente aspectos de confianza'),
          ' ven las skins personalizadas como una skin por defecto. Es su propio ajuste. Las consolas no pueden importar archivos de skins.',
        ),
      ],
    },
    iris: {
      title: 'Shaders con Iris u OptiFine',
      short: 'Iris / OptiFine',
      howto: { name: 'Cómo instalar un shader pack con Iris', steps: IRIS_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Los shader packs clásicos necesitan un mod de shaders. ', strong('Iris'), ' es el más fácil y rápido; OptiFine también sirve.'),
        tabbed(
          'iris',
          [
            { value: 'iris', label: 'Iris (recomendado)', icon: 'sparkles', content: [steps(IRIS_STEPS)] },
            {
              value: 'optifine',
              label: 'OptiFine',
              icon: 'gear',
              content: [
                steps([
                  ['Instala OptiFine para tu versión de Minecraft desde ', ext('https://optifine.net/', 'optifine.net'), ' y juega una vez con el perfil de OptiFine.'],
                  ['Abre ', uiPath('Opciones...', 'Gráficos...', 'Shaders...'), ' y haz clic en ', strong('Carpeta de shaders'), '.'],
                  'Suelta el zip exportado en la carpeta y luego selecciónalo en la lista.',
                ]),
              ],
            },
          ],
          UI_ES.platform,
        ),
        el('h3', { class: 'guide-sub' }, 'Carpeta de shader packs'),
        folderTable('shaderpacks', FOLDER),
      ],
    },
    'vanilla-shaders': {
      title: 'Shaders vanilla (sin mods)',
      short: 'Shaders vanilla',
      howto: { name: 'Cómo instalar un shader pack vanilla (sin mods) en Minecraft Java', steps: VANILLA_SHADER_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Funcionan en el juego normal porque son un ', strong('paquete de recursos'), ' que reemplaza algunos de los archivos de shaders del propio Minecraft.'),
        steps(VANILLA_SHADER_STEPS),
        callout('warn', 'Hecho para una versión exacta', 'Mojang cambia a menudo los archivos de shaders, así que un shader pack vanilla solo funciona en la versión para la que se hizo. Después de actualizar Minecraft, abre tu proyecto, elige la versión nueva y exporta de nuevo.'),
      ],
    },
    'vibrant-visuals': {
      title: 'Visuales vibrantes en Bedrock',
      short: 'Visuales vibrantes',
      howto: { name: 'Cómo usar un pack de Visuales vibrantes en Minecraft Bedrock', steps: VIBRANT_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Los «shaders» de Bedrock son packs de ajustes de Visuales vibrantes (Vibrant Visuals): iluminación, cielo, gradación de color, agua y niebla.'),
        steps(VIBRANT_STEPS),
        callout(
          'warn',
          '¿No puedes elegir Visuales vibrantes?',
          'Minecraft solo lo permite cuando todos los packs activos son compatibles. Los texture packs clásicos (incluidos los que haces en Texture Pack Maker) lo desactivan, así que desactiva los otros packs mientras uses este. Algunos servidores también lo desactivan.',
        ),
        callout(
          'info',
          'Necesita un dispositivo compatible',
          'Visuales vibrantes funciona en PC con Windows y DirectX 12, Xbox y PlayStation (en Xbox One y PS4 empieza desactivado), iPhone y iPad con chip A12 o posterior y muchos dispositivos Android recientes. No está disponible en la Nintendo Switch original, en Chromebooks ni en tablets Fire. ',
          strong('Personalizar la niebla clásica'),
          ' también funciona en los otros modos de gráficos.',
        ),
      ],
    },
    folders: {
      title: 'Encontrar tu carpeta de Minecraft',
      short: 'Carpetas',
      body: [
        el('p', { class: 'guide-intro' }, 'Lo más rápido es el botón ', strong('Abrir carpeta de paquetes'), ' de Minecraft. Si necesitas la ruta:'),
        el(
          'table',
          { class: 'paths-table' },
          el('thead', null, el('tr', null, el('th', { scope: 'col' }, 'Qué'), el('th', { scope: 'col' }, 'Dónde'))),
          el(
            'tbody',
            null,
            el('tr', null, el('th', { scope: 'row' }, 'Java en Windows'), el('td', null, code('%APPDATA%\\.minecraft'))),
            el('tr', null, el('th', { scope: 'row' }, 'Java en macOS'), el('td', null, code('~/Library/Application Support/minecraft'))),
            el('tr', null, el('th', { scope: 'row' }, 'Java en Linux'), el('td', null, code('~/.minecraft'))),
            el('tr', null, el('th', { scope: 'row' }, 'Archivos del juego (.jar)'), el('td', null, code('.minecraft/versions/<version>/<version>.jar'))),
            el('tr', null, el('th', { scope: 'row' }, 'Bedrock en Windows'), el('td', null, code('%APPDATA%\\Minecraft Bedrock\\users\\shared\\games\\com.mojang'))),
          ),
        ),
        el('p', { class: 'muted small' }, 'En Windows, pega la ruta en la barra de direcciones del Explorador de archivos o en la ventana Ejecutar (Win + R).'),
      ],
    },
  },
  faq: [
    {
      id: 'vanilla-source',
      q: '¿De dónde salen las texturas vanilla?',
      a: [
        p(
          'Cuando empiezas un proyecto de Java, tu navegador descarga el archivo oficial del juego de esa versión directamente de los servidores de Mojang y solo guarda las texturas, los modelos y los shaders en este dispositivo. Las texturas de Bedrock vienen del repositorio oficial de Mojang ',
          ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'),
          ' en GitHub.',
        ),
        p('Texture Pack Maker no guarda nada de Mojang: es una web estática sin servidores propios.'),
      ],
    },
    {
      id: 'paint-3d',
      q: '¿Puedo pintar sobre el modelo 3D en lugar de la textura plana?',
      a: [
        p(
          'Sí. En el editor de texturas usa el interruptor ',
          strong('2D / 3D'),
          ' encima del lienzo (o pulsa D). Cada cara pinta exactamente el píxel que muestra, incluidas caras giradas, capas como el lateral de la hierba, estados encendidos y apagados, cofres y camas. Funcionan el lápiz, la goma, el relleno, el selector de color (o Alt+clic), el tamaño del pincel y el espejo, y cada textura tiene su propio deshacer. Arrastra con el botón derecho o con dos dedos para girar el modelo, usa la rueda o pellizca para hacer zoom, y F, B, L, R y T saltan a una cara.',
        ),
      ],
    },
    {
      id: 'mobs',
      q: '¿Puedo editar texturas de criaturas?',
      a: [
        p(
          'Sí. Elige ',
          strong('Mobs'),
          ' en la lista de texturas (Blocks · Items · Mobs · All) o abre cualquier textura de la carpeta entity. La criatura aparece en 3D y se pinta como un bloque. Usa las opciones de al lado (variante, edad, color de lana, profesión, etc.) para llegar a cada textura que usa; capas como la lana de oveja, los ojos que brillan y la ropa de los aldeanos se pintan en sus propias texturas. En la lista Parts, haz clic en una parte para ocultarla y pintar lo que tapa, doble clic para ver solo esa parte, y Show all para que vuelva todo. Las criaturas de Bedrock usan los modelos propios de Bedrock y se conservan las máscaras de tinte ocultas en sus píxeles transparentes.',
        ),
      ],
    },
    {
      id: 'gear',
      q: '¿Puedo editar sillas de montar, armaduras y armaduras de caballo?',
      a: [
        p(
          'Sí. Las criaturas que pueden llevar cosas muestran un grupo ',
          strong('Wearing'),
          ' en sus opciones: pon una silla a un cerdo, un lavagante, un caballo, un camello o un nautilo; viste de armadura a zombis, esqueletos, piglins y al soporte para armaduras (elige un material para todo el conjunto y luego activa o desactiva piezas sueltas, y tiñe el cuero con ',
          strong('Dye'),
          '); dales su armadura a caballos, lobos y nautilos, una alfombra a las llamas y un arnés al ghast feliz. Cada objeto puesto se pinta en su propia textura y tiene su propia entrada en ',
          strong('Parts'),
          ', así puedes ocultarlo para pintar la criatura de debajo. Al abrir una textura de armadura, silla o alfombra se ve puesta, y ',
          strong('Used by'),
          ' enumera cada criatura que la lleva. Las versiones antiguas usan las texturas de armadura y silla que tenían entonces.',
        ),
        p(
          strong('Adornos de armadura: '),
          'con armadura humanoide puesta, elige un patrón en ',
          strong('Trim'),
          ' y un ',
          strong('Material'),
          ' en Wearing (Java 1.20 y posteriores, y Bedrock). El juego colorea el patrón gris con la paleta del material, y usa una paleta más oscura cuando el adorno coincide con la armadura, como un adorno de hierro en una armadura de hierro. Pinta el adorno sobre el modelo o abre su patrón: los ocho grises toman el color del adorno y cualquier otro color se queda tal como lo pintes. Edita la paleta de un material para cambiar su color en todos los adornos, y oculta ',
          strong('Trim'),
          ' en Parts para llegar a la armadura de debajo.',
        ),
      ],
    },
    {
      id: 'models',
      q: '¿Puedo cambiar la forma de bloques e ítems, como una espada 3D?',
      a: [
        p(
          'Sí, en packs de Java (Minecraft 1.8 o posterior). Muestra un bloque o ítem en la vista previa y pulsa ',
          strong('Edit shape'),
          '. El editor de modelos abre el modelo que usa el juego, calculado a partir de sus modelos padre. Añade, copia y borra cubos, escribe su posición y tamaño o arrastra las flechas y los tiradores en 3D, ajustados a la cuadrícula de 16 × 16 o más fina, y gira un cubo sobre un eje (en pasos de 22,5° antes de Minecraft 1.21.6). En ',
          strong('Faces'),
          ' da a cada cara una textura de tu pack, o una nueva que pintarás después, y arrastra la parte de la textura que muestra; elige también su giro, cuándo se oculta y si se tiñe. ',
          strong('Display'),
          ' define cómo se ve el modelo en el inventario, en primera y tercera persona, en el suelo, en un marco y en la cabeza, cada uno con vista previa. Cualquier cambio se puede deshacer.',
        ),
        p(
          'Para empezar, toma el modelo del juego, uno vacío, un cubo completo, una losa, una cruz como las flores o, en los ítems, ',
          strong('3D item from sprite'),
          ', que convierte la imagen plana en cubos de 1 píxel de grosor unidos en el menor número posible. Desde la 1.21.4, ',
          strong('Flat in the inventory'),
          ' mantiene el icono plano en el inventario y muestra el modelo 3D en la mano. El pack recibe el archivo del modelo y solo añade una definición de ítem o un estado de bloque cuando el juego los necesita; al exportar se revisan los modelos para tu versión, y los archivos de modelo de los packs que abres se conservan y se pueden editar. En Bedrock, las nuevas formas de bloque necesitan un complemento y los ítems 3D en la mano necesitan archivos attachable, que el editor no crea; puedes descargar un modelo como geometría de Bedrock como punto de partida. Paso a paso: ',
          link('/guides/make-3d-items-texture-pack', 'Cómo hacer ítems 3D'),
          '.',
        ),
      ],
    },
    {
      id: 'sounds',
      q: '¿Puedo cambiar los sonidos de mi pack?',
      a: [
        p('Sí. En el editor de texture packs, pulsa la nota musical al final del selector Blocks · Items · Mobs · All. Busca un sonido por nombre o categoría y pulsa reproducir para oírlo. Ábrelo y usa ', strong('Replace'), ' para cambiar un archivo por tu propio audio (MP3, WAV, OGG, M4A y más) o grábalo con el micrófono. Arrastra los controles de la forma de onda para recortarlo, ajusta el volumen o pulsa ', strong('Normalise'), ', y con Reset vuelves al sonido del juego. Los sonidos reemplazados se guardan en Ogg Vorbis y se exportan con tu pack: en Java van a ', code('assets/minecraft/sounds'), ' y en Bedrock a ', code('sounds/'), ' con sus entradas en ', code('sound_definitions.json'), '.'),
        p('La grabación solo pide acceso al micrófono al pulsar Start; si está bloqueado, permítelo para este sitio desde el icono de la barra de direcciones. Las grabaciones nunca salen de tu dispositivo. Deja la mayoría de sonidos en mono para que suenen desde donde ocurren en el mundo, y usa estéreo para la música y los menús. Los sonidos de Java se reproducen directamente desde los servidores de Mojang, que no dejan a las webs leer el audio, así que puedes escucharlos pero solo recortar los que subas o grabes. La edición de sonidos funciona en Java 1.7.10 o posterior y en Bedrock.'),
      ],
    },
    {
      id: 'hd-skins',
      q: '¿Puedo hacer una skin HD de 128×128?',
      a: [
        p('Sí, para Bedrock Edition. Las skins HD tienen el doble de píxeles que una normal (128×128 en lugar de 64×64), así que caras, sombras y estampados pueden ser más finos. Al empezar una skin en el editor de skins, elige ', strong('HD 128×128'), ' en ', strong('Size'), ', o cambia una skin existente en el editor con ', strong('Size'), ' › ', strong('HD 128'), ': cada píxel se duplica, así que se ve igual hasta que añadas detalle. Exporta ', strong('Bedrock skin (.png)'), ' para importarla en el Vestidor, o un ', strong('Bedrock skin pack (.mcpack)'), '. Un pack de skins puede mezclar skins normales y HD.'),
        p('Java Edition solo acepta skins de 64×64 sin mods, así que la exportación para Java crea una copia de 64×64 (cada bloque de 2×2 se convierte en un píxel) y conserva tu original HD. Si usas un mod de skins HD como CustomSkinLoader, elige ', strong('128×128 for mods'), '. Las consolas no pueden importar archivos de skin, y los tamaños mayores de 128×128 no son compatibles. Las skins HD también funcionan en el creador de tótems.'),
      ],
    },
    {
      id: 'upload',
      q: '¿Se sube algo?',
      a: [p('No. Tus proyectos, imágenes y packs exportados nunca salen de tu dispositivo. La app solo descarga cosas: archivos del juego de Mojang, la lista de versiones y las skins que buscas por nombre de usuario.')],
    },
    {
      id: 'offline',
      q: '¿Funciona sin conexión?',
      a: [p('Sí, después de la primera carga. La app y cada versión que ya abriste se quedan en este dispositivo, así que puedes seguir editando sin internet. Una versión que todavía no usaste necesita conexión, o elige ', strong('Use my own .jar'), ' y escógela en tu carpeta ', code('.minecraft/versions'), '.')],
    },
    {
      id: 'storage',
      q: '¿Dónde se guardan mis proyectos?',
      a: [p('En el almacenamiento de tu navegador en este dispositivo. Se quedan ahí hasta que los borres o borres los datos de esta web. Para hacer una copia de seguridad o pasar un proyecto a otro ordenador, expórtalo y abre el archivo allí con ', strong('Open a pack'), '.')],
    },
    {
      id: 'versions',
      q: '¿Qué versiones de Minecraft son compatibles?',
      a: [p(`Java ${LATEST} es la predeterminada y funcionan todas las versiones de Java hasta la 1.6.1 (cuando llegaron los paquetes de recursos), también las snapshots si las activas. Para Bedrock puedes usar la última versión, la última preview y versiones anteriores.`)],
    },
    {
      id: 'pack-format',
      q: `¿Cuál es el formato de paquete de recursos de Minecraft Java ${LATEST}?`,
      a: [
        p(
          `Java ${LATEST} usa el formato de paquete de recursos ${F(LATEST)}. Un pack hecho solo para ${LATEST} declara `,
          code(`"min_format": ${minFormat(LATEST)}`),
          ' y ',
          code(`"max_format": ${maxFormat(LATEST)}`),
          ' en su ',
          code('pack.mcmeta'),
          '. Texture Pack Maker escribe estos campos por ti. Mira ',
          link('/guides/minecraft-pack-format-versions', 'el formato de cada versión de Java'),
          '.',
        ),
      ],
    },
    {
      id: 'java-vs-bedrock',
      q: '¿Qué diferencia hay entre los packs de Java y de Bedrock?',
      a: [
        p(
          'Un pack de Java es un ',
          code('.zip'),
          ' con un archivo ',
          code('pack.mcmeta'),
          ' y texturas PNG en ',
          code('assets/minecraft/textures/'),
          '. Un pack de Bedrock es un ',
          code('.mcpack'),
          ' con un ',
          code('manifest.json'),
          ' y texturas en ',
          code('textures/'),
          ' (PNG o TGA). Ninguna edición puede cargar los packs de la otra. ',
          link('/guides/java-vs-bedrock-packs', 'Comparativa completa'),
          '.',
        ),
      ],
    },
    {
      id: 'no-mods',
      q: '¿Puedo crear shaders sin mods?',
      a: [
        p(
          `Sí. En Java 1.17 y posteriores, un paquete de recursos puede cambiar los shaders del propio Minecraft (color, viñeta, niebla y bloom en ${LATEST}). En Bedrock, un pack de Visuales vibrantes cambia la iluminación, el cielo, la niebla y el agua integrados. Las sombras y los reflejos reales en Java siguen necesitando Iris u OptiFine. `,
          link('/guides/make-shaders-without-mods', 'Cómo funciona'),
          '.',
        ),
      ],
    },
    {
      id: 'phone',
      q: '¿Puedo usarlo en un móvil o una tablet?',
      a: [p('Sí. Todas las herramientas funcionan con pantalla táctil, incluido el zoom con dos dedos en los editores de píxeles. Para pixel art detallado es más cómoda una pantalla grande.')],
    },
    {
      id: 'official',
      q: '¿Es gratis? ¿Es oficial?',
      a: [p('Es gratis y de código abierto con licencia MIT.'), p('Texture Pack Maker no es un producto oficial de Minecraft y no está aprobado por Mojang ni Microsoft ni asociado con ellos.')],
    },
    {
      id: 'bug',
      q: 'Algo ha fallado. ¿Cómo lo aviso?',
      a: [p('Abre una incidencia (issue) en ', ext(`${REPO_URL}/issues`, 'GitHub'), ' con tu navegador, la versión del juego y lo que estabas haciendo. Las capturas de pantalla ayudan mucho.')],
    },
  ],
  quick: { 'java-packs': 'Instalar un texture pack', 'java-skins': 'Cambiar tu skin', iris: 'Usar un shader pack', faq: 'Preguntas' },
  toc: {
    title: 'En esta página',
    textures: 'Texture packs',
    skins: 'Skins',
    shaders: 'Shaders',
    more: 'Más',
    irisOptifine: 'Iris / OptiFine',
    vanilla: 'Vanilla (sin mods)',
    vibrant: 'Visuales vibrantes',
    folders: 'Carpetas',
    faq: 'Preguntas frecuentes',
    allGuides: 'Todas las guías',
  },
  bothEditions: 'Java y Bedrock',
  eyebrow: 'Guía de instalación y ayuda',
  title: 'Cómo instalar texture packs, skins y shaders',
  lead: 'Mete tus creaciones en Minecraft: guías paso a paso para Java y Bedrock en PC, Mac, móviles y consolas, y respuestas a las preguntas más comunes.',
  faqTitle: 'Preguntas frecuentes',
};
