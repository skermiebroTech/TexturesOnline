// Spanish page titles, descriptions and short names (see MetaTranslation in src/app/seo/meta.ts).

import type { MetaTranslation } from '../../app/seo/meta';
import { F, LATEST } from '../../app/content/facts';

export const META_ES: MetaTranslation = {
  pages: {
    '/': {
      title: 'Crear texture pack de Minecraft gratis – Java y Bedrock',
      description: `Crea tu propio texture pack de Minecraft en minutos: pinta bloques en modelos 3D, aplica estilos con un clic y exporta .zip o .mcpack. Gratis, Java ${LATEST}.`,
      label: 'Inicio',
    },
    '/textures': {
      title: 'Editor de texture packs y creador de paquetes de recursos',
      description: 'Edita cualquier textura de Minecraft: pinta bloques, ítems y criaturas en 3D, sube PNG o cambia el estilo del juego con un clic. Exporta .zip o .mcpack.',
      label: 'Texture packs',
    },
    '/texture-pack-converter': {
      title: 'Convertidor de texture packs de Minecraft: Java a Bedrock',
      description: 'Convierte un texture pack de Minecraft de Java a Bedrock, de Bedrock a Java o entre versiones de Java, o pasa PNG a .mcpack. Gratis, en el navegador.',
      label: 'Convertidor de texture packs',
    },
    '/merge-texture-packs': {
      title: 'Combinar texture packs de Minecraft online – Java y Bedrock',
      description: 'Combina varios texture packs de Minecraft en un solo .zip o .mcpack. Ordénalos y el pack de arriba gana, igual que en el juego. Gratis, en tu navegador.',
      label: 'Combinar texture packs',
    },
    '/totem-maker': {
      title: 'Crea un tótem de la inmortalidad personalizado – Minecraft',
      description: 'Convierte cualquier skin de Minecraft en un tótem de la inmortalidad: sube un PNG o escribe un nombre, elige estilo y descarga un .zip de Java o .mcpack.',
      label: 'Creador de tótems',
    },
    '/skins': {
      title: 'Editor de skins de Minecraft y creador de packs de skins',
      description: 'Pinta una skin de Minecraft en 2D o 3D, con brazos clásicos o delgados, y expórtala como PNG para Java o en un pack de skins de Bedrock (.mcpack). Gratis.',
      label: 'Skins',
    },
    '/skin-pack-maker': {
      title: 'Crear pack de skins de Minecraft gratis (.mcpack Bedrock)',
      description: 'Crea tu pack de skins de Minecraft online: pinta o sube skins, mezcla brazos clásicos y delgados y descarga un .mcpack de Bedrock listo para el juego.',
      label: 'Creador de packs de skins',
    },
    '/shaders': {
      title: 'Crear shaders de Minecraft: Iris, OptiFine y sin mods',
      description: 'Crea shader packs para Iris u OptiFine, shaders vanilla sin mods para Java o packs de Visuales vibrantes para Bedrock, con presets y vista previa 3D.',
      label: 'Shaders',
    },
    '/help': {
      title: 'Cómo instalar texture packs, skins y shaders en Minecraft',
      description: 'Instala texture packs, skins y shaders en Minecraft Java y Bedrock en PC, Mac, móvil y consola, encuentra la carpeta resourcepacks y soluciona errores.',
      label: 'Ayuda',
    },
    '/about': {
      title: 'Acerca de Texture Pack Maker: herramientas gratis y libres',
      description: 'Quién hace Texture Pack Maker, qué lo hace distinto (cada versión de Java desde 1.6.1, Bedrock, un convertidor, código abierto) y cómo protege tu trabajo.',
      label: 'Acerca de',
    },
    '/privacy': {
      title: 'Política de privacidad – Texture Pack Maker',
      description: 'Texture Pack Maker no tiene cuentas, anuncios ni rastreo. Tus packs, skins y shaders se quedan en tu dispositivo y nada de lo que creas se sube.',
      label: 'Privacidad',
    },
    '/guides': {
      title: 'Guías de Minecraft: texture packs, skins y shaders',
      description: `Guías paso a paso para crear e instalar texture packs, skins y shaders de Minecraft, y el formato de pack de cada versión de Java de 1.6.1 a ${LATEST}.`,
      label: 'Guías',
    },
  },
  guides: {
    'make-a-texture-pack': {
      title: 'Cómo crear un texture pack de Minecraft (Java y Bedrock)',
      h1: 'Cómo crear un texture pack de Minecraft',
      description: 'Crea tu texture pack de Minecraft gratis: elige una versión, pinta texturas, exporta un .zip con pack.mcmeta (Java) o un .mcpack (Bedrock) e instálalo.',
      label: 'Crear un texture pack',
      blurb: 'Elige una versión, pinta texturas y exporta un pack que Minecraft carga.',
    },
    'install-resource-packs': {
      title: 'Cómo instalar un texture pack de Minecraft (Java y Bedrock)',
      h1: 'Cómo instalar texture packs, shaders y archivos .mcpack en Minecraft',
      description: 'Instala un paquete de recursos en Java, importa un .mcpack de Bedrock en PC o móvil, añade shaders con Iris u OptiFine y arregla packs que no aparecen.',
      label: 'Instalar packs y shaders',
      blurb: 'Paquetes de recursos de Java, archivos .mcpack de Bedrock y shader packs, con soluciones.',
    },
    'texture-pack-not-working': {
      title: '¿Tu texture pack de Minecraft no funciona? Soluciones',
      h1: '¿Tu texture pack de Minecraft no funciona? Cómo arreglarlo',
      description: 'El pack no sale en la lista, «versión anterior», bloques morados y negros, hierba gris, .mcpack que no se importa: qué significa y cómo arreglarlo.',
      label: '¿No funciona el pack? Soluciones',
      blurb: 'Packs que no aparecen, avisos de versión, bloques morados y negros y más.',
    },
    'minecraft-pack-format-versions': {
      title: `Pack format de Minecraft ${LATEST} (${F(LATEST)}) y todas las versiones`,
      h1: `Pack format de Minecraft para cada versión de Java (${LATEST} usa ${F(LATEST)})`,
      description: `Cada versión de Minecraft Java de 1.6.1 a ${LATEST} con su formato de paquete de recursos (${LATEST} usa ${F(LATEST)}) y cómo ha cambiado pack.mcmeta con los años.`,
      label: 'Formatos de pack por versión',
      blurb: `El pack format de cada versión de Java, de 1.6.1 a ${LATEST}.`,
    },
    'make-a-skin': {
      title: 'Cómo hacer una skin de Minecraft (Java y Bedrock)',
      h1: 'Cómo hacer tu propia skin de Minecraft',
      description: 'Haz una skin de Minecraft gratis: pinta la plantilla de 64×64 o HD de 128×128 en 2D o 3D, elige brazos clásicos o delgados y úsala en Java o Bedrock.',
      label: 'Hacer una skin',
      blurb: 'Pinta la plantilla de 64×64 o HD de 128×128 para Java o un pack de skins de Bedrock.',
    },
    'make-shaders-without-mods': {
      title: 'Shaders de Minecraft sin mods ni OptiFine (Java y Bedrock)',
      h1: '¿Se pueden tener shaders en Minecraft sin mods?',
      description: 'Sí: en Java 1.17+ un paquete de recursos cambia los shaders del juego (sin OptiFine ni Iris) y Bedrock tiene Visuales vibrantes. Qué se puede y cómo.',
      label: 'Shaders sin mods',
      blurb: 'Lo que pueden hacer los shaders vanilla de Java y Visuales vibrantes en Bedrock.',
    },
    'java-vs-bedrock-packs': {
      title: 'Texture packs Java vs Bedrock: diferencias y compatibilidad',
      h1: 'Texture packs de Java vs Bedrock: diferencias y cómo convertirlos',
      description: '¿Sirven los texture packs de Java en Bedrock? No: Java usa .zip + pack.mcmeta y Bedrock .mcpack + manifest.json. Carpetas, nombres, shaders y skins.',
      label: 'Packs de Java vs Bedrock',
      blurb: 'Archivos, carpetas, formatos, shaders y skins, comparados lado a lado.',
    },
    'bedrock-vibrant-visuals-settings': {
      title: 'Ajustes de Visuales vibrantes en Minecraft Bedrock',
      h1: 'Ajustes de Visuales vibrantes de Bedrock explicados',
      description: 'Qué puede cambiar un pack de Visuales vibrantes en Bedrock (sol, cielo, niebla, agua, sombras y color), qué dispositivos lo admiten y cómo activarlo.',
      label: 'Ajustes de Visuales vibrantes',
      blurb: 'Sol, cielo, niebla, agua y color, y los dispositivos compatibles.',
    },
    'convert-java-to-bedrock-texture-pack': {
      title: 'Convertir un texture pack de Java a Bedrock (y al revés)',
      h1: 'Cómo convertir un texture pack de Java a Bedrock',
      description: 'Convierte gratis un texture pack de Minecraft Java en un .mcpack de Bedrock (o de Bedrock a Java): qué se convierte, qué no y cómo instalar el resultado.',
      label: 'Convertir de Java a Bedrock',
      blurb: 'Pasa un pack de Java a un .mcpack de Bedrock, o al revés, en pocos clics.',
    },
    'merge-texture-packs': {
      title: 'Cómo combinar texture packs de Minecraft (Java y Bedrock)',
      h1: 'Cómo combinar texture packs de Minecraft',
      description: 'Junta varios texture packs de Minecraft en uno para un servidor, un Realm o para compartir: qué pack gana, qué se combina y cómo hacerlo online o a mano.',
      label: 'Combinar texture packs',
      blurb: 'Junta varios packs en uno, en el orden que elijas.',
    },
    'make-a-bedrock-skin-pack': {
      title: 'Cómo hacer un pack de skins de Minecraft Bedrock (gratis)',
      h1: 'Cómo hacer un pack de skins de Minecraft Bedrock',
      description: 'Crea un pack de skins para Minecraft Bedrock: pinta o sube skins, exporta un .mcpack, impórtalo en PC o móvil, actualízalo o crea los archivos a mano.',
      label: 'Pack de skins de Bedrock',
      blurb: 'Junta tus skins en un .mcpack y póntelas desde el Vestidor.',
    },
    'make-3d-items-texture-pack': {
      title: 'Cómo hacer ítems 3D en un texture pack de Minecraft',
      h1: 'Cómo hacer ítems 3D y modelos propios en un texture pack de Minecraft',
      description: 'Convierte ítems planos de Minecraft en 3D y cambia la forma de bloques en un pack de Java: JSON de modelos, definiciones de ítem 1.21.4+ y soluciones.',
      label: 'Hacer ítems 3D',
      blurb: 'Convierte ítems planos en modelos 3D y cambia la forma de bloques, archivo a archivo.',
    },
  },
};
