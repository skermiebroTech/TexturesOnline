// Spanish About page (see AboutText in src/tools/about/content.ts).

import { el } from '../../app/markup';
import { code, ext, link, strong } from '../../app/content/blocks';
import { PUBLISHER, REPO_URL } from '../../app/site';
import { F, LATEST } from '../../app/content/facts';
import type { AboutText } from '../../tools/about/content';

export const ABOUT: AboutText = {
  differences: [
    {
      title: 'Todas las versiones de Java desde la 1.6.1',
      text: [`No solo la última: crea un pack para ${LATEST}, 1.21.11, 1.20.1 o 1.8.9, cada una con sus texturas y el pack.mcmeta correcto.`],
    },
    {
      title: 'Java y Bedrock, y un convertidor',
      text: ['Crea packs para cualquiera de las dos ediciones y convierte un pack de Java en uno de Bedrock, o al revés, con el ', link('/texture-pack-converter', 'convertidor de texture packs'), '.'],
    },
    {
      title: 'Texturas, skins y shaders',
      text: ['Una sola web para texture packs, skins y packs de skins, y shaders para Iris, OptiFine, Java vanilla y Visuales vibrantes de Bedrock.'],
    },
    {
      title: 'No se sube nada',
      text: ['Todo funciona en tu navegador. Los archivos del juego vienen directamente de Mojang y tu trabajo se queda en tu dispositivo.'],
    },
    {
      title: 'Gratis y de código abierto',
      text: ['Sin cuenta, sin anuncios y sin planes de pago. El código es público con licencia MIT en ', ext(REPO_URL, 'GitHub'), '.'],
    },
    {
      title: 'Funciona sin conexión',
      text: ['Después de la primera visita, la app y los archivos del juego que usaste se guardan en tu dispositivo, así que sigue funcionando sin conexión.'],
    },
  ],
  faq: [
    {
      id: 'who',
      q: '¿Quién hace Texture Pack Maker?',
      a: [el('p', null, `Texture Pack Maker lo hace ${PUBLISHER.name}, un creador independiente. Es una herramienta hecha por fans y no tiene relación con Mojang ni Microsoft.`)],
    },
    {
      id: 'cost',
      q: '¿Cuesta algo?',
      a: [el('p', null, 'No. Todas las herramientas son gratis, sin cuenta, sin anuncios y sin límite de packs.')],
    },
    {
      id: 'files',
      q: '¿De dónde salen las texturas de Minecraft?',
      a: [
        el(
          'p',
          null,
          'Tu navegador las descarga de Mojang cuando eliges una versión: las texturas de Java, de los archivos oficiales del juego, y las de Bedrock, del repositorio ',
          ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'),
          ' de Mojang. Se guardan en tu dispositivo y nunca en esta web.',
        ),
      ],
    },
    {
      id: 'contact',
      q: '¿Cómo informo de un error o propongo una función?',
      a: [el('p', null, 'Abre una incidencia (issue) en ', ext(`${REPO_URL}/issues`, 'GitHub'), '. Indica qué herramienta, edición y versión estabas usando.')],
    },
  ],
  eyebrow: 'Acerca de',
  title: 'Acerca de Texture Pack Maker',
  intro: `Texture Pack Maker es una web gratuita y de código abierto para crear texture packs, skins y shaders de Minecraft en el navegador, para Java Edition (${LATEST} y todas las versiones hasta la 1.6.1) y Bedrock Edition. La hace ${PUBLISHER.name}.`,
  differentTitle: 'Qué hace distinto a Texture Pack Maker',
  toolsTitle: 'Las herramientas',
  tools: [
    [link('/textures', 'Creador de texture packs'), ': pinta de nuevo cualquier bloque, ítem o criatura sobre su modelo 3D, sube tus propias imágenes, cambia los sonidos, cambia el estilo de todo el pack con un clic o abre un pack existente.'],
    [link('/texture-pack-converter', 'Convertidor de texture packs'), ': de Java a Bedrock, de Bedrock a Java, entre versiones de Java o de texturas PNG a un .mcpack.'],
    [link('/merge-texture-packs', 'Combinar texture packs'), ': junta hasta ocho packs en uno, en el orden que elijas.'],
    [link('/pack-doctor', 'Pack Doctor'), ': descubre por qué un pack de Java o Bedrock no funciona en el juego y arréglalo con un clic.'],
    [link('/totem-maker', 'Creador de tótems'), ': convierte cualquier skin en un tótem de la inmortalidad personalizado, como paquete de recursos para Java o Bedrock.'],
    [link('/font-maker', 'Creador de fuentes'), ': dibuja una fuente de píxeles o convierte un archivo de fuente, mírala en el chat, en carteles y en libros, y descárgala como paquete de recursos.'],
    [link('/skins', 'Editor de skins'), ' y ', link('/skin-pack-maker', 'creador de packs de skins'), ': pinta skins en 2D o 3D con brazos clásicos o delgados y júntalas en un pack de skins de Bedrock.'],
    [link('/cape-maker', 'Creador de capas'), ': pinta una capa y unos élitros en 3D sobre la plantilla de 64×32 y descarga el PNG o un texture pack de élitros.'],
    [link('/shaders', 'Creador de shaders'), ': shader packs para Iris y OptiFine, shaders vanilla de Java que no necesitan mods y packs de Visuales vibrantes para Bedrock.'],
    [link('/guides', 'Guías'), ': cómo crear, instalar y arreglar packs, y el formato de pack de cada versión de Java.'],
  ],
  howTitle: 'Cómo funciona',
  how: [
    'Cuando eliges una versión del juego, tu navegador descarga las texturas de esa versión directamente de Mojang y las guarda en tu dispositivo. Tus proyectos también se guardan en el navegador (IndexedDB), y las exportaciones se crean en tu dispositivo: un ',
    code('.zip'),
    ' de Java con el ',
    code('pack.mcmeta'),
    ` correcto (Java ${LATEST} usa el pack format ${F(LATEST)}) o un `,
    code('.mcpack'),
    ' de Bedrock con un ',
    code('manifest.json'),
    '. Nada de lo que haces se envía a un servidor.',
  ],
  makerTitle: 'Quién lo hace',
  maker: ['Texture Pack Maker lo hace ', strong(PUBLISHER.name), '. El código fuente es público, así que cualquiera puede ver cómo funciona, proponer cambios o informar de problemas.'],
  notOfficial: 'No es un producto oficial de Minecraft. No está aprobado por Mojang ni Microsoft ni asociado con ellos.',
  questions: 'Preguntas frecuentes',
};
