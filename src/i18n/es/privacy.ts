// Spanish privacy policy (see PrivacyText in src/tools/privacy/content.ts).

import { code, ext, link, strong } from '../../app/content/blocks';
import { PUBLISHER, REPO_URL, SITE_NAME } from '../../app/site';
import type { PrivacyText } from '../../tools/privacy/content';

export const PRIVACY: PrivacyText = {
  eyebrow: 'Privacidad',
  title: 'Política de privacidad',
  intro: `${SITE_NAME} está hecho para que tu trabajo nunca salga de tu dispositivo. No hay cuentas, ni anuncios, ni rastreo. Esta página explica qué significa eso en la práctica, para el sitio web y para la app instalada.`,
  updated: 'Última actualización',
  sections: [
    {
      id: 'nothing-uploaded',
      title: 'Nada de lo que creas se sube',
      body: [
        [
          'Cada herramienta funciona en tu navegador. Los packs, skins, shaders e imágenes que abres, editas y exportas se procesan en tu dispositivo y no se envían a este sitio ni a nadie más. Las exportaciones (',
          code('.zip'),
          ', ',
          code('.mcpack'),
          ', ',
          code('.png'),
          ') se crean en tu dispositivo y se guardan directamente en tus descargas.',
        ],
      ],
    },
    {
      id: 'no-tracking',
      title: 'Sin cuentas, anuncios ni rastreo',
      body: [
        ['No hay registro ni inicio de sesión. El sitio no tiene anuncios, ni cookies de rastreo, ni rastreadores de terceros. No se recopila, vende ni comparte ningún dato personal.'],
        [
          'Para saber qué páginas y herramientas se usan, el sitio cuenta las visitas con ',
          ext('https://www.cloudflare.com/web-analytics/', 'Cloudflare Web Analytics'),
          '. No usa cookies, no te sigue por otros sitios ni crea un perfil tuyo: registra la página, el sitio del que vienes, tu país y el tipo de navegador y dispositivo. Lo que creas nunca forma parte de ello.',
        ],
      ],
    },
    {
      id: 'on-your-device',
      title: 'Qué se guarda en tu dispositivo',
      body: [
        [
          strong('Tus proyectos'),
          ' se guardan en el almacenamiento de tu navegador (IndexedDB) para que puedas volver a ellos. ',
          strong('Los archivos del juego'),
          ' que descargaste también se guardan ahí, para que las herramientas funcionen sin conexión. ',
          strong('Los ajustes'),
          ', como el tema claro u oscuro, se guardan en el almacenamiento local, y los archivos de la propia app se guardan en caché para que abra sin conexión.',
        ],
        ['Todo esto se queda en tu dispositivo. Al borrar un proyecto en la app, desaparece. Para quitarlo todo, borra los datos de este sitio en los ajustes de tu navegador o desinstala la app.'],
      ],
    },
    {
      id: 'other-services',
      title: 'Servicios a los que se conecta tu navegador',
      body: [
        [
          'Cuando eliges una versión del juego, tu navegador descarga sus archivos directamente de Mojang (',
          code('piston-meta.mojang.com'),
          ', ',
          code('piston-data.mojang.com'),
          ', ',
          code('resources.download.minecraft.net'),
          '). Los archivos de Bedrock vienen del repositorio ',
          ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'),
          ' de Mojang a través de GitHub y jsDelivr, y la lista de versiones de Java viene de jsDelivr.',
        ],
        ['Si buscas la skin de un jugador por su nombre, ese nombre se envía a playerdb.co (o mc-heads.net) para encontrar la skin, que luego se carga desde textures.minecraft.net.'],
        ['Estos servicios reciben los datos normales de una petición, como tu dirección IP, igual que cualquier sitio web, y tienen sus propias políticas de privacidad. Nada de lo que creaste se les envía.'],
      ],
    },
    {
      id: 'hosting',
      title: 'Alojamiento',
      body: [
        [
          'El sitio está alojado en GitHub Pages. GitHub puede registrar datos técnicos como direcciones IP para hacer funcionar y proteger su servicio; consulta la ',
          ext('https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement', 'declaración de privacidad de GitHub'),
          '.',
        ],
      ],
    },
    {
      id: 'app',
      title: 'La app instalada',
      body: [['La app que instalas desde tu navegador o desde Microsoft Store es este mismo sitio web en su propia ventana. Todo lo que dice esta página se aplica a ella de la misma forma.']],
    },
    {
      id: 'children',
      title: 'Menores',
      body: [[`${SITE_NAME} no recopila datos personales de nadie, tampoco de menores.`]],
    },
    {
      id: 'contact',
      title: 'Cambios y preguntas',
      body: [
        ['Si esta política cambia, esta página se actualizará con una nueva fecha.'],
        [`${SITE_NAME} lo hace ${PUBLISHER.name}. Puedes hacer preguntas abriendo un issue en `, ext(`${REPO_URL}/issues`, 'GitHub'), '. Hay más sobre el proyecto en la página ', link('/about', 'Acerca de'), '.'],
      ],
    },
  ],
};
