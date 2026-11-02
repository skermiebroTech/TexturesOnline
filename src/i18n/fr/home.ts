// French home page (see HomeText in src/tools/home/content.ts).

import { el } from '../../app/markup';
import { link } from '../../app/content/blocks';
import { F, LATEST } from '../../app/content/facts';
import type { HomeText } from '../../tools/home/content';

const code = (t: string) => el('code', null, t);

export const HOME: HomeText = {
  tools: {
    textures: {
      title: 'Packs de textures',
      blurb: 'Repeins n’importe quel bloc, objet ou créature, ou change le style de tout le jeu en un clic.',
      features: ['Toutes les textures, toutes les versions', 'Éditeur de pixels et effets', 'Ouvre les packs que tu as déjà'],
      cta: 'Créer un pack de textures',
      previewLabel: '',
    },
    skins: {
      title: 'Skins',
      blurb: 'Peins ton joueur sur le modèle 64×64 pendant qu’un modèle 3D se met à jour en direct.',
      features: ['Classique et fin, deux couches', 'Modèles ou n’importe quel pseudo', 'Export pour Java et Bedrock'],
      cta: 'Dessiner un skin',
      previewLabel: 'Peins pixel par pixel',
    },
    shaders: {
      title: 'Shaders',
      blurb: 'Règle la lumière, les couleurs, le brouillard et l’eau avec des curseurs et un aperçu en direct.',
      features: ['Packs pour Iris / OptiFine', 'Shaders vanilla sans mods', 'Graphismes éclatants de Bedrock'],
      cta: 'Créer un shader',
      previewLabel: 'Aperçu de jour et de nuit',
    },
  },
  faq: [
    {
      id: 'how',
      q: 'Comment créer un pack de textures Minecraft ?',
      a: [
        el(
          'p',
          null,
          'Ouvre l’',
          link('/textures', 'éditeur de packs de textures'),
          ', choisis Java ou Bedrock et ta version du jeu, puis peins des textures, importe tes propres images ou applique un effet en un clic. Exporte un ',
          code('.zip'),
          ' (Java) ou un ',
          code('.mcpack'),
          ' (Bedrock) et active-le dans le jeu. ',
          link('/guides/make-a-texture-pack', 'Guide pas à pas'),
          '.',
        ),
      ],
    },
    {
      id: 'what',
      q: 'C’est quoi, Texture Pack Maker ?',
      a: [
        el(
          'p',
          null,
          'Texture Pack Maker est un site gratuit pour créer des packs de textures, des skins et des shaders Minecraft. Tout se passe dans ton navigateur : tu choisis une version du jeu, tu modifies avec des aperçus en direct et tu télécharges un pack prêt pour Java ou Bedrock.',
        ),
      ],
    },
    {
      id: 'free',
      q: 'C’est gratuit ? Il faut un compte ?',
      a: [el('p', null, 'C’est gratuit, sans compte ni inscription, et le code est open source sous licence MIT. Tes projets restent sur ton propre appareil.')],
    },
    {
      id: 'bedrock',
      q: 'Ça marche avec Minecraft Bedrock ?',
      a: [
        el(
          'p',
          null,
          'Oui. Les packs de textures et les skins s’exportent en fichiers ',
          code('.mcpack'),
          ' que Bedrock importe quand tu les ouvres, et le Shader Maker crée des packs Graphismes éclatants. Découvre ',
          link('/guides/java-vs-bedrock-packs', 'ce qui change entre les packs Java et Bedrock'),
          '.',
        ),
      ],
    },
    {
      id: 'versions',
      q: 'Pour quelles versions de Java puis-je créer des packs ?',
      a: [
        el(
          'p',
          null,
          `Java ${LATEST} est choisie par défaut et toutes les versions jusqu’à la 1.6.1 fonctionnent. Chaque pack reçoit les règles de `,
          code('pack.mcmeta'),
          ` de la version que tu choisis (${LATEST} utilise le format de pack de ressources ${F(LATEST)}). `,
          link('/guides/minecraft-pack-format-versions', 'Tous les formats de pack'),
          '.',
        ),
      ],
    },
    {
      id: 'resource',
      q: 'Un pack de textures, c’est la même chose qu’un pack de ressources ?',
      a: [
        el(
          'p',
          null,
          'Presque. Java Edition les appelle packs de ressources : en plus des textures, ils peuvent changer les modèles, les sons, les polices et les shaders. Bedrock aussi les appelle packs de ressources et utilise des fichiers ',
          code('.mcpack'),
          '. Cet outil crée les deux.',
        ),
      ],
    },
    {
      id: 'skinpack',
      q: 'Je peux créer mon propre pack de skins ?',
      a: [
        el(
          'p',
          null,
          'Oui. Peins tes skins (bras classiques ou fins) dans l’',
          link('/skins', 'éditeur de skins'),
          ' et exporte-les ensemble dans un pack de skins Bedrock, ou télécharge un PNG pour Java. ',
          link('/skin-pack-maker', 'Créateur de packs de skins'),
          '.',
        ),
      ],
    },
    {
      id: 'install',
      q: 'Je dois installer quelque chose ?',
      a: [el('p', null, 'Non. Ça marche dans n’importe quel navigateur récent sur ordinateur, téléphone ou tablette. Après la première visite, l’appli fonctionne même hors ligne.')],
    },
  ],
  appFeatures: [
    `Créateur de packs de textures Minecraft pour Java Edition (${LATEST} et toutes les versions depuis 1.6.1) et Bedrock Edition`,
    'Éditeur de skins Minecraft avec aperçu 3D en direct, modèles classique et fin, export PNG pour Java et packs de skins pour Bedrock',
    'Créateur de shaders pour les packs de shaders Iris / OptiFine, les shaders vanilla de Java sans mods et les packs Graphismes éclatants pour Bedrock',
    'Exporte des fichiers .zip et .mcpack prêts à l’emploi avec le bon pack.mcmeta ou manifest.json',
    'Fonctionne dans le navigateur : sans inscription, sans rien envoyer et hors ligne après la première visite',
  ],
  hero: {
    chip: 'Gratuit · Sans inscription',
    chipOffline: ' · Marche hors ligne',
    title: { pre: 'Crée des packs de textures ', accent: 'Minecraft' },
    lead: 'Crée tes propres packs de textures, skins et shaders directement dans ton navigateur : un créateur de packs de ressources gratuit pour Java et Bedrock, avec des téléchargements prêts à mettre dans le jeu.',
    start: 'Commencer à créer',
    install: 'Comment installer',
    everything: 'Découvre tout ce que tu peux créer',
    editionsLabel: 'Éditions prises en charge',
    chips: [`Java ${LATEST}`, 'Versions 1.6.1+', 'Bedrock'],
    blockLabel: 'Un bloc d’herbe en pixel art',
    dragHint: 'Fais glisser pour tourner',
  },
  toolsSection: {
    eyebrow: 'Trois outils, un seul site',
    title: 'Qu’est-ce que tu veux créer ?',
    lead: 'Tout ce qu’il te faut pour donner ton propre style à Minecraft. Rien à installer, pas de compte : ouvre un outil et lance-toi.',
  },
  converter: {
    title: 'Convertisseur de packs de textures',
    text: `Transforme un pack Java en pack Bedrock ou l’inverse, mets à jour un vieux pack en ${LATEST} ou transforme des PNG en .mcpack.`,
    cta: 'Convertir un pack',
  },
  features: {
    eyebrow: 'Créateur de packs gratuit',
    title: 'Tout ce qu’il faut pour créer un pack de textures',
    lead: 'D’une seule épée repeinte à un pack de ressources HD complet, créé et exporté sans quitter ton navigateur.',
    titles: [
      'Éditeur de packs de textures avec modèles 3D',
      'Générateur de packs de textures en un clic',
      'Ouvre et modifie des packs existants',
      'Packs de ressources pour Java et Bedrock',
      'Éditeur de skins et créateur de packs de skins',
      'Créateur de shaders, avec ou sans mods',
    ],
    items: [
      ['Peins chaque bloc, objet et créature de ta version directement sur son vrai modèle 3D : fourneaux, coffres, escaliers et plus de 80 créatures, des creepers aux villageois.'],
      ['Change le style de tout le jeu d’un coup avec des effets comme Dark Mode, Pastel, Retro 8-bit, Autumn ou Smooth HD, puis fignole à la main.'],
      ['Charge n’importe quel ', code('.zip'), ' Java ou ', code('.mcpack'), ' Bedrock et continue à le modifier, ou passe-le dans l’autre édition avec le ', link('/texture-pack-converter', 'convertisseur de packs'), '.'],
      ['Un générateur de packs de ressources qui écrit le ', code('pack.mcmeta'), ` exact pour Java ${LATEST} jusqu’à 1.6.1, ou un `, code('manifest.json'), ' Bedrock.'],
      ['Dessine des skins en 2D ou en 3D avec des bras classiques ou fins et réunis-les avec le ', link('/skin-pack-maker', 'créateur de packs de skins'), ' dans un seul .mcpack Bedrock.'],
      ['Crée des packs de shaders pour Iris et OptiFine, des shaders vanilla de Java qui n’ont besoin d’aucun mod ou des packs Graphismes éclatants pour Bedrock.'],
    ],
  },
  why: {
    eyebrow: 'Ce qui le rend différent',
    title: 'Pourquoi Texture Pack Maker ?',
    lead: ['Gratuit, open source et respectueux de ta vie privée, avec toutes les versions de Java depuis la 1.6.1, Bedrock et dix outils au même endroit. ', link('/about', 'À propos du projet'), '.'],
  },
  how: {
    eyebrow: 'Comment ça marche',
    title: 'De l’idée au jeu en quelques minutes',
    steps: [
      { title: 'Choisis ton jeu', text: `Java ${LATEST} est prête par défaut, ou choisis n’importe quelle version de Java jusqu’à la 1.6.1, ou Bedrock.` },
      { title: 'Crée', text: 'Peins des pixels, combine des effets en un clic ou bouge les curseurs des shaders, avec des aperçus 3D en direct.' },
      { title: 'Exporte et joue', text: 'Télécharge un .zip ou un .mcpack prêt à l’emploi et suis le guide d’installation pour l’utiliser dans le jeu.' },
    ],
    values: [
      { title: 'Privé dès la conception', text: 'Ton travail ne quitte jamais ton appareil. Les fichiers du jeu sont téléchargés chez Mojang par ton propre navigateur.' },
      { title: 'Marche hors ligne', text: 'Après la première visite, l’appli et les fichiers du jeu téléchargés sont gardés sur cet appareil.' },
      { title: 'Toujours le bon format', text: 'Les fichiers du pack sont écrits pour la version exacte que tu choisis, pour que Minecraft les charge sans broncher.' },
    ],
  },
  guides: { eyebrow: 'Guides', title: 'Apprends les bases', lead: 'Des guides courts et testés pour créer et installer packs, skins et shaders.', all: 'Tous les guides' },
  faqHead: { eyebrow: 'Questions', title: 'Bon à savoir' },
  cta: { title: 'Prêt à créer quelque chose ?', text: 'Choisis un outil et ton premier pack peut être dans le jeu en quelques minutes.', button: 'Commencer à créer' },
  startDialog: 'Qu’est-ce que tu veux créer ?',
};
