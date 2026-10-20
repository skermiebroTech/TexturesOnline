// German privacy policy (see PrivacyText in src/tools/privacy/content.ts).

import { code, ext, link, strong } from '../../app/content/blocks';
import { PUBLISHER, REPO_URL, SITE_NAME } from '../../app/site';
import type { PrivacyText } from '../../tools/privacy/content';

export const PRIVACY: PrivacyText = {
  eyebrow: 'Datenschutz',
  title: 'Datenschutzerklärung',
  intro: `${SITE_NAME} ist so gebaut, dass deine Arbeit dein Gerät nie verlässt. Es gibt keine Konten, keine Werbung und kein Tracking. Diese Seite erklärt, was das im Alltag bedeutet, für die Website und für die installierte App.`,
  updated: 'Zuletzt geändert',
  sections: [
    {
      id: 'nothing-uploaded',
      title: 'Nichts, was du erstellst, wird hochgeladen',
      body: [
        [
          'Jedes Tool läuft in deinem Browser. Packs, Skins, Shader und Bilder, die du öffnest, bearbeitest und exportierst, werden auf deinem Gerät verarbeitet und weder an diese Seite noch an sonst jemanden geschickt. Exporte (',
          code('.zip'),
          ', ',
          code('.mcpack'),
          ', ',
          code('.png'),
          ') entstehen auf deinem Gerät und landen direkt in deinen Downloads.',
        ],
      ],
    },
    {
      id: 'no-tracking',
      title: 'Keine Konten, keine Werbung, kein Tracking',
      body: [
        ['Es gibt keine Registrierung und keine Anmeldung. Die Seite hat keine Werbung, keine Tracking-Cookies und keine Tracker von Dritten. Es werden keine personenbezogenen Daten erhoben, verkauft oder weitergegeben.'],
        [
          'Um zu sehen, welche Seiten und Tools genutzt werden, zählt die Website Besuche mit ',
          ext('https://www.cloudflare.com/web-analytics/', 'Cloudflare Web Analytics'),
          '. Das kommt ohne Cookies aus, verfolgt dich nicht über andere Seiten hinweg und legt kein Profil von dir an: Erfasst werden die Seite, die Seite, von der du kommst, dein Land und die Art von Browser und Gerät. Was du erstellst, gehört nie dazu.',
        ],
      ],
    },
    {
      id: 'on-your-device',
      title: 'Was auf deinem Gerät gespeichert wird',
      body: [
        [
          strong('Deine Projekte'),
          ' werden im Speicher deines Browsers (IndexedDB) abgelegt, damit du später weitermachen kannst. ',
          strong('Spieldateien'),
          ', die du heruntergeladen hast, liegen ebenfalls dort, damit die Tools offline funktionieren. ',
          strong('Einstellungen'),
          ' wie das helle oder dunkle Design stehen im lokalen Speicher, und die Dateien der App selbst werden zwischengespeichert, damit sie ohne Verbindung startet.',
        ],
        ['All das bleibt auf deinem Gerät. Löschst du ein Projekt in der App, ist es weg. Um alles zu entfernen, lösche die Daten dieser Seite in den Einstellungen deines Browsers oder deinstalliere die App.'],
      ],
    },
    {
      id: 'other-services',
      title: 'Dienste, mit denen dein Browser sich verbindet',
      body: [
        [
          'Wenn du eine Spielversion auswählst, lädt dein Browser deren Dateien direkt von Mojang (',
          code('piston-meta.mojang.com'),
          ', ',
          code('piston-data.mojang.com'),
          ', ',
          code('resources.download.minecraft.net'),
          '). Bedrock-Dateien kommen aus Mojangs Repository ',
          ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'),
          ' über GitHub und jsDelivr, die Liste der Java-Versionen von jsDelivr.',
        ],
        ['Suchst du den Skin eines Spielers über den Namen, wird dieser Name an playerdb.co (oder mc-heads.net) geschickt, um den Skin zu finden, der dann von textures.minecraft.net geladen wird.'],
        ['Diese Dienste erhalten die üblichen Angaben einer Anfrage, etwa deine IP-Adresse, wie bei jeder Website, und haben eigene Datenschutzerklärungen. Nichts, was du erstellt hast, wird an sie geschickt.'],
      ],
    },
    {
      id: 'hosting',
      title: 'Hosting',
      body: [
        [
          'Die Seite wird über GitHub Pages bereitgestellt. GitHub kann technische Angaben wie IP-Adressen protokollieren, um den Dienst zu betreiben und zu schützen; siehe die ',
          ext('https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement', 'Datenschutzerklärung von GitHub'),
          '.',
        ],
      ],
    },
    {
      id: 'app',
      title: 'Die installierte App',
      body: [['Die App, die du aus deinem Browser oder aus dem Microsoft Store installierst, ist genau diese Website in einem eigenen Fenster. Alles auf dieser Seite gilt für sie genauso.']],
    },
    {
      id: 'children',
      title: 'Kinder',
      body: [[`${SITE_NAME} erhebt von niemandem personenbezogene Daten, auch nicht von Kindern.`]],
    },
    {
      id: 'contact',
      title: 'Änderungen und Fragen',
      body: [
        ['Ändert sich diese Erklärung, wird diese Seite mit neuem Datum aktualisiert.'],
        [`${SITE_NAME} wird von ${PUBLISHER.name} gemacht. Fragen sind als Issue auf `, ext(`${REPO_URL}/issues`, 'GitHub'), ' willkommen. Mehr über das Projekt steht auf der Seite ', link('/about', 'Über uns'), '.'],
      ],
    },
  ],
};
