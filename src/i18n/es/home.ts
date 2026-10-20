// Spanish home page (see HomeText in src/tools/home/content.ts).

import { el } from '../../app/markup';
import { link } from '../../app/content/blocks';
import { F, LATEST } from '../../app/content/facts';
import type { HomeText } from '../../tools/home/content';

const code = (t: string) => el('code', null, t);

export const HOME: HomeText = {
  tools: {
    textures: {
      title: 'Texture packs',
      blurb: 'Pinta de nuevo cualquier bloque, ítem o criatura, o cambia el estilo de todo el juego con un clic.',
      features: ['Todas las texturas, cualquier versión', 'Editor de píxeles y efectos', 'Abre packs que ya tienes'],
      cta: 'Crear un texture pack',
      previewLabel: '',
    },
    skins: {
      title: 'Skins',
      blurb: 'Pinta a tu jugador sobre la plantilla de 64×64 mientras un modelo 3D se actualiza en vivo.',
      features: ['Clásica y delgada, dos capas', 'Plantillas o cualquier usuario', 'Exporta para Java y Bedrock'],
      cta: 'Diseñar una skin',
      previewLabel: 'Pinta píxel a píxel',
    },
    shaders: {
      title: 'Shaders',
      blurb: 'Ajusta la luz, el color, la niebla y el agua con controles y una vista previa en vivo.',
      features: ['Packs para Iris / OptiFine', 'Shaders vanilla sin mods', 'Visuales vibrantes de Bedrock'],
      cta: 'Crear un shader',
      previewLabel: 'Vista de día y de noche',
    },
  },
  faq: [
    {
      id: 'how',
      q: '¿Cómo creo un texture pack de Minecraft?',
      a: [
        el(
          'p',
          null,
          'Abre el ',
          link('/textures', 'editor de texture packs'),
          ', elige Java o Bedrock y tu versión del juego, y luego pinta texturas, sube tus propias imágenes o aplica un efecto con un clic. Exporta un ',
          code('.zip'),
          ' (Java) o un ',
          code('.mcpack'),
          ' (Bedrock) y actívalo en el juego. ',
          link('/guides/make-a-texture-pack', 'Guía paso a paso'),
          '.',
        ),
      ],
    },
    {
      id: 'what',
      q: '¿Qué es Texture Pack Maker?',
      a: [
        el(
          'p',
          null,
          'Texture Pack Maker es una web gratuita para crear texture packs, skins y shaders de Minecraft. Todo funciona en tu navegador: eliges una versión del juego, editas con vistas previas en vivo y descargas un pack listo para Java o Bedrock.',
        ),
      ],
    },
    {
      id: 'free',
      q: '¿Es gratis? ¿Necesito una cuenta?',
      a: [el('p', null, 'Es gratis, no hay cuenta ni registro y el código es abierto con licencia MIT. Tus proyectos se quedan en tu propio dispositivo.')],
    },
    {
      id: 'bedrock',
      q: '¿Funciona con Minecraft Bedrock?',
      a: [
        el(
          'p',
          null,
          'Sí. Los texture packs y las skins se exportan como archivos ',
          code('.mcpack'),
          ' que Bedrock importa al abrirlos, y el Shader Maker crea packs de Visuales vibrantes. Mira ',
          link('/guides/java-vs-bedrock-packs', 'en qué se diferencian los packs de Java y de Bedrock'),
          '.',
        ),
      ],
    },
    {
      id: 'versions',
      q: '¿Para qué versiones de Java puedo crear packs?',
      a: [
        el(
          'p',
          null,
          `Java ${LATEST} viene seleccionada por defecto y funcionan todas las versiones hasta la 1.6.1. Cada pack recibe las reglas de `,
          code('pack.mcmeta'),
          ` de la versión que elijas (${LATEST} usa el formato de paquete de recursos ${F(LATEST)}). `,
          link('/guides/minecraft-pack-format-versions', 'Todos los formatos de pack'),
          '.',
        ),
      ],
    },
    {
      id: 'resource',
      q: '¿Un texture pack es lo mismo que un paquete de recursos?',
      a: [
        el(
          'p',
          null,
          'Casi. Java Edition los llama paquetes de recursos: además de texturas pueden cambiar modelos, sonidos, fuentes y shaders. Bedrock también los llama paquetes de recursos y usa archivos ',
          code('.mcpack'),
          '. Esta herramienta crea los dos.',
        ),
      ],
    },
    {
      id: 'skinpack',
      q: '¿Puedo crear mi propio pack de skins?',
      a: [
        el(
          'p',
          null,
          'Sí. Pinta tus skins (brazos clásicos o delgados) en el ',
          link('/skins', 'editor de skins'),
          ' y expórtalas juntas en un pack de skins de Bedrock, o descarga un PNG para Java. ',
          link('/skin-pack-maker', 'Creador de packs de skins'),
          '.',
        ),
      ],
    },
    {
      id: 'install',
      q: '¿Tengo que instalar algo?',
      a: [el('p', null, 'No. Funciona en cualquier navegador actual en ordenador, móvil o tablet. Después de la primera visita, la app sigue funcionando sin conexión.')],
    },
  ],
  appFeatures: [
    `Creador de texture packs de Minecraft para Java Edition (${LATEST} y todas las versiones desde 1.6.1) y Bedrock Edition`,
    'Editor de skins de Minecraft con vista previa 3D en vivo, modelos clásico y delgado, exportación PNG para Java y packs de skins para Bedrock',
    'Creador de shaders para shader packs de Iris / OptiFine, shaders vanilla de Java sin mods y packs de Visuales vibrantes para Bedrock',
    'Exporta archivos .zip y .mcpack listos para usar con el pack.mcmeta o el manifest.json correctos',
    'Funciona en el navegador: sin registro, sin subir nada y sin conexión después de la primera visita',
  ],
  hero: {
    chip: 'Gratis · Sin registro',
    chipOffline: ' · Funciona sin conexión',
    title: { pre: 'Crea texture packs de ', accent: 'Minecraft' },
    lead: 'Crea tus propios texture packs, skins y shaders directamente en el navegador: un creador de paquetes de recursos gratis para Java y Bedrock, con descargas listas para meter en el juego.',
    start: 'Empezar a crear',
    install: 'Cómo instalar',
    everything: 'Mira todo lo que puedes crear',
    editionsLabel: 'Ediciones compatibles',
    chips: [`Java ${LATEST}`, 'Todas las versiones 1.6.1+', 'Bedrock'],
    blockLabel: 'Un bloque de hierba en pixel art',
    dragHint: 'Arrastra para girar',
  },
  toolsSection: {
    eyebrow: 'Tres herramientas, un sitio',
    title: '¿Qué quieres crear?',
    lead: 'Todo lo que necesitas para darle a Minecraft tu propio estilo. Sin instalar nada y sin cuentas: abre una herramienta y empieza.',
  },
  converter: {
    title: 'Convertidor de texture packs',
    text: `Convierte un pack de Java en uno de Bedrock o al revés, actualiza un pack antiguo a ${LATEST} o convierte PNG en un .mcpack.`,
    cta: 'Convertir un pack',
  },
  features: {
    eyebrow: 'Creador de packs gratis',
    title: 'Todo lo que necesita un creador de texture packs',
    lead: 'Desde una sola espada repintada hasta un paquete de recursos HD completo, creado y exportado sin salir del navegador.',
    titles: [
      'Editor de texture packs con modelos 3D',
      'Generador de texture packs con un clic',
      'Abre y edita packs existentes',
      'Paquetes de recursos para Java y Bedrock',
      'Editor de skins y creador de packs de skins',
      'Creador de shaders, con o sin mods',
    ],
    items: [
      ['Pinta cada bloque, ítem y criatura de tu versión directamente sobre su modelo 3D real: hornos, cofres, escaleras y más de 80 criaturas, de los creepers a los aldeanos.'],
      ['Cambia el estilo de todo el juego a la vez con efectos como Dark Mode, Pastel, Retro 8-bit, Autumn o Smooth HD, y luego retoca a mano.'],
      ['Carga cualquier ', code('.zip'), ' de Java o ', code('.mcpack'), ' de Bedrock y sigue editando, o pásalo a la otra edición con el ', link('/texture-pack-converter', 'convertidor de packs'), '.'],
      ['Un generador de paquetes de recursos que escribe el ', code('pack.mcmeta'), ` exacto para Java ${LATEST} hasta 1.6.1, o un `, code('manifest.json'), ' de Bedrock.'],
      ['Diseña skins en 2D o 3D con brazos clásicos o delgados y júntalas con el ', link('/skin-pack-maker', 'creador de packs de skins'), ' en un solo .mcpack de Bedrock.'],
      ['Crea shader packs para Iris y OptiFine, shaders vanilla de Java que no necesitan mods o packs de Visuales vibrantes para Bedrock.'],
    ],
  },
  why: {
    eyebrow: 'Por qué es diferente',
    title: '¿Por qué Texture Pack Maker?',
    lead: ['Gratis, de código abierto y privado, con todas las versiones de Java desde la 1.6.1, Bedrock y siete herramientas en un solo sitio. ', link('/about', 'Acerca del proyecto'), '.'],
  },
  how: {
    eyebrow: 'Cómo funciona',
    title: 'De la idea al juego en minutos',
    steps: [
      { title: 'Elige tu juego', text: `Java ${LATEST} viene lista por defecto, o elige cualquier versión de Java hasta la 1.6.1, o Bedrock.` },
      { title: 'Crea', text: 'Pinta píxeles, combina efectos de un clic o mueve los controles de shaders, con vistas previas 3D en vivo.' },
      { title: 'Exporta y juega', text: 'Descarga un .zip o .mcpack listo para usar y sigue la guía de instalación para usarlo en el juego.' },
    ],
    values: [
      { title: 'Privado desde el diseño', text: 'Tu trabajo nunca sale de tu dispositivo. Los archivos del juego los descarga tu propio navegador desde Mojang.' },
      { title: 'Funciona sin conexión', text: 'Después de la primera visita, la app y los archivos del juego descargados se guardan en este dispositivo.' },
      { title: 'Siempre el formato correcto', text: 'Los archivos del pack se escriben para la versión exacta que elijas, así Minecraft los carga sin quejarse.' },
    ],
  },
  guides: { eyebrow: 'Guías', title: 'Aprende lo básico', lead: 'Guías cortas y comprobadas para crear e instalar packs, skins y shaders.', all: 'Todas las guías' },
  faqHead: { eyebrow: 'Preguntas', title: 'Bueno saberlo' },
  cta: { title: '¿Listo para crear algo?', text: 'Elige una herramienta y tu primer pack puede estar en el juego en unos minutos.', button: 'Empezar a crear' },
  startDialog: '¿Qué quieres crear?',
};
