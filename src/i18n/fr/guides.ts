// French guides (see GuideText in src/tools/guides/content.ts). Facts come from the app data
// (src/app/content/facts.ts), menu names and messages from the French game files (./game-ui.ts,
// Java fr_fr.json and Bedrock fr_FR.lang). Buttons of the editors are quoted in English, as the
// editors show them.

import { el, type Child, type ElNode } from '../../app/markup';
import { anchor, callout, code, ext, figure, folderTable, gameMessage, link, steps, strong, tabbed, toolCallout, uiPath } from '../../app/content/blocks';
import { F, LATEST, MIN_ENGINE, NEXT_SNAPSHOT, formatGroups, formatParts, maxFormat, mcmetaFor, mcmetaLegacy, mcmetaRange, minFormat } from '../../app/content/facts';
import type { GuideText, GuidesIndexText } from '../../tools/guides/content';
import { SITE_NAME } from '../../app/site';
import { SHOTS } from './shots';
import { UI_FR } from './ui';
import { BEDROCK, IRIS, JAVA, LAUNCHER, OPTIFINE } from './game-ui';
import { SKIN_PACK_LANG, SKIN_PACK_MANIFEST, SKIN_PACK_SKINS_JSON, SKIN_PACK_TREE } from '../../tools/guides/skin-pack-files';
import { MODEL_BLOCK_EXAMPLE, MODEL_FILES, MODEL_FLAT_DEFINITION, MODEL_SPRITE_CUBE, MODEL_STONE_BLOCKSTATE } from '../../tools/guides/model-files';
import { PVP_EXAMPLE_FILES, PVP_SWORD_189, PVP_SWORD_LATEST } from '../../tools/guides/pvp-files';
import { PBR_MANIFEST, PBR_TEXTURE_SET, PBR_UNIFORM_SET } from '../../tools/guides/pbr-files';
import { NAMES_CIT, NAMES_DEFINITION, NAMES_MODEL } from '../../tools/guides/names-files';
import { ANIM_FLIPBOOK, ANIM_MCMETA, ANIM_MCMETA_WIDE } from '../../tools/guides/anim-files';

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
/** English text quoted on purpose (a game message's English original) */
const en = (text: string): ElNode => el('span', { lang: 'en' }, text);
/** A label of the editors, which show English for now */
const enLabel = (text: string): ElNode => el('strong', { lang: 'en' }, text);
const FOLDER = UI_FR.folderTable;

export const GUIDES_INDEX: GuidesIndexText = {
  eyebrow: 'Guides',
  title: 'Guides Minecraft : packs de textures, skins et shaders',
  lead: 'Des réponses claires et vérifiées pour les créateurs Minecraft : comment créer et installer des packs de textures, des skins et des shaders sur Java et Bedrock, et quel pack format il faut pour chaque version de Java.',
  more: ['Tu cherches des instructions d’installation pas à pas pour chaque plateforme ? Consulte le ', link('/help', 'guide d’installation et la FAQ'), '.'],
};

// ---------------------------------------------------------------- shared steps

const MAKE_PACK_STEPS: Child[] = [
  ['Ouvre le ', link('/textures', 'Texture Pack Maker'), ', donne un nom à ton pack et choisis Java ou Bedrock, la version du jeu à laquelle tu joues et une résolution, puis clique sur ', strong('Create pack'), '.'],
  'Trouve une texture avec la recherche ou les catégories et repeins-la dans l’éditeur de pixels, ou importe ton propre PNG.',
  'En option : change le style de tout le pack avec des effets en un clic comme Dark Mode, Pastel ou Retro 8-bit.',
  ['Ouvre l’onglet ', strong('Pack'), ' pour régler la description et l’icône, puis exporte un ', code('.zip'), ' (Java) ou un ', code('.mcpack'), ' (Bedrock).'],
  ['Installe le pack dans Minecraft et teste-le. ', link('/guides/install-resource-packs', 'Comment l’installer'), '.'],
];

const INSTALL_JAVA_STEPS: Child[] = [
  ['Lance Minecraft Java Edition et ouvre ', uiPath(JAVA.options, JAVA.packs), '.'],
  ['Clique sur ', uiPath(JAVA.openFolder), '. Le dossier ', code('resourcepacks'), ' s’ouvre.'],
  ['Dépose le ', code('.zip'), ' du pack dans le dossier (sans le décompresser). Tu peux aussi le faire glisser sur l’écran des packs de ressources.'],
  ['Passe le pack de ', strong(JAVA.available), ' à ', strong(JAVA.selected), ' avec la flèche, et mets-le tout en haut si tu utilises plusieurs packs. Clique sur ', strong(JAVA.done), '.'],
];

const SKIN_STEPS: Child[] = [
  ['Ouvre le ', link('/skins', 'Skin Maker'), ' et choisis un point de départ : un skin vide, un modèle en couleurs, un personnage de départ, un PNG que tu as déjà, le skin d’un joueur Java grâce à son pseudo, ou l’un des skins par défaut.'],
  'Choisis le style de bras : classique (4 pixels de large) ou fin (3 pixels de large).',
  'Peins sur le modèle 64×64 ou passe en 3D et peins directement sur le modèle, en masquant des parties du corps pour atteindre les côtés en dessous. Utilise le miroir pour peindre les deux bras ou les deux jambes à la fois, et verrouille les parties que tu as finies.',
  'Ajoute du relief avec la couche extérieure : chapeaux, cheveux, vestes, manches et jambes de pantalon dépassent un peu du corps.',
  ['Exporte un ', code('.png'), ' pour Java (ajoute une copie à l’ancien format 64×32 pour la 1.7.10 et avant) ou un pack de skins ', code('.mcpack'), ' pour Bedrock.'],
  `Mets-le en jeu : dans le Minecraft Launcher (Java) ou en ouvrant le .mcpack et en le choisissant dans le ${BEDROCK.dressingRoom} (Bedrock).`,
];

const SKIN_PACK_STEPS: Child[] = [
  ['Ouvre le ', link('/skin-pack-maker', 'Skin Pack Maker'), ' et commence un skin : un modèle vide ou en couleurs, un PNG que tu as déjà, le skin d’un joueur Java grâce à son pseudo, ou l’un des skins par défaut. Choisis des bras classiques (4 pixels) ou fins (3 pixels).'],
  'Peins-le sur le modèle 64×64 ou directement sur le modèle 3D. Chaque skin est enregistré sur ton appareil comme un projet à part, et son nom est celui que les joueurs voient dans le jeu.',
  'Fais de la même façon les autres skins du pack.',
  ['Ouvre l’un d’eux, choisis ', strong('Export'), ' › ', strong('Bedrock skin pack (.mcpack)'), ', donne un nom au pack, coche les autres skins à inclure et appuie sur ', strong('Download pack'), '.'],
  ['Ouvre le ', code('.mcpack'), ' sur Windows, Android, iPhone ou iPad. Minecraft l’importe.'],
  ['Dans Minecraft, va dans ', uiPath(BEDROCK.dressingRoom, BEDROCK.classicSkins), ', trouve ton pack, choisis un skin et appuie sur ', strong(BEDROCK.equip), '.'],
];

const VANILLA_SHADER_STEPS: Child[] = [
  ['Ouvre le ', link('/shaders', 'Shader Maker'), ' et choisis ', strong('Vanilla Java'), '.'],
  `Choisis la version exacte de Minecraft à laquelle tu joues (Java 1.17 ou plus récent ; ${LATEST} est la version par défaut).`,
  'Pars d’un préréglage et règle la luminosité, le contraste, les couleurs, la vignette et le brouillard pendant que l’aperçu se met à jour.',
  ['Exporte le ', code('.zip'), ' et installe-le comme n’importe quel pack de ressources : ', uiPath(JAVA.options, JAVA.packs, JAVA.openFolder), '.'],
];

const CONVERT_STEPS: Child[] = [
  ['Ouvre le ', link('/texture-pack-converter', 'convertisseur de packs de textures'), ' et choisis ton pack : un ', code('.zip'), ' Java, un ', code('.mcpack'), ' Bedrock ou des textures PNG.'],
  ['Choisis en quoi le convertir : ', strong('Bedrock Edition'), ', ou ', strong('Java Edition'), ' et une version.'],
  ['Clique sur ', strong('Convert'), '. Ton navigateur charge la liste des textures de l’édition cible et convertit chaque texture qu’il peut.'],
  'Lis le rapport : combien de textures ont été converties, lesquelles ont été ignorées et pourquoi.',
  ['Télécharge le pack converti, ou ouvre-le d’abord dans l’éditeur pour repeindre les textures ignorées.'],
];

const MERGE_STEPS: Child[] = [
  ['Ouvre ', link('/merge-texture-packs', 'Merge Texture Packs'), ' et ajoute de deux à huit packs ', code('.zip'), ' Java ou ', code('.mcpack'), ' Bedrock.'],
  'Range-les en les faisant glisser, ou avec les flèches. Le pack du haut gagne partout où deux packs changent le même fichier.',
  'Donne un nom au pack fusionné et choisis son icône. Pour Java, choisis la version à laquelle tu joues.',
  ['Clique sur ', strong('Merge'), ' et vérifie la liste des conflits.'],
  'Télécharge le pack fusionné, ou ouvre-le dans l’éditeur pour continuer à travailler dessus.',
];

const VV_STEPS: Child[] = [
  ['Fais un pack avec le ', link('/shaders', 'Shader Maker'), ' (choisis ', strong('Bedrock Vibrant Visuals'), ') et exporte le ', code('.mcpack'), '.'],
  'Ouvre le fichier. Minecraft l’importe automatiquement.',
  ['Va dans ', uiPath(BEDROCK.settings, BEDROCK.globalResources, BEDROCK.myPacks), ' et active le pack. Désactive les packs de textures classiques qui ne prennent pas en charge les Graphismes éclatants.'],
  ['Ouvre ', uiPath(BEDROCK.settings, BEDROCK.video), ' et règle ', strong(BEDROCK.graphicsMode), ' sur ', strong(BEDROCK.vibrantVisuals), '.'],
];

const MODEL_STEPS: Child[] = [
  ['Ouvre le ', link('/textures', 'Texture Pack Maker'), ' et crée un pack ', strong('Java'), ' pour la version à laquelle tu joues : 1.8 ou plus récent, ou 1.21.4 ou plus récent pour garder l’objet plat dans l’inventaire.'],
  ['Passe la liste sur ', strong('Items'), ' et ouvre l’objet, par exemple l’épée en diamant. Dans l’onglet ', strong('Preview'), ', appuie sur ', strong('Edit shape'), '.'],
  ['Choisis ', strong('3D item from sprite'), '. Chaque pixel de l’image plate devient une partie d’un cube d’un pixel d’épaisseur.'],
  ['Change la forme : clique sur un cube dans la vue 3D ou dans la liste, puis déplace-le, redimensionne-le, copie-le ou ajoutes-en de nouveaux. Dans ', strong('Faces'), ', donne à une face une autre texture ou une autre partie de texture.'],
  ['Ouvre ', strong('Display'), ' et vérifie le modèle dans l’inventaire, à la première et à la troisième personne, au sol, dans un cadre et sur la tête. Change la rotation, la position ou la taille là où ça ne va pas.'],
  ['En option, en 1.21.4 et plus récent : dans l’onglet ', strong('Model'), ', active ', strong('Flat in the inventory'), ' pour y garder l’icône plate et montrer le modèle 3D en main.'],
  ['Appuie sur ', strong('Done'), ', exporte le pack en ', code('.zip'), ', mets-le dans ton dossier ', code('resourcepacks'), ' et teste-le dans le jeu.'],
];

const PVP_STEPS: Child[] = [
  ['Ouvre le ', link('/textures', 'Texture Pack Maker'), ', donne un nom à ton pack et choisis ', strong('PvP / FPS pack'), '. Active ', strong('Also an FPS pack'), ' pour avoir des textures 8× et pas d’animations.'],
  ['Choisis Java ou Bedrock et la version à laquelle tu joues, par exemple Java 1.8.9 pour les serveurs PvP 1.8, puis appuie sur ', strong('Create PvP pack'), '.'],
  ['L’éditeur charge les textures de cette version et active le préréglage PvP : feu bas, verre transparent, sans le flou de la citrouille, un viseur plus net, des épées plus petites et un bouclier plus bas, quand la version les a.'],
  ['Dans l’onglet ', strong('PvP'), ', change ce que tu veux : la hauteur du feu, le dessin du viseur, la taille des épées, la hauteur du bouclier. Chaque changement peut être annulé depuis son message.'],
  'En option : peins autre chose, comme des couleurs de laine plus claires ou une texture d’épée plus courte.',
  ['Appuie sur ', strong('Export'), ', mets le pack dans Minecraft et place-le au-dessus de tes autres packs.'],
];

const PBR_STEPS: Child[] = [
  ['Ouvre le ', link('/textures', 'Texture Pack Maker'), ' et fais un pack pour Java ou Bedrock, ou ouvre un pack que tu as déjà.'],
  'Choisis une texture de bloc ou d’objet, par exemple le minerai de diamant, et ouvre l’onglet Material à côté de Preview.',
  ['Choisis un matériau rapide comme ', strong('Metal'), ', ', strong('Glass'), ' ou ', strong('Glowing spots'), '. Le bloc 3D éclairé le montre sous un soleil qui bouge.'],
  ['Affine ', strong('Shine'), ', ', strong('Metal'), ', ', strong('Glow'), ' et ', strong('Light through'), ' pour toute la texture, ou ajoute une partie (pixels colorés, clairs ou sombres, certaines couleurs ou une zone que tu sélectionnes) avec ses propres valeurs.'],
  ['Active ', strong('Bumps from the colours'), ' et règle la force, puis utilise ', strong('Use on similar textures'), ' pour donner le même matériau à chaque minerai, planche ou bûche.'],
  ['Appuie sur ', strong('Export'), '. Java reçoit ', code('_n.png'), ' et ', code('_s.png'), ' à côté de chaque texture, Bedrock reçoit des jeux de textures et la capacité ', code('pbr'), '.'],
];

const NAMES_STEPS: Child[] = [
  ['Ouvre le ', link('/textures', 'Texture Pack Maker'), ' et fais un pack Java, ou ouvre un pack que tu as déjà.'],
  ['Ouvre la texture d’un objet, par exemple l’épée en diamant, et choisis ', strong('Name-based textures'), ' dans son menu (⋮), ou ', strong('Names'), ' sous l’aperçu 3D.'],
  ['Tape le nom, par exemple ', strong('Excalibur'), '. Ajoute d’autres noms s’ils doivent partager la texture.'],
  ['Appuie sur ', strong('Create and paint'), '. La nouvelle texture commence comme une copie de celle de l’objet : peins par-dessus. ', strong('3D shape'), ' lui donne aussi son propre modèle.'],
  ['Appuie sur ', strong('Export'), ', installe le pack, renomme l’objet sur une enclume avec exactement ce nom, et prends-le en main.'],
];

const ANIM_STEPS: Child[] = [
  ['Ouvre le ', link('/textures', 'Texture Pack Maker'), ' et fais un pack, ou ouvre un pack que tu as déjà.'],
  ['Ouvre la texture d’un bloc ou d’un objet et choisis ', strong('Make animated'), ' dans son menu (⋮). Elle reçoit deux images, et une bande d’images apparaît sous la zone de dessin.'],
  ['Peins chaque image. ', strong('+'), ' ajoute une copie de l’image sélectionnée ; le menu ⋯ duplique, copie, colle, déplace et supprime des images. Active la pelure d’oignon pour voir l’image précédente en transparence pendant que tu peins.'],
  ['Appuie sur l’horloge pour ', strong('Timing'), ' : combien de ticks chaque image s’affiche (20 ticks font 1 seconde), des durées pour des images précises et ', strong('Blend frames'), '. Appuie sur lecture pour la regarder à la vitesse du jeu.'],
  ['Appuie sur ', strong('Export'), '. Les packs Java reçoivent la bande avec son ', code('.png.mcmeta'), ', les packs Bedrock une entrée dans ', code('flipbook_textures.json'), '.'],
];

// ---------------------------------------------------------------- guides

const makeATexturePack: GuideText = {
  image: SHOTS.editor,
  intro: [
    p(
      'Un pack de textures Minecraft remplace les images du jeu (blocs, objets, créatures, le ciel et les menus) par les tiennes. Java Edition appelle les packs de textures des ',
      el('em', null, 'packs de ressources'),
      ' : un ',
      code('.zip'),
      ' avec un fichier ',
      code('pack.mcmeta'),
      ' et des images PNG aux mêmes chemins que les originales. Bedrock utilise des fichiers ',
      code('.mcpack'),
      ' avec un ',
      code('manifest.json'),
      '. Tu peux faire l’un ou l’autre dans ton navigateur en quelques minutes.',
    ),
  ],
  quick: {
    title: 'En bref',
    items: [
      'Choisis Java ou Bedrock et la version à laquelle tu joues.',
      'Repeins des textures, importe tes propres images ou applique un effet en un clic.',
      'Exporte le pack et mets-le dans Minecraft.',
    ],
  },
  howto: { name: 'Comment créer un pack de textures Minecraft avec Texture Pack Maker', steps: MAKE_PACK_STEPS },
  sections: [
    {
      id: 'step-1',
      title: 'Étape 1 — Crée le pack et choisis ta version',
      body: [
        p(MAKE_PACK_STEPS[0]),
        ul([
          [strong('Édition : '), 'Java Edition (PC, Mac et Linux avec le Minecraft Launcher) ou Bedrock Edition (Windows, téléphones, tablettes et consoles). Les deux ont besoin de fichiers différents, donc fais un projet par édition. ', link('/guides/java-vs-bedrock-packs', 'Laquelle j’ai ?')],
          [strong('Version : '), 'Java ', LATEST, ' est choisie par défaut ; toutes les versions jusqu’à la 1.6.1 marchent, donc tu peux faire un pack pour 1.21.11, 26.2 ou 1.8.9 tout aussi facilement. Le pack reçoit le bon ', code('pack.mcmeta'), ' pour cette version.'],
          [strong('Résolution : '), '16× correspond au rendu vanilla (16×16 pixels par face de bloc). 32× et 64× laissent de la place pour plus de détails ; 128× et plus sont pour les packs réalistes.'],
        ]),
        p('Ton navigateur télécharge ensuite les textures d’origine de cette version directement chez Mojang et les garde sur ton appareil, pour que le pack suivant démarre tout de suite.'),
        figure(SHOTS.newPack),
      ],
    },
    {
      id: 'step-2',
      title: 'Étape 2 — Trouve et repeins des textures',
      body: [
        p(MAKE_PACK_STEPS[1]),
        p(
          'Chaque texture s’affiche sur son vrai modèle 3D : un fourneau montre sa façade, ses côtés et son dessus, les escaliers et les dalles montrent leur forme, et les créatures montrent les parties de leur corps. Peins avec le crayon, le remplissage, la ligne, les formes, le bruit et la pipette, fais tes traits en miroir et annule ce que tu veux. L’aperçu en mosaïque montre comment un bloc se répète au sol, pour que les raccords ne se voient pas.',
        ),
        p(
          'Tu préfères voir le bloc pendant que tu peins ? Passe l’éditeur en ',
          strong('3D'),
          ' (ou appuie sur D) et peins directement sur le modèle : chaque face peint la texture qu’elle affiche. Fais glisser le fond ou utilise deux doigts pour tourner le bloc. Les textures des créatures marchent de la même façon : choisis Mobs dans la liste des textures et masque des parties du corps pour atteindre les côtés en dessous.',
        ),
        p(
          'Sur Java, tu peux aussi changer les formes : appuie sur ',
          strong('Edit shape'),
          ' dans l’onglet Preview pour transformer un objet plat en objet 3D ou changer la forme d’un bloc. ',
          link('/guides/make-3d-items-texture-pack', 'Comment faire des objets 3D'),
          '.',
        ),
        p('Tu fais un pack pour le PvP ou pour plus de FPS ? Choisis ', strong('PvP / FPS pack'), ' quand tu le crées, et l’éditeur active pour toi le feu bas, le verre transparent, un viseur plus net et des épées plus petites. ', link('/guides/make-a-pvp-texture-pack', 'Comment faire un pack de textures PvP'), '.'),
        ul([
          'Commence par les blocs que tu vois tout le temps : herbe, terre, roche, bûches et planches.',
          'L’herbe, les feuilles, les lianes et l’eau sont enregistrées en gris et colorées par le jeu selon le biome. Garde-les en gris clair.',
          'Les textures animées, comme l’eau, la lave et les lanternes aquatiques, peuvent être modifiées image par image.',
        ]),
        figure(SHOTS.editor),
        figure(SHOTS.paint3d),
      ],
    },
    {
      id: 'step-3',
      title: 'Étape 3 — Change le style de tout le pack en un clic (en option)',
      body: [
        p(MAKE_PACK_STEPS[2]),
        p('Les effets s’empilent les uns sur les autres et sur ta propre peinture sans la changer, et sont appliqués à chaque texture à l’export. Combine Autumn avec Smooth HD, ou Dark Mode avec un Neon Outline, puis continue à peindre à la main.'),
        figure(SHOTS.effects),
      ],
    },
    {
      id: 'step-4',
      title: 'Étape 4 — Ajoute une icône et une description, puis exporte',
      body: [
        p(MAKE_PACK_STEPS[3]),
        p(
          `Sur Java, tu peux aussi choisir une plage de compatibilité, pour qu’un même pack se charge sur plusieurs versions sans l’avertissement « ${JAVA.madeForOlder} ». L’export écrit chaque fichier dont le jeu a besoin : `,
          code('pack.mcmeta'),
          ' et ',
          code('pack.png'),
          ' sur Java, ou ',
          code('manifest.json'),
          ' avec de nouveaux identifiants uniques et ',
          code('pack_icon.png'),
          ' sur Bedrock.',
        ),
        figure(SHOTS.packSettings),
        figure(SHOTS.export),
      ],
    },
    {
      id: 'step-5',
      title: 'Étape 5 — Installe-le et teste-le',
      body: [
        p(MAKE_PACK_STEPS[4]),
        ul([
          ['Java : ouvre ', uiPath(JAVA.options, JAVA.packs, JAVA.openFolder), ', dépose le ', code('.zip'), ' dedans (sans le décompresser) et passe le pack dans ', strong(JAVA.selected), '. Appuie sur F3 + T dans le jeu pour recharger après des changements.'],
          ['Bedrock : ouvre le ', code('.mcpack'), ', puis active-le dans ', uiPath(BEDROCK.settings, BEDROCK.globalResources), '.'],
        ]),
        p('Quelque chose ne va pas ? ', link('/guides/texture-pack-not-working', 'Pack de textures qui ne marche pas : les solutions'), '.'),
      ],
    },
    {
      id: 'inside',
      title: 'Qu’y a-t-il dans un pack de textures ?',
      body: [
        h3('Java Edition (.zip)'),
        ul([
          [code('pack.mcmeta'), ' à la racine du zip (obligatoire) : la description du pack et les versions du jeu pour lesquelles il est fait.'],
          [code('pack.png'), ' (en option) : l’icône dans la liste des packs. Celle de Minecraft fait 128×128 et s’affiche en 32×32.'],
          [code('assets/minecraft/textures/…'), ' : tes images, avec les mêmes dossiers et noms de fichiers que les originales, par exemple ', code('assets/minecraft/textures/block/stone.png'), '. Les versions avant la 1.13 utilisent les dossiers ', code('blocks'), ' et ', code('items'), ' au lieu de ', code('block'), ' et ', code('item'), '.'],
          ['Les textures animées ont un fichier ', code('.png.mcmeta'), ' correspondant à côté de l’image.'],
        ]),
        h3('Bedrock Edition (.mcpack)'),
        ul([
          [code('manifest.json'), ' à la racine (obligatoire) : le nom, deux identifiants uniques, un numéro de version qui augmente à chaque mise à jour, et la plus ancienne version du jeu que le pack prend en charge (', code(`"min_engine_version": ${MIN_ENGINE}`), ' par défaut ici).'],
          [code('pack_icon.png'), ' (en option) : l’icône du pack.'],
          ['Les textures dans ', code('textures/'), ', par exemple ', code('textures/blocks/stone.png'), '. Certaines textures vanilla sont des fichiers ', code('.tga'), ' ; garde le même nom et la même extension que l’original.'],
        ]),
        callout('tip', 'Les noms de fichiers comptent', 'Minecraft ne remplace une texture que si ton fichier a exactement le même chemin que l’original. Sur Java, les chemins doivent être en minuscules (a-z, 0-9, _ - . et /). Le Texture Pack Maker s’en occupe pour toi.'),
        h3('Les dossiers côte à côte'),
        pre(
          [
            'Java : MonPack.zip',
            '├── pack.mcmeta',
            '├── pack.png',
            '└── assets/minecraft/textures/',
            '    ├── block/stone.png',
            '    └── item/diamond_sword.png',
            '',
            'Bedrock : MonPack.mcpack',
            '├── manifest.json',
            '├── pack_icon.png',
            '└── textures/',
            '    ├── blocks/stone.png',
            '    └── items/diamond_sword.png',
          ].join('\n'),
        ),
        table(
          ['', 'pack.mcmeta (Java)', 'manifest.json (Bedrock)'],
          [
            ['Obligatoire', 'Oui, à la racine du zip', 'Oui, à la racine du .mcpack'],
            ['Le pack est reconnu par', 'Son nom de fichier ou de dossier', 'Deux identifiants uniques (UUID)'],
            ['Version du jeu', `Numéros de pack format (${LATEST} utilise ${F(LATEST)})`, [code('min_engine_version'), ', la plus ancienne version du jeu prise en charge']],
            ['Mises à jour', 'Remplace le fichier', 'Augmente le numéro de version, garde les identifiants'],
          ],
        ),
      ],
    },
    {
      id: 'mcmeta',
      title: 'Le fichier pack.mcmeta (Java)',
      body: [
        p(
          'Ce fichier dit à Minecraft pour quelles versions le pack est fait. Le numéro de format change presque à chaque mise à jour : Java ',
          LATEST,
          ' utilise le format de pack de ressources ',
          strong(F(LATEST)),
          '. Un pack fait seulement pour la ',
          LATEST,
          ' ressemble à ça :',
        ),
        pre(mcmetaFor(LATEST, `Mon pack pour Minecraft ${LATEST}`)),
        p(
          'Depuis la 1.21.9, les packs indiquent une plage avec ',
          code('min_format'),
          ' et ',
          code('max_format'),
          '. Un pack qui doit aussi se charger sur des versions plus anciennes a besoin en plus de ',
          code('pack_format'),
          ' et de ',
          code('supported_formats'),
          '. Le Texture Pack Maker écrit la bonne combinaison pour la version et la plage que tu choisis. Découvre ',
          link('/guides/minecraft-pack-format-versions', 'le pack format de chaque version'),
          '.',
        ),
        callout('warn', 'Pas de description ?', `Sur Java ${LATEST}, un pack dont le pack.mcmeta n’a pas de description, ou n’est pas du JSON valide, n’apparaît pas du tout dans la liste. Garde pack.mcmeta à la racine du zip, pas dans un dossier.`),
      ],
    },
    {
      id: 'by-hand',
      title: 'Faire un pack de textures à la main',
      body: [
        p('Tu peux aussi construire un pack toi-même avec n’importe quel logiciel de dessin. Ça prend plus de temps, mais ça montre comment un pack fonctionne :'),
        h3('Java Edition'),
        steps([
          ['Trouve les textures d’origine : copie ', code('versions/<version>/<version>.jar'), ' depuis ton dossier ', code('.minecraft'), ', renomme la copie en ', code('.zip'), ' et ouvre-la. Les images sont dans ', code('assets/minecraft/textures'), '.'],
          ['Crée un nouveau dossier pour ton pack avec un ', code('pack.mcmeta'), ' (voir plus bas) et les mêmes dossiers ', code('assets/minecraft/textures/…'), ' que les originaux.'],
          'Copies-y seulement les PNG que tu veux changer et modifie-les, en gardant leurs noms et des tailles proportionnelles (16×16, 32×32, etc.).',
          ['Compresse le ', strong('contenu'), ' du dossier, pas le dossier lui-même, pour que ', code('pack.mcmeta'), ' soit à la racine du zip. Dépose le zip dans ', code('resourcepacks'), '.'],
        ]),
        h3('Bedrock Edition'),
        steps([
          ['Récupère les textures d’origine dans le dépôt ', ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'), ' de Mojang (', code('resource_pack/textures'), ').'],
          ['Crée un dossier avec un ', code('manifest.json'), ' contenant deux nouveaux identifiants uniques (UUID) et tes images modifiées dans ', code('textures/'), '.'],
          ['Compresse le contenu du dossier et renomme le fichier de ', code('.zip'), ' en ', code('.mcpack'), ', puis ouvre-le pour l’importer.'],
        ]),
        callout('tip', 'Évite le travail pénible', 'Le Texture Pack Maker s’occupe de la copie, des noms de dossiers, de pack.mcmeta, des UUID et de la compression pour toi, et montre chaque texture sur son modèle 3D pendant que tu peins.'),
      ],
    },
    {
      id: 'tips',
      title: 'Conseils pour un bon pack',
      body: [
        ul([
          'Commence petit : repeins quelques blocs que tu vois tout le temps (herbe, terre, roche, bois) et teste dans le jeu avant de tout faire.',
          'Garde la même résolution dans tout le pack. Mélanger des textures 16× et 64× donne un rendu inégal.',
          'Utilise l’aperçu 3D du bloc pour vérifier que les côtés d’un bloc se raccordent bien.',
          'Utilise l’aperçu en mosaïque pour les blocs qui se répètent, pour que les raccords ne se voient pas.',
          `Mets ton pack en haut de la liste « ${JAVA.selected} ». Les packs les plus hauts dans la liste gagnent.`,
        ]),
      ],
    },
  ],
  faq: [
    {
      id: 'both',
      q: 'Un même pack de textures marche sur Java et Bedrock ?',
      a: [p('Non. Les deux éditions utilisent des fichiers et des dossiers différents. Fais le pack pour une édition, puis transforme-le pour l’autre avec le ', link('/texture-pack-converter', 'convertisseur de packs de textures'), '. ', link('/guides/java-vs-bedrock-packs', 'Packs Java ou Bedrock'), '.')],
    },
    {
      id: 'free',
      q: 'Je dois installer un logiciel ?',
      a: [p(`Non. ${SITE_NAME} marche dans ton navigateur sur ordinateur, téléphone ou tablette, et rien n’est envoyé.`)],
    },
    {
      id: 'edit',
      q: 'Je peux modifier un pack de textures existant ?',
      a: [p('Oui. Dans le Texture Pack Maker, choisis ', strong('Open a pack'), ' et sélectionne un ', code('.zip'), ' ou un ', code('.mcpack'), '. Tu peux continuer à le modifier et l’exporter à nouveau.'), figure(SHOTS.openPack)],
    },
    {
      id: 'code',
      q: 'Faut-il savoir coder pour faire un pack de textures ?',
      a: [p('Non. Un pack de textures, ce sont des images plus un petit fichier de description, et le Texture Pack Maker écrit ce fichier pour toi. Tu as juste à peindre.')],
    },
    {
      id: 'older',
      q: 'Comment faire un pack de textures pour une version plus ancienne, comme 1.21.11 ou 1.8.9 ?',
      a: [p('Choisis cette version quand tu crées le pack. L’outil charge les textures et les noms de dossiers de cette version et écrit son pack format. ', link('/guides/minecraft-pack-format-versions', 'Les pack formats de chaque version'), '.')],
    },
    {
      id: 'originals',
      q: 'Où trouver les textures d’origine de Minecraft ?',
      a: [p('Dans le fichier ', code('.jar'), ' du jeu pour Java (', code('assets/minecraft/textures'), ') et dans le dépôt bedrock-samples de Mojang pour Bedrock. Le Texture Pack Maker les charge pour toi chez Mojang quand tu choisis une version.')],
    },
    {
      id: 'mobile',
      q: 'Je peux faire un pack de textures sur mon téléphone ?',
      a: [p('Oui. Le Texture Pack Maker marche dans le navigateur sur Android, iPhone et iPad comme sur ordinateur et Chromebook. Sur Bedrock, ouvre le ', code('.mcpack'), ' exporté et Minecraft l’importe.')],
    },
    {
      id: 'time',
      q: 'Combien de temps faut-il pour faire un pack de textures ?',
      a: [p('Quelques minutes pour un petit pack qui change une poignée de blocs, ou pour un effet sur tout le pack comme Dark Mode. Un pack complet peint à la main avec des centaines de textures peut prendre des semaines ; tu peux l’exporter et le tester à tout moment en cours de route.')],
    },
    {
      id: 'hd',
      q: 'Quelle résolution choisir pour mon pack de textures ?',
      a: [p('16× correspond au jeu vanilla et c’est le plus rapide à peindre. 32× et 64× laissent de la place pour plus de détails ; 128× et plus sont pour les packs réalistes et demandent un ordinateur plus puissant. Garde une seule résolution dans tout le pack.')],
    },
  ],
  ctaLabel: 'Ouvrir le Texture Pack Maker',
};

const notWorking: GuideText = {
  image: SHOTS.packSettings,
  intro: [
    p(
      'La plupart des problèmes de packs de textures viennent de trois choses : le fichier de description du pack (',
      code('pack.mcmeta'),
      ' sur Java, ',
      code('manifest.json'),
      ' sur Bedrock) manque ou n’est pas au bon endroit, le pack a été fait pour une autre version du jeu, ou une texture n’est pas exactement au chemin où Minecraft la cherche. Trouve ci-dessous ce que tu vois et applique la solution, ou cherche le ',
      anchor('error-messages', 'message d’erreur exact'),
      '.',
    ),
    toolCallout(
      'Laisse Pack Doctor trouver le problème',
      ['Dépose le pack dans ', link('/pack-doctor', 'Pack Doctor'), ' : il vérifie chaque fichier pour la version à laquelle tu joues, explique chaque problème qu’il trouve et corrige les plus sûrs en un clic, puis te donne le pack réparé.'],
      { to: '/pack-doctor', label: 'Vérifier mon pack', icon: 'potion' },
    ),
  ],
  quick: {
    title: 'Vérifie d’abord ça',
    items: [
      ['Java : le zip s’ouvre directement sur ', code('pack.mcmeta'), ' et ', code('assets'), ', pas sur un dossier.'],
      'Le pack a été fait pour la version à laquelle tu joues (ou sa plage de compatibilité l’inclut).',
      `Le pack est dans la liste « ${JAVA.selected} » (Java) ou parmi les packs actifs (Bedrock), au-dessus des packs qui changent les mêmes textures.`,
      'Les noms de fichiers et les dossiers correspondent exactement aux originaux, en minuscules sur Java.',
    ],
  },
  sections: [
    {
      id: 'not-listed',
      title: 'Le pack n’est pas dans la liste',
      body: [
        p('Java n’affiche un pack que s’il trouve un ', code('pack.mcmeta'), ' valide à la racine du zip ou du dossier.'),
        ul([
          [strong('Dossier en trop : '), 'compresser le dossier du pack lui-même met tout un niveau trop bas (', code('MonPack.zip/MonPack/pack.mcmeta'), '). Compresse plutôt le contenu du dossier.'],
          [strong('pack.mcmeta cassé : '), `une virgule ou un guillemet en moins le rend invalide en JSON. Sur Java ${LATEST}, un pack sans description n’apparaît pas non plus.`],
          [strong('Mauvais dossier : '), 'le zip doit être dans ', code('resourcepacks'), ', pas dans ', code('shaderpacks'), ' ni dans ', code('mods'), '. Utilise ', uiPath(JAVA.options, JAVA.packs, JAVA.openFolder), ' pour ouvrir le bon.'],
          [strong('Encore en téléchargement ou bloqué : '), 'les navigateurs enregistrent parfois un fichier à moitié téléchargé en ', code('.crdownload'), ' ou ', code('.part'), '. Télécharge le pack à nouveau.'],
        ]),
      ],
    },
    {
      id: 'version',
      title: `« ${JAVA.madeForOlder} » ou « ${JAVA.madeForNewer} »`,
      body: [
        p(
          'Java compare le pack format de ',
          code('pack.mcmeta'),
          ' avec le sien (',
          LATEST,
          ' utilise ',
          strong(F(LATEST)),
          '). Un pack qui ne change que des textures marche en général quand même si tu cliques sur ',
          strong(JAVA.yes),
          ', mais des textures manquantes ou renommées peuvent mal s’afficher. La vraie solution, c’est d’exporter à nouveau le pack pour ta version, ou de lui donner une plage de compatibilité qui l’inclut. Pour un vieux pack que tu n’as pas fait, le ',
          link('/texture-pack-converter', 'convertisseur de packs de textures'),
          ' renomme ses textures pour ta version et écrit un nouveau pack.mcmeta.',
        ),
        p(
          'Depuis la 1.21.9, un pack qui n’a qu’un numéro ',
          code('pack_format'),
          ', ou des champs qui ne respectent pas les nouvelles règles, peut s’afficher comme ',
          el('em', null, JAVA.incompatible.toLowerCase()),
          '. Les packs récents utilisent ',
          code('min_format'),
          ' et ',
          code('max_format'),
          '. ',
          link('/guides/minecraft-pack-format-versions', 'Le pack format de chaque version'),
          '.',
        ),
        figure(SHOTS.packSettings),
      ],
    },
    {
      id: 'purple',
      title: 'Des blocs violets et noirs',
      body: [
        p(
          'Le damier violet et noir, c’est la « texture manquante ». Un modèle demande une image qui n’existe pas à ce chemin : le fichier a été renommé, mis dans le mauvais dossier, ou le pack utilise les noms de dossiers d’une autre version. Par exemple, les versions avant la 1.13 utilisent ',
          code('textures/blocks'),
          ' et ',
          code('textures/items'),
          ', alors que la 1.13 et plus récent utilisent ',
          code('textures/block'),
          ' et ',
          code('textures/item'),
          '.',
        ),
        p('Si tu as ajouté des modèles perso, vérifie chaque chemin de texture à l’intérieur. Les packs faits avec le Texture Pack Maker utilisent les chemins exacts de la version que tu as choisie.'),
      ],
    },
    {
      id: 'some-textures',
      title: 'Seules certaines textures ont changé',
      body: [
        ul([
          [strong('Une lettre de travers dans le nom ou le chemin : '), 'le fichier doit avoir exactement le même nom et le même dossier que l’original. Java ignore les chemins avec des majuscules ou des espaces.'],
          [strong('Un autre pack gagne : '), 'les packs plus hauts dans la liste remplacent les mêmes textures. Place le tien en haut, ou réunis les packs en un seul avec ', link('/merge-texture-packs', 'la fusion de packs de textures'), ', dans l’ordre que tu veux.'],
          [strong('Mauvais fichier pour ce bloc : '), 'certains blocs utilisent plusieurs images (la façade, le côté et le dessus du fourneau ; le dessus, le côté et la couche du côté du bloc d’herbe). Modifie-les toutes, ou utilise l’aperçu 3D pour voir quelle image va où.'],
          [strong('Mauvais type d’image sur Bedrock : '), 'certaines textures vanilla de Bedrock sont des fichiers ', code('.tga'), '. Garde le même nom et le même type de fichier que l’original pour que le tien le remplace.'],
        ]),
      ],
    },
    {
      id: 'grey',
      title: 'L’herbe et les feuilles sont grises',
      body: [
        p(
          'C’est normal dans le fichier image. L’herbe, les feuilles, les lianes, l’eau et quelques autres textures sont enregistrées en gris et colorées par le jeu pour chaque biome : peins-les donc en gris clairs et vérifie-les dans le jeu. Les peindre en vert les rend beaucoup plus sombres ou bizarrement colorées une fois que le jeu les teinte.',
        ),
      ],
    },
    {
      id: 'animation',
      title: 'Une texture animée s’affiche comme une longue bande',
      body: [
        p(
          'Les textures animées sont une grande image d’images empilées les unes sur les autres, plus un fichier ',
          code('.png.mcmeta'),
          ' du même nom (par exemple ',
          code('sea_lantern.png.mcmeta'),
          '). Sans ce fichier, Java écrase toute la bande dans un seul bloc. Bedrock, lui, liste les textures animées dans ',
          code('textures/flipbook_textures.json'),
          '. Le Texture Pack Maker écrit ces fichiers quand tu modifies les images d’une animation.',
        ),
      ],
    },
    {
      id: 'all-off',
      title: 'Tous mes packs de ressources se sont désactivés (Java)',
      body: [
        p(
          'Quand un pack de ressources contient un shader qui ne compile pas, Java désactive tous les packs et revient aux réglages par défaut. Ça arrive avec les packs de shaders vanilla faits pour une autre version, parce que Mojang change souvent ces fichiers de shaders. Enlève le pack ou exporte-le à nouveau pour ta version exacte ; chaque shader que le ',
          link('/shaders', 'Shader Maker'),
          ' écrit est d’abord vérifié à la compilation.',
        ),
      ],
    },
    {
      id: 'bedrock-import',
      title: 'Bedrock : l’importation a échoué',
      body: [
        ul([
          [strong('Échec de l’importation : '), code('manifest.json'), ' manque, n’est pas valide ou n’est pas à la racine du fichier. Exporte le pack à nouveau et ouvre le nouveau fichier.'],
          [strong('Pack en double : '), 'un pack avec les mêmes identifiants et le même numéro de version est déjà installé. Augmente la version (le Texture Pack Maker le fait à chaque export) ou supprime l’ancienne copie dans ', uiPath(BEDROCK.settings, BEDROCK.storage), '.'],
          [strong('Mauvais type de fichier : '), 'un ', code('.zip'), ' Java renommé en ', code('.mcpack'), ' ne marche pas ; Bedrock a besoin de ses propres fichiers et dossiers. Convertis-le plutôt avec le ', link('/texture-pack-converter', 'convertisseur de packs de textures'), '.'],
          [strong('Console : '), 'Xbox, PlayStation et Switch ne peuvent pas importer de fichiers du tout. Rejoins un monde, un Realm ou un serveur qui contient le pack.'],
        ]),
      ],
    },
    {
      id: 'bedrock-nothing',
      title: 'Bedrock : importé, mais rien ne change',
      body: [
        ul([
          ['Active-le : ', uiPath(BEDROCK.settings, BEDROCK.globalResources, BEDROCK.myPacks), ', choisis le pack et appuie sur ', strong(BEDROCK.activate), '. Pour un seul monde, utilise ', uiPath(BEDROCK.editWorld, BEDROCK.packs), '.'],
          'Place-le au-dessus des autres packs actifs qui changent les mêmes textures.',
          ['Si le pack demande un jeu plus récent que le tien, son ', code('min_engine_version'), ' est trop élevé : mets Minecraft à jour ou exporte avec un minimum plus bas.'],
          `Les packs faits pour les graphismes classiques peuvent avoir l’air différents, ou être désactivés, avec les ${BEDROCK.vibrantVisuals} activés. Essaie de changer de ${BEDROCK.graphicsMode.toLowerCase()}.`,
        ]),
      ],
    },
    {
      id: 'shaders',
      title: 'Un pack de shaders n’apparaît pas',
      body: [
        ul([
          ['Les packs de shaders Iris et OptiFine vont dans le dossier ', code('shaderpacks'), ', qu’on ouvre depuis ', uiPath(JAVA.options, JAVA.video, IRIS.shaderPacks), ', pas dans ', code('resourcepacks'), '.'],
          ['Iris a besoin d’OpenGL. Sur Java 26.2 et plus récent, règle ', strong(JAVA.graphicsApi), ' sur ', strong(JAVA.graphicsApiDefault), ' ou ', strong(JAVA.graphicsApiOpenGl), ' si Iris dit qu’il ne peut pas tourner avec Vulkan.'],
          ['Les packs de shaders vanilla (sans mods) sont des packs de ressources et ne marchent que dans la version pour laquelle ils ont été faits. ', link('/guides/make-shaders-without-mods', 'Shaders sans mods'), '.'],
        ]),
      ],
    },
    {
      id: 'error-messages',
      title: 'Les messages d’erreur, mot pour mot',
      body: [
        p(
          'Voici les messages que Minecraft affiche quand un pack de ressources a un problème, copiés des fichiers de langue français du jeu lui-même (Java 26.3, Bedrock 1.26.50). Là où le jeu met un nom ou un nombre, tu vois « … » ici. Cherche dans la page (Ctrl + F) quelques mots de ce que dit ton jeu.',
        ),
        h3('Java Edition'),
        gameMessage(
          ['Incompatible', `(${JAVA.madeForOlder})`],
          'S’affiche en rouge quand tu survoles le pack dans la liste des packs de ressources : son pack format est plus ancien que celui de ton jeu (en anglais, ',
          en('“Made for an older version of Minecraft”'),
          `). Un pack d’une version plus récente indique « (${JAVA.madeForNewer}) », et depuis la 1.21.9, un pack dont le jeu ne sait pas lire les versions indique « (${JAVA.incompatible}) ». `,
          strong('Solution : '),
          'exporte le pack à nouveau pour ta version, ou mets à jour un vieux pack avec le ',
          link('/texture-pack-converter', 'convertisseur de packs de textures'),
          '. Plus de détails dans ',
          anchor('version', `« ${JAVA.madeForOlder} » ou « … plus récente … »`),
          '.',
        ),
        gameMessage(
          ['Voulez-vous vraiment charger ce pack ?', 'Ce pack a été conçu pour une ancienne version de Minecraft et peut ne plus fonctionner correctement.'],
          'Apparaît quand tu passes un pack comme ça dans ',
          strong(JAVA.selected),
          '. Pour un pack plus récent, la deuxième ligne est « Ce pack a été conçu pour une version plus récente de Minecraft et peut ne pas fonctionner correctement. », pour un pack endommagé « Ce pack est endommagé ou a été conçu pour une version inconnue de Minecraft et peut ne pas fonctionner correctement. ». ',
          strong(JAVA.yes),
          ' le charge quand même ; un pack qui ne change que des textures marche souvent. ',
          strong('Solution : '),
          link('/pack-doctor', 'Pack Doctor'),
          ' réécrit ',
          code('pack.mcmeta'),
          ' pour ta version (',
          link('/guides/minecraft-pack-format-versions', 'le pack format de chaque version'),
          ').',
        ),
        gameMessage(
          ['Entrées hors pack', "Les entrées suivantes n'étaient pas des packs valides et n'ont pas été copiées :", '…'],
          'Après avoir fait glisser des fichiers sur l’écran des packs de ressources (1.20.2 et plus récent) : Minecraft n’a trouvé aucun ',
          code('pack.mcmeta'),
          ' à la racine de ces zips ou de ces dossiers. Les packs de shaders et les fichiers ',
          code('.mcpack'),
          ' de Bedrock donnent ça aussi. ',
          strong('Solution : '),
          'regarde ',
          anchor('not-listed', 'Le pack n’est pas dans la liste'),
          ' ; le ',
          link('/texture-pack-converter', 'convertisseur de packs de textures'),
          ' transforme un pack Bedrock en pack Java.',
        ),
        gameMessage(
          ['Échec du rechargement des ressources', 'Erreur détectée dans le pack de ressources'],
          'Un message dans le coin : un pack a planté pendant le chargement ou (avec la deuxième ligne, 1.21.2 et plus récent) pendant que tu jouais, souvent à cause d’un shader dans un pack de shaders vanilla. Minecraft a désactivé tous les packs de ressources et est revenu au rendu par défaut. ',
          strong('Solution : '),
          'regarde ',
          anchor('all-off', 'Tous mes packs de ressources se sont désactivés'),
          '. ',
          code('logs/latest.log'),
          ' indique le fichier qui a échoué, et ',
          link('/pack-doctor', 'Pack Doctor'),
          ' trouve le JSON et les images cassés.',
        ),
        gameMessage(
          ['Échec du téléchargement de … pack(s) sur …'],
          'Quand tu rejoins un serveur qui envoie un pack de ressources (1.20.3 et plus récent) : le téléchargement n’a pas marché. ',
          strong('Solution : '),
          'reconnecte-toi. Si c’est ton serveur, le lien dans ',
          code('server.properties'),
          ' doit télécharger le zip lui-même (pas une page web), le zip doit faire moins de 250 Mo, et ',
          code('resource-pack-sha1'),
          ' doit correspondre au fichier ou rester vide.',
        ),
        h3('Bedrock Edition'),
        p(
          'Les problèmes d’importation s’affichent en haut de l’écran. Les messages sur ',
          code('manifest.json'),
          ' sont écrits dans le journal du contenu : ouvre ',
          uiPath(BEDROCK.settings, 'Créateur'),
          ' et choisis ',
          strong('Historique de journalisation du contenu'),
          '.',
        ),
        gameMessage(
          ["L'importation de … a échoué", 'Pack en doublon détecté'],
          'Un pack avec le même UUID et la même version est déjà installé, en général une ancienne copie du même pack. ',
          strong('Solution : '),
          'augmente la version dans ',
          code('manifest.json'),
          ' (le Texture Pack Maker le fait à chaque export), ou supprime l’ancienne copie dans ',
          uiPath(BEDROCK.settings, BEDROCK.storage),
          ' et importe à nouveau.',
        ),
        gameMessage(
          ["L'importation de … a échoué", "Consultez le journal de sortie pour plus d'infos"],
          'Bedrock n’a pas pu lire le fichier comme un pack. La deuxième ligne peut aussi être « Archive zip non valide » : le fichier n’est pas un zip, ou le téléchargement a été interrompu. ',
          strong('Solution : '),
          'regarde ',
          anchor('bedrock-import', 'Bedrock : l’importation a échoué'),
          ', et vérifie le fichier avec ',
          link('/pack-doctor', 'Pack Doctor'),
          '.',
        ),
        gameMessage(
          ['Impossible de trouver le manifeste dans le pack.'],
          'Il n’y a pas de ',
          code('manifest.json'),
          ' à la racine du pack : il est un dossier trop bas, ou c’est un pack Java (ceux-là ont un ',
          code('pack.mcmeta'),
          ' à la place). ',
          strong('Solution : '),
          'compresse le contenu du dossier du pack, pas le dossier lui-même. Transforme un pack Java en pack Bedrock avec le ',
          link('/texture-pack-converter', 'convertisseur de packs de textures'),
          '.',
        ),
        gameMessage(
          ["L'élément fourni pack.name a une valeur non valide dans le manifeste du pack. Utilisation du pack de ressources par défaut."],
          'C’est le jeu qui remplit le nom après « fourni » ; beaucoup de joueurs y voient ',
          code('pack.name'),
          ' (en anglais, ',
          en("“Provided 'pack.name' element has an invalid value in pack manifest; Defaulting to resource pack.”"),
          '). Bedrock n’a pas reconnu le type de pack dans ',
          code('manifest.json'),
          ' (le ',
          code('"type"'),
          ' sous ',
          code('"modules"'),
          '), donc il charge le pack comme un pack de ressources. ',
          strong('Solution : '),
          'le type de module d’un pack de ressources doit être exactement ',
          code('"resources"'),
          ' (celui d’un pack de comportements ',
          code('"data"'),
          ', celui d’un pack de skins ',
          code('"skin_pack"'),
          '). ',
          link('/pack-doctor', 'Pack Doctor'),
          ' le vérifie.',
        ),
        gameMessage(
          ["Impossible d'analyser la syntaxe du manifeste du pack avec la pile : …"],
          code('manifest.json'),
          ' n’est pas du JSON valide : une virgule ou un guillemet manque, il y a une virgule après le dernier élément, ou un crochet en trop. ',
          strong('Solution : '),
          link('/pack-doctor', 'Pack Doctor'),
          ' montre la ligne avec l’erreur et peut écrire un manifeste qui marche.',
        ),
        gameMessage(
          ["L'élément UUID fourni … est déjà présent dans le manifeste du pack."],
          'Deux UUID entrent en conflit : l’en-tête et un module en partagent un, ou un autre pack installé l’utilise déjà. Chaque pack a besoin de ses propres UUID. ',
          strong('Solution : '),
          link('/pack-doctor', 'Pack Doctor'),
          ' donne de nouveaux UUID au pack ; supprime les anciennes copies dans ',
          uiPath(BEDROCK.settings, BEDROCK.storage),
          '.',
        ),
        gameMessage(
          ['Dépendances manquantes', "Il manque au moins une dépendance pour ce pack. Voulez-vous l'appliquer quand même ?"],
          'Quand tu actives un pack dont le ',
          code('manifest.json'),
          ' liste d’autres packs dans ',
          code('"dependencies"'),
          ' qui ne sont pas installés, en général l’autre moitié d’un add-on. Le journal du contenu les nomme : « Dépendance manquante avec ID… et version …. » ',
          strong('Solution : '),
          'importe aussi le pack de comportements ou de ressources qui va avec. Un pack de textures seul n’a besoin d’aucune dépendance.',
        ),
      ],
    },
  ],
  faq: [
    {
      id: 'why-red',
      q: 'Pourquoi mon pack de textures est en rouge dans la liste des packs de ressources ?',
      a: [p('Le rouge veut dire que le format du pack ne correspond pas à ta version du jeu. Il peut quand même marcher ; exporte-le à nouveau pour ta version pour être tranquille.')],
    },
    {
      id: 'reload',
      q: 'Je dois redémarrer Minecraft après avoir changé un pack ?',
      a: [p('Non. Sur Java, appuie sur F3 + T pour recharger les packs de ressources, ou désactive puis réactive le pack. Sur Bedrock, quitte le monde et reviens-y.')],
    },
    {
      id: 'server',
      q: 'Pourquoi un serveur change mes textures ?',
      a: [p('Les serveurs peuvent envoyer leur propre pack de ressources, qui passe au-dessus du tien. Tu peux le refuser dans les réglages du serveur sur l’écran multijoueur, mais certains serveurs l’exigent.')],
    },
    {
      id: 'pack-name-error',
      q: 'Que veut dire « L’élément fourni pack.name a une valeur non valide dans le manifeste du pack » ?',
      a: [
        p(
          'Bedrock n’a pas reconnu le type de pack dans ',
          code('manifest.json'),
          ' et charge le pack comme un pack de ressources à la place (« Utilisation du pack de ressources par défaut »). Pour un pack de textures, règle le ',
          code('"type"'),
          ' du module sur ',
          code('"resources"'),
          ' ; ',
          link('/pack-doctor', 'Pack Doctor'),
          ' vérifie le manifeste.',
        ),
      ],
    },
  ],
  ctaLabel: 'Réparer mon pack avec Pack Doctor',
};

const install: GuideText = {
  intro: [
    p(
      'Sur ',
      strong('Java'),
      ', mets le ',
      code('.zip'),
      ' du pack dans le dossier ',
      code('resourcepacks'),
      ` et active-le dans ${JAVA.options} › ${JAVA.packs} Sur `,
      strong('Bedrock'),
      ', ouvre le fichier ',
      code('.mcpack'),
      ` et Minecraft l’importe ; active-le ensuite dans ${BEDROCK.settings} › ${BEDROCK.globalResources}. Les packs de shaders pour Java ont besoin d’Iris ou d’OptiFine.`,
    ),
  ],
  quick: {
    title: 'Réponse rapide',
    items: [
      ['Java : ', uiPath(JAVA.options, JAVA.packs, JAVA.openFolder), ', dépose le ', code('.zip'), ` dedans, puis passe le pack dans « ${JAVA.selected} » et clique sur « ${JAVA.done} ».`],
      ['Bedrock : ouvre le fichier ', code('.mcpack'), ', puis active-le dans ', uiPath(BEDROCK.settings, BEDROCK.globalResources), '.'],
      ['Shaders (Java) : installe Iris ou OptiFine et mets le zip du shader dans le dossier ', code('shaderpacks'), '.'],
    ],
  },
  howto: { name: 'Comment installer un pack de ressources dans Minecraft Java Edition', steps: INSTALL_JAVA_STEPS },
  sections: [
    {
      id: 'java',
      title: 'Installer un pack de ressources sur Java',
      body: [steps(INSTALL_JAVA_STEPS), h3('Où est le dossier resourcepacks ?'), folderTable('resourcepacks', FOLDER)],
    },
    {
      id: 'order',
      title: 'Utiliser plusieurs packs',
      body: [
        p(
          'Tu peux activer autant de packs que tu veux. Quand deux packs changent la même texture, celui qui est le plus haut dans la liste ',
          strong(JAVA.selected),
          ' (Java) ou dans la liste des packs actifs (Bedrock) gagne, et tout ce qu’il ne change pas passe aux packs en dessous. Une configuration courante : un petit pack avec tes propres retouches en haut, et un pack complet en dessous.',
        ),
        p(
          'Pour transformer une telle pile en un seul pack, pour le partager ou pour un serveur qui envoie un seul pack de ressources, utilise ',
          link('/merge-texture-packs', 'la fusion de packs de textures'),
          ' : elle suit la même règle, donc le pack du haut de sa liste gagne.',
        ),
        p(
          'Les launchers tiers comme Lunar Client et Badlion Client utilisent par défaut le même dossier ',
          code('resourcepacks'),
          ' dans ',
          code('.minecraft'),
          ' et ont leur propre menu de packs de ressources pour activer les packs.',
        ),
      ],
    },
    {
      id: 'bedrock',
      title: 'Installer un .mcpack sur Bedrock',
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
                  ['Double-clique sur le ', code('.mcpack'), '. Minecraft s’ouvre et affiche ', el('em', null, BEDROCK.importStarted), ', puis ', el('em', null, BEDROCK.imported), '.'],
                  ['Va dans ', uiPath(BEDROCK.settings, BEDROCK.globalResources, BEDROCK.myPacks), ', choisis le pack et appuie sur ', strong(BEDROCK.activate), '.'],
                ]),
              ],
            },
            {
              value: 'mobile',
              label: 'Android et iOS',
              icon: 'smartphone',
              content: [
                steps([
                  ['Télécharge le ', code('.mcpack'), ' sur le téléphone ou la tablette.'],
                  [strong('Android : '), 'ouvre-le depuis les téléchargements ou Fichiers et choisis Minecraft. ', strong('iPhone / iPad : '), 'touche-le dans l’appli Fichiers, puis ', uiPath('Partager', 'Minecraft'), '.'],
                  ['Active-le dans ', uiPath(BEDROCK.settings, BEDROCK.globalResources), '.'],
                ]),
              ],
            },
            {
              value: 'console',
              label: 'Consoles',
              icon: 'gamepad',
              content: [p('Xbox, PlayStation et Switch ne peuvent pas importer de fichiers. Ajoute le pack à un monde sur un PC ou un téléphone et rejoins ce monde, ou joue sur un Realm ou un serveur qui le contient.')],
            },
          ],
          UI_FR.platform,
        ),
        callout('tip', 'Juste pour un monde ?', 'Ouvre ', uiPath(BEDROCK.editWorld, BEDROCK.packs), ` et active le pack là plutôt que dans ${BEDROCK.globalResources}.`),
      ],
    },
    {
      id: 'shaders',
      title: 'Installer un pack de shaders',
      body: [
        ul([
          [strong('Iris (Java) :'), ' installe Iris avec l’installateur de ', ext('https://www.irisshaders.dev/', 'irisshaders.dev'), ', joue une fois avec le profil Iris, puis ouvre ', uiPath(JAVA.options, JAVA.video, IRIS.shaderPacks), ', clique sur ', strong(IRIS.openFolder), ' et dépose le zip dedans.'],
          [strong('OptiFine (Java) :'), ' ', uiPath(JAVA.options, JAVA.video, OPTIFINE.shaders), ', puis ', strong(OPTIFINE.folder), '.'],
          [strong('Shaders vanilla (Java, sans mods) :'), ' ce sont des packs de ressources. Installe-les dans le dossier ', code('resourcepacks'), ' comme n’importe quel autre pack.'],
          [strong('Graphismes éclatants (Bedrock) :'), ' ouvre le ', code('.mcpack'), ', active-le, puis règle ', uiPath(BEDROCK.settings, BEDROCK.video, BEDROCK.graphicsMode), ` sur ${BEDROCK.vibrantVisuals}.`],
        ]),
        folderTable('shaderpacks', FOLDER),
      ],
    },
    {
      id: 'skins',
      title: 'Installer un skin',
      body: [
        ul([
          [strong('Java :'), ` Minecraft Launcher › ${LAUNCHER.skins} › ${LAUNCHER.newSkin}, choisis « ${LAUNCHER.classic} » ou « ${LAUNCHER.slim} », va chercher le PNG et clique sur « ${LAUNCHER.saveAndUse} ». Ou mets-le en ligne sur ton profil sur minecraft.net.`],
          [strong('Bedrock :'), ' ouvre un pack de skins ', code('.mcpack'), ` et choisis le skin dans ${BEDROCK.dressingRoom} › ${BEDROCK.classicSkins}, ou importe-y un seul PNG.`],
        ]),
        p('Plus de détails dans ', link('/guides/make-a-skin', 'Comment faire un skin Minecraft perso'), '.'),
      ],
    },
    {
      id: 'troubleshooting',
      title: 'Le pack ne marche pas ?',
      body: [
        p('Voici les problèmes les plus courants. ', link('/guides/texture-pack-not-working', 'Toutes les solutions, avec les explications'), '.'),
        table(
          ['Ce que tu vois', 'Pourquoi', 'Solution'],
          [
            [`« ${JAVA.madeForOlder} » (ou plus récente)`, 'Le pack format dans pack.mcmeta n’est pas celui de ton jeu.', `Exporte à nouveau pour ta version, ou élargis la plage de compatibilité. Les packs qui ne changent que des textures marchent en général quand même si tu cliques sur « ${JAVA.yes} ».`],
            [`« ${JAVA.incompatible} » (Java 1.21.9+)`, 'pack.mcmeta n’a que pack_format, ou ses champs ne respectent pas les règles.', 'Exporte à nouveau depuis le Texture Pack Maker, qui écrit min_format et max_format.'],
            ['Le pack n’est pas du tout dans la liste', 'pack.mcmeta manque, n’est pas à la racine du zip, n’est pas du JSON valide ou n’a pas de description.', 'Vérifie que le zip s’ouvre directement sur pack.mcmeta et assets, pas sur un dossier.'],
            ['Bedrock dit que l’importation a échoué', 'manifest.json manque, n’est pas à la racine du fichier ou n’est pas valide.', 'Exporte à nouveau en .mcpack et ouvre le nouveau fichier.'],
            ['Le pack Bedrock ne change rien', 'Un autre pack au-dessus remplace les mêmes textures.', 'Place ton pack en haut de la liste des packs actifs.'],
          ],
        ),
      ],
    },
  ],
  faq: [
    {
      id: 'unzip',
      q: 'Faut-il décompresser un pack de ressources ?',
      a: [p('Non. Java charge directement les packs compressés. Un dossier décompressé marche aussi si pack.mcmeta est directement dedans, mais garder le zip est plus simple.')],
    },
    {
      id: 'order',
      q: 'Quel pack gagne quand deux packs changent la même texture ?',
      a: [p(`Celui qui est le plus haut dans la liste « ${JAVA.selected} » (Java) ou dans la liste des packs actifs (Bedrock). `, link('/merge-texture-packs', 'La fusion de packs de textures'), ' utilise le même ordre pour réunir plusieurs packs en un seul.')],
    },
    {
      id: 'realms',
      q: 'Les joueurs sur console peuvent utiliser des packs perso ?',
      a: [p('Pas en important des fichiers. Ils peuvent rejoindre un monde, un Realm ou un serveur qui contient le pack.')],
    },
  ],
  ctaLabel: 'Le guide d’installation complet pour chaque plateforme',
};

const packFormats: GuideText = {
  intro: [
    p(
      'Chaque pack de ressources Java Edition indique un ',
      strong('pack format'),
      ' dans son fichier ',
      code('pack.mcmeta'),
      ', et Minecraft le compare au sien pour décider si le pack convient. ',
      strong(`Minecraft Java ${LATEST} utilise le format de pack de ressources ${F(LATEST)}.`),
      ' Les packs de ressources sont arrivés avec la 1.6.1 ; les versions plus anciennes utilisaient des packs de textures, qui fonctionnent autrement.',
    ),
  ],
  quick: {
    title: `Réponse rapide : Minecraft ${LATEST}`,
    items: [
      ['Format de pack de ressources : ', strong(F(LATEST)), '.'],
      ['Dans ', code('pack.mcmeta'), ', écris ', code(`"min_format": ${minFormat(LATEST)}`), ' et ', code(`"max_format": ${maxFormat(LATEST)}`), ' (le format est séparé en un numéro majeur et un numéro mineur depuis la 1.21.9).'],
      ['Un pack qui vise aussi des versions plus anciennes a besoin en plus de ', code('pack_format'), ' et de ', code('supported_formats'), '. Le tableau ci-dessous liste chaque version.'],
    ],
  },
  sections: [
    {
      id: 'table',
      title: 'Le format de pack de ressources de chaque version Java',
      body: [
        p('Chaque version complète de 1.6.1 à ', LATEST, '. Les snapshots, pré-versions et release candidates ont leurs propres numéros.'),
        table(
          ['Pack format', 'Versions de Minecraft Java'],
          formatGroups()
            .reverse()
            .map((g) => [g.format, g.versions.join(', ')]),
          'guide-table formats-table',
        ),
        p(
          'Depuis le cycle de la 1.21.9, un format peut aussi avoir un numéro mineur : ',
          F(LATEST),
          ` veut dire majeur ${formatParts(LATEST).major}, mineur ${formatParts(LATEST).minor}. Mojang augmente le numéro mineur pour les ajouts qui ne cassent pas les anciens packs. Au moment où ce guide est écrit, le premier snapshot de la ${NEXT_SNAPSHOT.version} utilise ${NEXT_SNAPSHOT.format}.`,
        ),
      ],
    },
    {
      id: 'eras',
      title: 'Comment pack.mcmeta a changé',
      body: [
        table(
          ['Versions du jeu', 'Champs que le jeu lit'],
          [
            ['1.6.1 – 1.8.7', [code('pack_format'), ' et ', code('description'), '. Il n’y a aucune vérification de version, donc n’importe quel numéro se charge.']],
            ['1.8.8 – 1.20.1', [code('pack_format'), ' seulement. Le pack est compatible quand il est égal au numéro du jeu ; sinon, Minecraft prévient mais te laisse l’utiliser.']],
            ['1.20.2 – 1.21.8', [code('pack_format'), ' (obligatoire) plus une plage ', code('supported_formats'), ' en option, comme ', code('[15, 64]'), '.']],
            [`1.21.9 – ${LATEST}`, [code('min_format'), ' et ', code('max_format'), ' (obligatoires ensemble). Un pack dont la plage remonte jusqu’au format 64 ou plus bas doit aussi avoir ', code('pack_format'), ' et ', code('supported_formats'), ' ; un pack seulement pour la 1.21.9+ ne doit pas utiliser ', code('supported_formats'), '.']],
          ],
        ),
      ],
    },
    {
      id: 'examples',
      title: 'Exemples',
      body: [
        h3(`Seulement Java ${LATEST}`),
        pre(mcmetaFor(LATEST, `Mon pack pour Minecraft ${LATEST}`)),
        p('Un nombre seul dans ', code('max_format'), ` veut dire « n’importe quelle version mineure », donc ${maxFormat(LATEST)} couvre ${maxFormat(LATEST)}.0 et ${F(LATEST)}. Écrire `, code(`[${maxFormat(LATEST)}, 0]`), ` à cet endroit rendrait le pack trop vieux pour la ${LATEST}.`),
        h3(`De 1.20.1 à ${LATEST}`),
        pre(mcmetaRange('1.20.1', LATEST, `Mon pack pour Minecraft 1.20.1 - ${LATEST}`)),
        p('La 1.20.1 lit ', code('pack_format'), ', les versions 1.20.2 – 1.21.8 lisent ', code('supported_formats'), ' et la 1.21.9 et plus récent lisent ', code('min_format'), ' et ', code('max_format'), '.'),
        h3('Seulement 1.20.1 (et 1.20)'),
        pre(mcmetaLegacy('1.20.1', 'Mon pack pour Minecraft 1.20.1')),
        callout('tip', 'Laisse l’outil s’en charger', 'Dans le Texture Pack Maker, choisis ta version et, si tu veux, une plage de compatibilité dans l’onglet Pack. L’export reçoit exactement les champs dont chaque version a besoin.'),
      ],
    },
    {
      id: 'bedrock',
      title: 'Et Bedrock ?',
      body: [
        p(
          'Les packs Bedrock n’ont pas de numéro de pack format. Leur ',
          code('manifest.json'),
          ' utilise ',
          code('"format_version": 2'),
          ' et un ',
          code('min_engine_version'),
          ' comme ',
          code(MIN_ENGINE),
          '. Les numéros de version de Bedrock suivent maintenant l’année (la 26.0 est sortie en février 2026), mais les manifestes gardent l’ancien style, donc la 26.50 s’écrit ',
          code('[1, 26, 50]'),
          '.',
        ),
      ],
    },
  ],
  faq: [
    {
      id: 'latest',
      q: `Quel est le format de pack de ressources de Minecraft ${LATEST} ?`,
      a: [p(`${F(LATEST)}. Écris "min_format": ${minFormat(LATEST)} et "max_format": ${maxFormat(LATEST)} dans pack.mcmeta pour un pack seulement pour la ${LATEST}.`)],
    },
    {
      id: '1211',
      q: 'Quel est le pack format de la 1.21.1 et de la 1.20.1 ?',
      a: [p(`La 1.21 et la 1.21.1 utilisent ${F('1.21.1')} ; la 1.20 et la 1.20.1 utilisent ${F('1.20.1')}. La 1.8.9 et les versions 1.x plus anciennes depuis la 1.6.1 utilisent ${F('1.8.9')}.`)],
    },
    {
      id: 'broken',
      q: `Pourquoi mon pack indique « ${JAVA.incompatible} » ?`,
      a: [p('En 1.21.9 et plus récent, un pack qui n’a qu’un pack_format élevé (au-dessus de 64) et pas de min_format / max_format échoue à la vérification. Il peut quand même être activé, mais il vaut mieux ajouter les deux champs.')],
    },
  ],
  ctaLabel: 'Faire un pack avec le bon format',
};

const makeASkin: GuideText = {
  image: SHOTS.skin2d,
  intro: [
    p(
      'Un skin Minecraft est une image PNG de 64×64 pixels qui s’enroule autour du modèle du joueur ; Bedrock accepte aussi des skins HD de 128×128 pixels. Tu peux en dessiner un dans ton navigateur : peins sur le modèle, vérifie-le sur un modèle 3D, puis mets-le en ligne dans le Minecraft Launcher (Java) ou importe-le en pack de skins (Bedrock).',
    ),
  ],
  quick: {
    title: 'En bref',
    items: ['Ouvre le Skin Maker et choisis un modèle ou un skin de départ.', 'Peins-le en regardant l’aperçu 3D.', 'Exporte un PNG pour Java ou un .mcpack pour Bedrock et mets-le en jeu.'],
  },
  howto: { name: 'Comment faire un skin Minecraft perso en ligne', steps: SKIN_STEPS },
  sections: [
    { id: 'steps', title: 'Pas à pas', body: [steps(SKIN_STEPS), figure(SHOTS.skin2d), figure(SHOTS.skin3d)] },
    {
      id: 'template',
      title: 'Comment marche le modèle de skin',
      body: [
        ul([
          ['L’image fait ', strong('64×64'), ' pixels. Java 1.7.10 et avant utilisent l’ancien format ', strong('64×32'), ', qui n’a pas de bras et de jambe gauches séparés ; Bedrock accepte aussi des skins HD ', strong('128×128'), '.'],
          ['Il y a deux couches. La ', strong('couche de base'), ' est le corps ; la ', strong('couche extérieure'), ' (chapeau, veste, manches et jambes de pantalon) flotte juste au-dessus et peut être transparente.'],
          ['Les bras ', strong('classiques'), ' (Steve) font 4 pixels de large et les bras ', strong('fins'), ' (Alex) 3 pixels. Mets le skin en ligne avec le même modèle que celui que tu as peint.'],
          'Les parties inutilisées du modèle doivent rester complètement transparentes.',
        ]),
      ],
    },
    {
      id: 'hd-skins',
      title: 'Les skins HD 128×128',
      body: [
        p(
          'Un skin HD, c’est le même modèle en deux fois plus grand : 128×128 pixels au lieu de 64×64, donc chaque visage, manche et chaussure a quatre fois plus de pixels pour les ombres, les yeux et les motifs fins. Là où ça marche :',
        ),
        ul([
          [strong('Bedrock Edition'), ` (Windows, Android, iPhone et iPad) : importe le PNG dans le ${BEDROCK.dressingRoom}, ou mets-le dans un pack de skins. Un pack peut mélanger des skins 64×64 et HD.`],
          [strong('Java Edition'), ' : le Minecraft Launcher et minecraft.net n’acceptent que des skins 64×64. Un skin HD a besoin d’un mod qui charge les skins HD, comme CustomSkinLoader.'],
        ]),
        h3('En faire un dans le Skin Maker'),
        steps([
          ['Sur l’écran de départ, règle ', strong('Size'), ' sur ', strong('HD 128×128'), ', puis choisis un point de départ. Les modèles et les skins de départ sont doublés en 128×128, et un PNG 128×128 que tu importes reste en HD.'],
          ['Tu peins déjà un skin 64×64 ? Passe ', strong('Size'), ' sur ', strong('HD 128'), ' dans l’éditeur et confirme avec ', strong('Make HD'), '. Chaque pixel devient un bloc de 2×2, donc le skin a le même aspect jusqu’à ce que tu peignes des détails plus fins. ', strong('Size'), ' › ', strong('64×64'), ' et ', strong('Reduce to 64×64'), ' reviennent en arrière.'],
          ['Exporte ', strong('Bedrock skin (.png)'), ` pour l’importer dans le ${BEDROCK.dressingRoom}, ou un `, strong('Bedrock skin pack (.mcpack)'), '. Les deux gardent le 128×128.'],
          ['Pour Java, ', strong('Java skin (.png)'), ' télécharge une copie 64×64, où chaque bloc de 2×2 devient un pixel ; ton skin HD reste tel quel. Tu utilises un mod de skins HD ? Choisis plutôt ', strong('128×128 for mods'), '.'],
        ]),
        callout('warn', 'Limites', `Les consoles ne peuvent importer aucun fichier de skin, quelle que soit sa taille. Les skins plus grands que 128×128 ne sont pas pris en charge. Les joueurs qui activent « ${BEDROCK.trustedSkins} » voient tous les skins perso, HD ou non, comme un skin par défaut.`),
      ],
    },
    {
      id: 'java',
      title: 'L’utiliser sur Java',
      body: [
        steps([
          ['Ouvre le Minecraft Launcher et va dans ', uiPath('Minecraft: Java Edition', LAUNCHER.skins), '.'],
          ['Clique sur ', strong(LAUNCHER.newSkin), ', donne-lui un nom et choisis ', strong(LAUNCHER.classic), ' ou ', strong(LAUNCHER.slim), '.'],
          ['Clique sur ', strong(LAUNCHER.browse), ', choisis ton PNG, puis ', strong(LAUNCHER.saveAndUse), '.'],
        ]),
        p('Tu peux aussi le mettre en ligne sur ton profil sur ', ext('https://www.minecraft.net/', 'minecraft.net'), '.'),
      ],
    },
    {
      id: 'bedrock',
      title: 'Faire un pack de skins Bedrock perso',
      body: [
        p(
          'Un pack de skins est un ',
          code('.mcpack'),
          ' qui contient un ou plusieurs skins. Le Skin Maker le construit pour toi ; à l’intérieur, il y a un ',
          code('manifest.json'),
          ' (type de module ',
          code('skin_pack'),
          '), un ',
          code('skins.json'),
          ' qui liste chaque skin avec le modèle classique (',
          code('geometry.humanoid.custom'),
          ') ou fin (',
          code('geometry.humanoid.customSlim'),
          ') et ',
          code('"type": "free"'),
          ', les PNG des skins à la racine, et les noms dans ',
          code('texts/en_US.lang'),
          '.',
        ),
        steps([
          ['Peins chaque skin comme un projet à part. Les skins classiques et fins peuvent partager un pack.'],
          ['Choisis ', strong('Export'), ' › ', strong('Bedrock skin pack'), ', donne un nom au pack et coche les autres skins à inclure.'],
          'Ouvre le .mcpack (double-clic sur Windows, Ouvrir avec Minecraft sur Android, Partager › Minecraft sur iPhone et iPad).',
          ['Dans Minecraft, va dans ', uiPath(BEDROCK.dressingRoom, BEDROCK.classicSkins), ', trouve ton pack, choisis le skin et appuie sur ', strong(BEDROCK.equip), '.'],
        ]),
        figure(SHOTS.skinPack),
        callout('warn', 'Bon à savoir', `Les consoles ne peuvent pas importer de fichiers de skins. Les joueurs qui activent « ${BEDROCK.trustedSkins} » voient les skins perso comme des skins par défaut. Les modèles perso ne sont pas autorisés dans les packs de skins importés, seulement classique et fin.`),
        p('L’installation, les mises à jour et les fichiers à l’intérieur, pas à pas : ', link('/guides/make-a-bedrock-skin-pack', 'Comment faire un pack de skins Minecraft Bedrock'), '.'),
      ],
    },
  ],
  faq: [
    { id: 'size', q: 'Quelle taille doit faire un skin Minecraft ?', a: [p('64×64 pixels, enregistré en PNG. Utilise le 64×32 seulement pour Java 1.7.10 et avant. Bedrock accepte aussi des skins HD de 128×128 pixels.')] },
    {
      id: 'hd',
      q: 'Je peux faire un skin Minecraft 128×128 ?',
      a: [
        p(
          'Oui, pour Bedrock Edition. Dans le Skin Maker, règle ',
          strong('Size'),
          ' sur ',
          strong('HD 128×128'),
          ' avant de commencer, ou passe un skin existant en ',
          strong('HD 128'),
          ', puis exporte un PNG Bedrock ou un pack de skins. Java Edition n’affiche que les skins 64×64 sans mods, donc l’export Java fait une copie 64×64 ; les mods de skins HD comme CustomSkinLoader peuvent utiliser le fichier 128×128.',
        ),
      ],
    },
    { id: 'username', q: 'Je peux partir du skin de quelqu’un ?', a: [p('Oui. Le Skin Maker peut charger le skin actuel de n’importe quel joueur Java avec son pseudo, pour que tu le remixes. Respecte le travail des autres.')] },
    { id: 'phone', q: 'Je peux faire un skin sur mon téléphone ?', a: [p('Oui. L’éditeur marche au toucher, avec le zoom à deux doigts.')] },
    {
      id: 'slim-pack',
      q: 'Un pack de skins peut mélanger skins classiques et fins ?',
      a: [p('Oui. Chaque skin d’un pack a son propre modèle, donc un pack de skins perso peut contenir des skins classiques (bras de 4 pixels) et fins (bras de 3 pixels) côte à côte.')],
    },
    {
      id: 'update-pack',
      q: 'Comment mettre à jour un pack de skins que j’ai déjà importé ?',
      a: [p('Exporte-le à nouveau depuis le même projet et ouvre le nouveau .mcpack. Le pack garde ses identifiants et reçoit un numéro de version plus élevé, donc Minecraft remplace l’ancien au lieu d’ajouter une copie.')],
    },
  ],
  ctaLabel: 'Ouvrir le Skin Maker',
};

const bedrockSkinPack: GuideText = {
  image: SHOTS.skinPack,
  intro: [
    p(
      strong('Oui, tu peux faire ton propre pack de skins pour Minecraft Bedrock, gratuitement.'),
      ' Un pack de skins est un fichier ',
      code('.mcpack'),
      ' qui contient un ou plusieurs skins et deux petits fichiers de description, ',
      code('manifest.json'),
      ' et ',
      code('skins.json'),
      '. Peins ou importe tes skins dans le ',
      link('/skin-pack-maker', 'Skin Pack Maker'),
      `, télécharge le pack, ouvre-le sur Windows, Android, iPhone ou iPad, et porte tes skins depuis le ${BEDROCK.dressingRoom}. Vendre un pack sur le Marketplace de Minecraft, c’est autre chose : seuls les partenaires Marketplace approuvés par Mojang peuvent y publier.`,
    ),
  ],
  quick: {
    title: 'En bref',
    items: [
      ['Peins ou importe chaque skin dans le ', link('/skin-pack-maker', 'Skin Pack Maker'), ', avec des bras classiques ou fins.'],
      ['Choisis ', strong('Export'), ' › ', strong('Bedrock skin pack (.mcpack)'), ', donne un nom au pack et coche les autres skins.'],
      ['Ouvre le ', code('.mcpack'), ' et équipe un skin dans ', uiPath(BEDROCK.dressingRoom, BEDROCK.classicSkins), '.'],
    ],
  },
  howto: { name: 'Comment faire un pack de skins Minecraft Bedrock', steps: SKIN_PACK_STEPS },
  sections: [
    {
      id: 'what',
      title: 'Qu’y a-t-il dans un pack de skins ?',
      body: [
        p('Un pack de skins est un fichier zip renommé en ', code('.mcpack'), '. Ces fichiers sont à sa racine :'),
        table(
          ['Fichier', 'À quoi il sert'],
          [
            [code('manifest.json'), ['Le nom du pack, deux identifiants uniques (UUID) et un numéro de version. Son type de module ', code('skin_pack'), ' dit à Minecraft que c’est un pack de skins, pas un pack de textures.']],
            [code('skins.json'), ['La liste des skins : pour chacun, sa clé de nom, son PNG, le modèle (', code('geometry.humanoid.custom'), ' pour les bras classiques, ', code('geometry.humanoid.customSlim'), ' pour les bras fins) et ', code('"type": "free"'), '.']],
            ['Images des skins', ['Un PNG 64×64 par skin, à côté de ', code('manifest.json'), '.']],
            [code('texts/en_US.lang'), [`Les noms affichés dans le ${BEDROCK.dressingRoom}, pour le pack et pour chaque skin. `, code('texts/languages.json'), ' liste les fichiers de langue.']],
          ],
        ),
        p(
          code('"type": "free"'),
          ' veut dire que toute personne qui a le pack peut porter le skin. Les packs du Marketplace marquent la plupart des skins comme ',
          code('"paid"'),
          ', qui ne se débloquent qu’une fois le pack acheté : un pack que tu fais toi-même utilise donc toujours free.',
        ),
      ],
    },
    {
      id: 'steps',
      title: 'En faire un avec le Skin Pack Maker',
      body: [
        steps(SKIN_PACK_STEPS),
        figure(SHOTS.skinPack),
        p(
          'L’outil écrit ',
          code('manifest.json'),
          ', ',
          code('skins.json'),
          ' et le fichier de langue pour toi, avec de nouveaux identifiants pour chaque pack. Les skins classiques et fins peuvent partager un pack, chaque skin garde son nom, et le nom de pack que tu tapes est le titre que les joueurs voient au-dessus des skins.',
        ),
        figure(SHOTS.skin3d),
      ],
    },
    {
      id: 'install',
      title: 'L’installer sur Windows, Android et iOS',
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
                  ['Double-clique sur le ', code('.mcpack'), '. Minecraft s’ouvre et affiche ', el('em', null, BEDROCK.importStarted), ', puis ', el('em', null, BEDROCK.imported), '.'],
                  ['Ouvre ', uiPath(BEDROCK.dressingRoom, BEDROCK.classicSkins), ', choisis un skin de ton pack et appuie sur ', strong(BEDROCK.equip), '.'],
                ]),
              ],
            },
            {
              value: 'mobile',
              label: 'Android et iOS',
              icon: 'smartphone',
              content: [
                steps([
                  ['Télécharge le ', code('.mcpack'), ' sur le téléphone ou la tablette.'],
                  [strong('Android : '), 'ouvre-le depuis les téléchargements ou Fichiers et choisis Minecraft. ', strong('iPhone / iPad : '), 'touche-le dans l’appli Fichiers, puis ', uiPath('Partager', 'Minecraft'), '.'],
                  ['Ouvre ', uiPath(BEDROCK.dressingRoom, BEDROCK.classicSkins), ' et équipe un skin de ton pack.'],
                ]),
              ],
            },
            {
              value: 'console',
              label: 'Consoles',
              icon: 'gamepad',
              content: [p('Xbox, PlayStation et Switch ne peuvent importer ni packs de skins ni fichiers de skins. Sur console, les looks perso viennent du Créateur de personnage ou des packs de skins du Marketplace.')],
            },
          ],
          UI_FR.platform,
        ),
        callout(
          'tip',
          'Juste un skin ?',
          `Pas besoin d’un pack pour un seul skin : dans ${BEDROCK.classicSkins}, ouvre tes skins possédés, choisis ${BEDROCK.import} et prends un PNG 64×64. Un pack est plus pratique pour plusieurs skins, garde leurs noms et s’installe de la même façon sur chaque appareil.`,
        ),
      ],
    },
    {
      id: 'update',
      title: 'Mettre à jour ou supprimer un pack de skins',
      body: [
        p(
          'Pour changer un pack déjà importé, modifie les skins, exporte à nouveau le pack depuis le même projet et ouvre le nouveau fichier. L’outil garde les deux identifiants du pack et augmente sa version (1.0.0, puis 1.0.1, etc.), donc Minecraft remplace le pack installé au lieu de l’afficher deux fois.',
        ),
        p(
          'Tu as fait le pack à la main ? Garde les deux UUID et augmente la version dans ',
          code('manifest.json'),
          ', dans l’en-tête et dans le module. De nouveaux UUID te donnent un deuxième pack, et la même version n’est pas importée à nouveau parce que ce pack est déjà installé.',
        ),
        p('Pour supprimer un pack, va dans ', uiPath(BEDROCK.settings, BEDROCK.storage), ', choisis-le et supprime-le.'),
      ],
    },
    {
      id: 'arms',
      title: 'Bras classiques ou fins',
      body: [
        p(
          'Chaque skin d’un pack a son propre modèle, donc un même pack peut mélanger les deux. Les bras ',
          strong('classiques'),
          ' (Steve) font 4 pixels de large et utilisent ',
          code('geometry.humanoid.custom'),
          ' ; les bras ',
          strong('fins'),
          ' (Alex) font 3 pixels de large et utilisent ',
          code('geometry.humanoid.customSlim'),
          '. Le modèle doit correspondre à la façon dont le skin a été peint, sinon les bras ont l’air coupés ou ont une bande transparente.',
        ),
        p('Les packs importés ne peuvent utiliser que ces deux modèles. Les formes perso, comme une tête énorme, ne sont pas autorisées dans un pack de skins que tu importes toi-même.'),
      ],
    },
    {
      id: 'by-hand',
      title: 'Faire un pack de skins à la main',
      body: [
        p('Tu peux aussi écrire les fichiers toi-même dans n’importe quel éditeur de texte. Un pack avec deux skins ressemble à ça :'),
        pre(SKIN_PACK_TREE),
        p(
          code('manifest.json'),
          ' a besoin de deux UUID différents. Crée les tiens avec n’importe quel générateur d’UUID au lieu de copier ceux ci-dessous, et garde-les pour les mises à jour :',
        ),
        pre(SKIN_PACK_MANIFEST.trimEnd()),
        p(
          code('skins.json'),
          ' liste les skins. ',
          code('serialize_name'),
          ' et ',
          code('localization_name'),
          ' sont l’identifiant du pack : un seul mot sans espaces qu’aucun autre pack n’utilise. Le Skin Pack Maker y ajoute le début de l’UUID du pack pour en être sûr.',
        ),
        pre(SKIN_PACK_SKINS_JSON.trimEnd()),
        p(code('texts/en_US.lang'), ' contient les noms affichés dans le jeu, et ', code('texts/languages.json'), ' contient ', code('["en_US"]'), ' :'),
        pre(SKIN_PACK_LANG.trimEnd()),
        steps([
          ['Range les fichiers dans un dossier comme ci-dessus, avec les PNG à côté de ', code('manifest.json'), '.'],
          'Sélectionne les fichiers à l’intérieur du dossier, pas le dossier lui-même, et ajoute-les à un zip.',
          ['Renomme le zip de ', code('.zip'), ' en ', code('.mcpack'), ' et ouvre-le.'],
        ]),
        p(
          'Si l’importation échoue, la cause habituelle est un dossier autour des fichiers dans le zip, une faute de frappe dans le JSON ou deux UUID identiques. Le ',
          link('/skin-pack-maker', 'Skin Pack Maker'),
          ' écrit exactement ces fichiers : tu peux donc aussi exporter un pack, le renommer en ',
          code('.zip'),
          ' et regarder dedans.',
        ),
      ],
    },
    {
      id: 'marketplace',
      title: 'Packs du Marketplace et packs perso',
      body: [
        p(
          'Tu veux faire un pack de skins pour le Marketplace de Minecraft ? Seuls les partenaires Marketplace peuvent y publier : des studios et des créateurs que Mojang a acceptés dans son programme de partenaires, et qui soumettent chaque pack à une vérification. Il n’y a aucun moyen de mettre un pack sur le Marketplace depuis le jeu ou depuis un site web.',
        ),
        ul([
          [strong('Pack de skins perso : '), 'gratuit, fait par n’importe qui, importé depuis un ', code('.mcpack'), ' sur Windows, Android, iPhone et iPad. Tu peux partager le fichier avec tes amis.'],
          [strong('Pack de skins du Marketplace : '), 'fait par un partenaire approuvé, acheté avec des Minecoins ou gratuit, disponible sur chaque appareil, consoles comprises.'],
        ]),
        p('Ne mets dans un pack que des skins que tu as faits toi-même ou que tu as le droit de partager.'),
      ],
    },
    {
      id: 'trusted',
      title: 'Pourquoi tes amis peuvent voir un skin par défaut',
      body: [
        p(
          'Bedrock a un réglage appelé ',
          strong(BEDROCK.trustedSkins),
          '. Les joueurs qui l’activent voient tous les skins perso, y compris ceux des packs importés, comme un skin par défaut comme Steve ou Alex. C’est un réglage de leur côté, donc tu ne peux pas le changer pour eux. Tous les autres voient ton skin comme tu l’as fait.',
        ),
      ],
    },
  ],
  faq: [
    {
      id: 'free',
      q: 'On peut faire des packs de skins Minecraft pour Bedrock gratuitement ?',
      a: [p('Oui. Les packs de skins perso sont gratuits à faire et à utiliser sur Windows, Android, iPhone et iPad. Le Skin Pack Maker n’a pas besoin de compte, et tes skins restent sur ton appareil.')],
    },
    {
      id: 'java',
      q: 'Les packs de skins marchent sur Java Edition ?',
      a: [p('Non. Les packs de skins sont une fonction de Bedrock. Sur Java, tu portes un skin à la fois, mis en ligne en PNG dans le Minecraft Launcher. ', link('/guides/make-a-skin', 'Comment faire un skin'), '.')],
    },
    {
      id: 'console',
      q: 'Je peux utiliser un pack de skins perso sur Xbox, PlayStation ou Switch ?',
      a: [p('Non. Les consoles ne peuvent importer ni packs de skins ni fichiers de skins. Windows, Android, iPhone et iPad, oui.')],
    },
    {
      id: 'marketplace',
      q: 'Je peux vendre mon pack de skins sur le Marketplace ?',
      a: [p('Seulement en tant que partenaire Minecraft Marketplace approuvé. Un pack perso peut être partagé en fichier .mcpack, mais pas vendu dans le jeu.')],
    },
    {
      id: 'failed',
      q: 'Pourquoi l’importation échoue ?',
      a: [p('En général, le zip a un dossier autour des fichiers, le JSON a une faute de frappe, les deux UUID sont identiques, ou un pack avec les mêmes identifiants et la même version est déjà installé. Les packs exportés depuis le Skin Pack Maker évitent ces quatre problèmes.')],
    },
  ],
  ctaLabel: 'Ouvrir le Skin Pack Maker',
};

const shadersWithoutMods: GuideText = {
  image: SHOTS.shaderVanilla,
  intro: [
    p(
      strong('Oui, dans certaines limites.'),
      ` Tu n’as pas besoin d’OptiFine, d’Iris ni d’aucun autre mod pour des effets de shaders simples. Sur Java 1.17 et plus récent, un simple pack de ressources peut remplacer certains fichiers de shaders de Minecraft, donc tu obtiens un étalonnage des couleurs, une vignette, un brouillard modifié et, en ${LATEST}, du bloom sans rien installer. Sur Bedrock, le code de shader perso n’est pas autorisé, mais un pack Graphismes éclatants règle la lumière, le ciel, le brouillard et l’eau intégrés. Les vraies ombres et les reflets sur Java ont toujours besoin d’Iris ou d’OptiFine.`,
    ),
  ],
  howto: { name: 'Comment faire un pack de shaders Minecraft Java sans mods', steps: VANILLA_SHADER_STEPS },
  sections: [
    {
      id: 'java',
      title: 'Java : des shaders dans un pack de ressources',
      body: [
        p('Depuis la 1.17, Minecraft dessine le monde avec des fichiers de shaders qu’un pack de ressources peut remplacer. Ce qu’un pack de shaders vanilla peut faire dépend de la version :'),
        table(
          ['Effet', 'Marche sur'],
          [
            ['Étalonnage des couleurs (luminosité, contraste, saturation, chaleur, noir et blanc, sépia)', 'Java 1.17 et plus récent'],
            ['Vignette', 'Java 1.17 et plus récent'],
            ['Distance et couleur du brouillard', 'Java 1.17 et plus récent'],
            ['Bloom (halo lumineux sur tout l’écran)', `Java ${LATEST} et plus récent`],
            ['Plantes qui ondulent', 'Seulement 1.17 – 1.21.4 et 1.21.6 – 1.21.10'],
            ['Vraies ombres, reflets, rayons de lumière', 'Impossible sans Iris ou OptiFine'],
          ],
        ),
        p(`Java ${LATEST} a ajouté un point d’accroche pour un effet plein écran toujours actif, c’est pour ça que le bloom et un étalonnage des couleurs plus propre y marchent. Les versions 1.16.5 et plus anciennes n’ont pas de shaders du monde remplaçables.`),
        callout('warn', 'Une version précise', 'Mojang change souvent ces fichiers de shaders, donc un pack de shaders vanilla ne marche que dans la version pour laquelle il a été fait. Un shader cassé peut faire désactiver tous tes packs de ressources par Minecraft, c’est pour ça que chaque shader que le Shader Maker écrit est d’abord vérifié à la compilation.'),
        h3('En faire un'),
        steps(VANILLA_SHADER_STEPS),
        figure(SHOTS.shaderVanilla),
      ],
    },
    {
      id: 'bedrock',
      title: 'Bedrock : les Graphismes éclatants plutôt que des shaders',
      body: [
        p(
          'Bedrock a arrêté de charger du code de shader perso quand il est passé au moteur RenderDragon (1.16.200 sur Windows et consoles, 1.18.30 sur les autres appareils). Les outils qui échangent les fichiers de shaders compilés du jeu ont besoin d’installations du jeu modifiées et cassent à chaque mise à jour.',
        ),
        p(
          'La méthode officielle, ce sont les ',
          strong(BEDROCK.vibrantVisuals),
          ' (Vibrant Visuals) : le moteur de rendu moderne de Bedrock, dans le jeu stable depuis la 1.21.90 (juin 2025). Un pack de ressources peut changer ses réglages : la lumière du soleil et de la lune, les couleurs du ciel, le brouillard, l’eau, les ombres et l’étalonnage des couleurs, selon le moment de la journée et selon le biome. ',
          link('/guides/bedrock-vibrant-visuals-settings', 'Les réglages des Graphismes éclatants expliqués'),
          '.',
        ),
      ],
    },
    {
      id: 'mods',
      title: 'Des shaders sans OptiFine : utilise Iris',
      body: [
        p(
          `Si « sans mods » veut dire « sans OptiFine », la réponse, c’est Iris. Il charge les mêmes packs de shaders (vraies ombres du soleil, feuilles qui ondulent, eau qui reflète, rayons de lumière), tourne avec le mod d’optimisation Sodium et existe pour Java de 1.16.5 à ${LATEST}. Au moment où ce guide est écrit, OptiFine va jusqu’à la 26.2.`,
        ),
        steps([
          ['Télécharge l’installateur d’Iris sur ', ext('https://www.irisshaders.dev/', 'irisshaders.dev'), ' et lance-le. Il installe Iris et Sodium pour la version que tu choisis.'],
          'Lance le jeu une fois avec le nouveau profil Iris dans le Minecraft Launcher.',
          ['Ouvre ', uiPath(JAVA.options, JAVA.video, IRIS.shaderPacks), ', clique sur ', strong(IRIS.openFolder), ' et dépose le zip d’un pack de shaders dedans.'],
          `Choisis le pack dans la liste et clique sur « ${IRIS.apply} ». Les packs légers conviennent aux ordinateurs portables ; les plus lourds ont besoin d’une bonne carte graphique.`,
        ]),
        figure(SHOTS.shaderIris),
        p(
          'Sur Forge ou NeoForge, cherche un portage d’Iris pour ce loader. Tu peux aussi créer ton propre pack de shaders Iris / OptiFine, avec des préréglages et un aperçu en direct, dans le ',
          link('/shaders', 'Shader Maker'),
          '.',
        ),
      ],
    },
  ],
  faq: [
    { id: 'optifine', q: 'Faut-il OptiFine pour les shaders vanilla ?', a: [p('Non. Les packs de shaders vanilla sont des packs de ressources normaux. Ils marchent sans aucun mod dans la version pour laquelle ils ont été faits.')] },
    { id: 'servers', q: 'Les packs de shaders vanilla marchent sur les serveurs ?', a: [p('Oui. Les packs de ressources sont appliqués par ton propre jeu, donc ils marchent aussi quand tu joues sur un serveur.')] },
    { id: 'bedrock', q: 'Je peux utiliser des shaders Java sur Bedrock ?', a: [p('Non. Bedrock ne peut pas charger de code de shader depuis des packs. Utilise plutôt un pack Graphismes éclatants.')] },
  ],
  ctaLabel: 'Ouvrir le Shader Maker',
};

const vibrantVisuals: GuideText = {
  image: SHOTS.vibrantVisuals,
  intro: [
    p(
      'Les ',
      strong(BEDROCK.vibrantVisuals),
      ' (Vibrant Visuals en anglais) sont le mode graphique moderne de Minecraft Bedrock, avec une lumière du soleil directionnelle, des ombres douces, un brouillard volumétrique, de l’eau qui reflète et des matériaux physiques. Ils sont sortis des expériences avec la 1.21.90 (juin 2025) et sont le mode graphique par défaut sur les appareils compatibles. Un pack de ressources peut régler leurs paramètres ; il ne peut pas ajouter de nouveau code de shader.',
    ),
  ],
  howto: { name: 'Comment utiliser un pack Graphismes éclatants dans Minecraft Bedrock', steps: VV_STEPS },
  sections: [
    {
      id: 'settings',
      title: 'Ce qu’un pack Graphismes éclatants peut changer',
      body: [
        table(
          ['Dossier du pack', 'Ce qu’il règle'],
          [
            [code('lighting/'), 'La luminosité, la couleur et l’inclinaison de la course du soleil et de la lune, la lumière ambiante (des grottes), la lumière du ciel et l’intensité des couleurs des blocs lumineux.'],
            [code('atmospherics/'), 'Les couleurs du ciel au-dessus de toi et à l’horizon, et la façon dont la lumière se diffuse dans l’air (densité du ciel, lueur du coucher de soleil).'],
            [code('color_grading/'), 'L’opérateur de tone mapping, le contraste, la saturation, le gain, le gamma et la température de couleur : le rendu « film ».'],
            [code('water/'), 'La couleur de l’eau, les vagues et les caustiques (les motifs de lumière sous l’eau).'],
            [code('shadows/'), 'Des ombres en blocs ou douces.'],
            [code('fogs/'), 'La densité et la couleur du brouillard volumétrique, et le brouillard de distance classique.'],
            [code('local_lighting/'), 'La couleur de la lumière des blocs comme les torches et les lanternes.'],
          ],
        ),
        p('Les réglages peuvent changer selon le moment de la journée, et les valeurs de Minecraft lui-même diffèrent selon le biome : un bon pack règle donc chaque biome au lieu de remplacer un seul fichier global.'),
        p(strong('Non réglable par les packs : '), 'le bloom, l’exposition, les reflets en espace écran, l’éclairage des nuages, la courbe de tone mapping elle-même, la distance d’affichage et l’anticrénelage. Tout ça vit dans le moteur de rendu du jeu, pas dans les packs de ressources.'),
      ],
    },
    {
      id: 'devices',
      title: 'Quels appareils les prennent en charge',
      body: [
        ul([
          'Les PC Windows avec DirectX 12.',
          'Les Xbox Series et la PlayStation 5 ; sur Xbox One et PS4, ils sont désactivés par défaut.',
          'Les iPhone et iPad avec une puce A12 ou plus récente.',
          'Beaucoup d’appareils Android récents.',
        ]),
        p(`Ils ne sont pas disponibles sur la première Nintendo Switch, les Chromebooks et les tablettes Fire. Les serveurs peuvent les désactiver, et le jeu en écran partagé utilise plutôt les graphismes ${'Élaborés'}.`),
      ],
    },
    {
      id: 'enable',
      title: 'Les activer avec un pack',
      body: [
        steps(VV_STEPS),
        callout(
          'warn',
          `${BEDROCK.vibrantVisuals} grisés ?`,
          'Minecraft ne les autorise que si tous les packs de ressources actifs les prennent en charge. Les packs de textures classiques les désactivent, donc désactive ces packs (ou utilise un pack fait pour les Graphismes éclatants). L’option a aussi besoin d’un appareil compatible.',
        ),
        figure(SHOTS.vibrantVisuals),
      ],
    },
  ],
  faq: [
    { id: 'what', q: 'C’est quoi, les Graphismes éclatants dans Minecraft ?', a: [p('Le mode graphique moderne intégré à Bedrock, sorti avec la 1.21.90. Il ajoute une lumière directionnelle, des ombres, un brouillard volumétrique, des reflets dans l’eau et des matériaux PBR sans add-ons.')] },
    { id: 'textures', q: 'Les Graphismes éclatants ont besoin d’un pack de textures spécial ?', a: [p('Non, ils marchent avec les textures par défaut. Mais un pack de textures classique qui ne déclare pas prendre en charge les Graphismes éclatants désactive ce mode tant qu’il est actif.')] },
    { id: 'classic-fog', q: 'Les changements de brouillard marchent sans les Graphismes éclatants ?', a: [p('Le brouillard de distance classique peut être changé dans tous les modes graphiques. Le brouillard volumétrique et les réglages de lumière ne s’appliquent qu’avec les Graphismes éclatants.')] },
  ],
  ctaLabel: 'Créer un pack Graphismes éclatants',
};

const javaVsBedrock: GuideText = {
  intro: [
    p(
      'Java et Bedrock ont tous les deux des packs de ressources, mais les fichiers ne sont pas interchangeables. Un pack ',
      strong('Java'),
      ' est un ',
      code('.zip'),
      ' avec ',
      code('pack.mcmeta'),
      ' et des textures PNG dans ',
      code('assets/minecraft/textures/'),
      '. Un pack ',
      strong('Bedrock'),
      ' est un ',
      code('.mcpack'),
      ' avec ',
      code('manifest.json'),
      ' et des textures dans ',
      code('textures/'),
      '. Pour prendre en charge les deux, tu fais le pack deux fois.',
    ),
  ],
  quick: {
    title: 'Réponse rapide : les packs de textures Java marchent sur Bedrock ?',
    items: [
      'Non. Bedrock ne peut pas charger un .zip Java, et le renommer en .mcpack n’aide pas.',
      'Les deux éditions utilisent des dossiers, des noms de fichiers et des fichiers de description différents.',
      'Tu peux convertir un pack en déplaçant et renommant ses images et en ajoutant un manifest.json, ou le refaire dans un projet Bedrock.',
    ],
  },
  sections: [
    {
      id: 'compare',
      title: 'Côte à côte',
      body: [
        table(
          ['', 'Java Edition', 'Bedrock Edition'],
          [
            ['Fichier', [code('.zip'), ' (ou un dossier)'], [code('.mcpack'), ' (un zip renommé)']],
            ['Fichier de description', [code('pack.mcmeta')], [code('manifest.json'), ' avec deux UUID et un numéro de version']],
            ['Version visée', ['Un numéro de pack format, par ex. ', F(LATEST), ' pour la ', LATEST], ['Une version minimale du moteur, par ex. ', code(MIN_ENGINE)]],
            ['Exemple de chemin de texture', [code('assets/minecraft/textures/block/stone.png')], [code('textures/blocks/stone.png')]],
            ['Formats d’image', 'PNG', 'PNG ou TGA (garde l’extension du fichier vanilla)'],
            ['Icône', [code('pack.png')], [code('pack_icon.png')]],
            ['Installation', ['À déposer dans le dossier ', code('resourcepacks')], 'Ouvre le fichier ; Minecraft l’importe'],
            ['Shaders', 'Packs de shaders Iris / OptiFine, ou packs de ressources de shaders vanilla (1.17+)', 'Pas de code de shader perso ; des packs de réglages Graphismes éclatants'],
            ['Skins', 'Un PNG mis en ligne dans le launcher ou sur minecraft.net', `Un pack de skins (.mcpack) ou un PNG importé dans le ${BEDROCK.dressingRoom}`],
            ['Consoles', 'Sans objet', 'Impossible d’importer des fichiers ; utilise un monde, un Realm ou un serveur qui a le pack'],
          ],
        ),
      ],
    },
    {
      id: 'textures',
      title: 'Les différences de textures à surveiller',
      body: [
        ul([
          'Les noms de fichiers diffèrent entre les éditions, par exemple block/grass_block_top.png sur Java et blocks/grass_top.png sur Bedrock.',
          'Beaucoup de textures Bedrock utilisent leurs pixels transparents pour stocker des masques de teinte ou de teinture : les éditeurs ne doivent donc jamais jeter la couleur des pixels invisibles. Le Texture Pack Maker garde les pixels exacts.',
          'Java peut mélanger plusieurs versions dans un pack avec une plage de compatibilité ; les packs Bedrock déclarent une seule version minimale.',
        ]),
      ],
    },
    {
      id: 'convert',
      title: 'Peut-on convertir un pack de textures Java en Bedrock ?',
      body: [
        p('Oui, mais pas en renommant le fichier. Convertir, c’est reconstruire le pack avec l’organisation de Bedrock :'),
        steps([
          ['Copie les images de ', code('assets/minecraft/textures/'), ' dans les dossiers ', code('textures/'), ' de Bedrock (', code('block'), ' → ', code('blocks'), ', ', code('item'), ' → ', code('items'), ').'],
          ['Renomme les fichiers dont les noms diffèrent, par exemple ', code('grass_block_top.png'), ' → ', code('grass_top.png'), '. Les textures sans équivalent sur Bedrock sont ignorées.'],
          ['Écris un ', code('manifest.json'), ' avec deux nouveaux UUID, une version et un ', code('min_engine_version'), ', et renomme ', code('pack.png'), ' en ', code('pack_icon.png'), '.'],
          ['Vérifie les cas particuliers : les animations de Bedrock sont listées dans ', code('textures/flipbook_textures.json'), ' au lieu de fichiers ', code('.png.mcmeta'), ', et certaines textures sont des fichiers ', code('.tga'), ' qui stockent des masques de teinte dans leurs pixels transparents.'],
          ['Compresse le contenu et renomme le zip en ', code('.mcpack'), '.'],
        ]),
        p(
          'La référence de Mojang elle-même est ',
          el('span', { lang: 'en' }, ext('https://learn.microsoft.com/en-us/minecraft/creator/documents/convertingtexturepacks', 'Converting Texture Packs from Java Edition to Bedrock Edition')),
          ' (en anglais). Le chemin rapide, c’est le ',
          link('/texture-pack-converter', 'convertisseur de packs de textures'),
          ' : il déplace et renomme chaque texture, transforme les animations en entrées de flipbook, écrit le manifeste et liste tout ce qu’il n’a pas pu convertir.',
        ),
      ],
    },
    {
      id: 'mcpack',
      title: 'Un .mcpack, c’est juste un fichier zip ?',
      body: [
        p(
          'Oui. Un ',
          code('.mcpack'),
          ' est un zip ordinaire avec une autre extension, pour que Bedrock sache qu’il doit l’importer. Renomme-le en ',
          code('.zip'),
          ' pour regarder dedans. Ce qui en fait un pack Bedrock, c’est son contenu : ',
          code('manifest.json'),
          ' à la racine et l’organisation des dossiers de Bedrock. Les fichiers ',
          code('.mcaddon'),
          ' regroupent plusieurs packs, et les fichiers ',
          code('.mcworld'),
          ' contiennent un monde entier.',
        ),
      ],
    },
    {
      id: 'both',
      title: 'Faire un pack pour les deux',
      body: [
        steps([
          ['Crée un projet Java dans le ', link('/textures', 'Texture Pack Maker'), ' et peins tes textures.'],
          'Crée un projet Bedrock et repeins (ou importe) les mêmes textures ; la liste des fichiers est celle de Bedrock.',
          'Exporte chacun et partage les deux fichiers.',
        ]),
      ],
    },
  ],
  faq: [
    { id: 'convert', q: 'Je peux convertir un pack Java en Bedrock ?', a: [p('Pas en renommant le fichier. Les dossiers, les noms et le fichier de description diffèrent, donc les images doivent être déplacées, renommées et recevoir un manifest.json. Le ', link('/texture-pack-converter', 'convertisseur de packs de textures'), ' le fait pour toi.')] },
    { id: 'back', q: 'Je peux convertir un pack Bedrock en Java ?', a: [p('De la même façon, à l’envers : déplace les images dans ', code('assets/minecraft/textures/'), ', renomme-les avec les noms de Java, convertis les fichiers .tga en PNG et ajoute un ', code('pack.mcmeta'), '.')] },
    { id: 'missing', q: 'Pourquoi certaines textures manquent après la conversion ?', a: [p('Chaque édition a des textures que l’autre n’a pas, et certaines sont découpées ou regroupées différemment (par exemple les coffres, les tableaux et l’interface). Celles-là doivent être repeintes pour l’autre édition.')] },
    { id: 'which', q: 'À quelle édition je joue ?', a: [p('Si tu joues sur console, téléphone ou tablette, ou si tu as eu Minecraft sur le Microsoft Store sous le nom « Minecraft for Windows », c’est Bedrock. Java tourne sur Windows, macOS et Linux avec le Minecraft Launcher.')] },
  ],
  ctaLabel: 'Ouvrir le Texture Pack Maker',
};

const convertJavaToBedrock: GuideText = {
  image: SHOTS.convertResult,
  intro: [
    p(
      'Un pack de textures Java ne marche pas sur Bedrock, et renommer le ',
      code('.zip'),
      ' en ',
      code('.mcpack'),
      ' n’aide pas : les deux éditions utilisent des dossiers, des noms de fichiers et des fichiers de description différents. Pour convertir un pack, chaque texture doit être déplacée dans le dossier de Bedrock, renommée avec le nom de fichier de Bedrock et recevoir un ',
      code('manifest.json'),
      '. Le ',
      link('/texture-pack-converter', 'convertisseur de packs de textures'),
      ' gratuit le fait dans ton navigateur en quelques secondes, et marche aussi dans l’autre sens.',
    ),
  ],
  quick: {
    title: 'En bref',
    items: [
      ['Ouvre le ', link('/texture-pack-converter', 'convertisseur de packs de textures'), ' et choisis ton ', code('.zip'), ' Java.'],
      ['Choisis ', strong('Bedrock Edition'), ' et clique sur ', strong('Convert to Bedrock'), '.'],
      ['Télécharge le ', code('.mcpack'), ' et ouvre-le : Minecraft l’importe.'],
    ],
  },
  howto: { name: 'Comment convertir un pack de textures Java en Bedrock', steps: CONVERT_STEPS },
  sections: [
    { id: 'steps', title: 'Pas à pas', body: [steps(CONVERT_STEPS), figure(SHOTS.convertPack), figure(SHOTS.convertResult)] },
    {
      id: 'what',
      title: 'Ce qui est converti, et ce qui ne l’est pas',
      body: [
        p('Le convertisseur sait quelle texture Java joue le même rôle que quelle texture Bedrock, d’après les fichiers du jeu des deux éditions. La plupart des textures ont la même image dans les deux, donc elles peuvent être copiées telles quelles.'),
        table(
          ['Converti', 'Pas converti'],
          [
            ['La plupart des textures de blocs et d’objets (environ quatre sur cinq)', 'Les textures qui n’existent que dans une seule édition'],
            ['Beaucoup de textures de créatures et d’environnement (soleil, lune, nuages)', 'Les textures organisées autrement : coffres, beaucoup de skins de créatures, bannières, menus et particules'],
            ['Les textures animées : .png.mcmeta devient une entrée de flipbook', 'Les modèles, les sons, les polices, les messages d’accueil et les shaders'],
            ['L’icône, le nom et la description du pack', 'Les extras d’OptiFine comme les textures connectées et les textures d’objets perso'],
          ],
        ),
        p('Tout ce qui est ignoré est listé dans le rapport avec la raison, pour que tu saches exactement quoi repeindre. Ouvre le pack converti dans le ', link('/textures', 'Texture Pack Maker'), ' pour corriger ces textures sur leurs modèles 3D avant de le télécharger.'),
        callout('tip', 'Un même pack, deux éditions', `Garde ton pack Java comme original et convertis-le à nouveau après chaque changement. Avant d’importer la nouvelle version sur Bedrock, supprime l’ancienne dans ${BEDROCK.settings} › ${BEDROCK.storage} pour ne pas te retrouver avec deux copies.`),
      ],
    },
    {
      id: 'bedrock-to-java',
      title: 'Convertir un pack Bedrock en Java',
      body: [
        p(
          'Choisis un ',
          code('.mcpack'),
          ' Bedrock (ou un ',
          code('.mcaddon'),
          ') et choisis ',
          strong('Java Edition'),
          ' et la version à laquelle tu joues. Les textures vont dans les dossiers et les noms de Java, les images ',
          code('.tga'),
          ' deviennent des PNG, les animations en flipbook deviennent des fichiers ',
          code('.png.mcmeta'),
          ' et le pack reçoit le bon ',
          code('pack.mcmeta'),
          ' pour cette version.',
        ),
      ],
    },
    {
      id: 'old-java',
      title: 'Mettre à jour un vieux pack Java vers une nouvelle version',
      body: [
        p(
          'Le même convertisseur met à jour les packs Java d’une version à l’autre. Beaucoup de textures ont été renommées au fil des années, surtout dans la 1.13, quand ',
          code('textures/blocks'),
          ' est devenu ',
          code('textures/block'),
          ' et que des centaines de fichiers ont changé de nom. Choisis le vieux pack, choisis ',
          strong('Java'),
          ' et ta version, et chaque texture renommée prend son nouveau nom. Les noms de textures dans les modèles du pack sont mis à jour aussi.',
        ),
        p(`Ça marche aussi à l’envers, par exemple pour faire d’un pack ${LATEST} un pack pour la 1.8.9.`),
      ],
    },
    {
      id: 'install',
      title: 'Installer le pack converti',
      body: [
        ul([
          ['Bedrock : ouvre le ', code('.mcpack'), ' (double-clic sur Windows, Ouvrir avec Minecraft sur téléphone), puis active-le dans ', uiPath(BEDROCK.settings, BEDROCK.globalResources), '.'],
          ['Java : mets le ', code('.zip'), ' dans le dossier ', code('resourcepacks'), ` et passe-le dans « ${JAVA.selected} ».`],
        ]),
        p('Plus de détails dans ', link('/guides/install-resource-packs', 'Comment installer des packs de textures'), '. Si quelque chose ne va pas, regarde ', link('/guides/texture-pack-not-working', 'Pack de textures qui ne marche pas'), '.'),
      ],
    },
  ],
  faq: [
    { id: 'free', q: 'Le convertisseur est gratuit ?', a: [p('Oui, sans compte et sans limites. Le pack est converti dans ton navigateur et n’est jamais envoyé.')] },
    { id: 'look', q: 'Le pack aura le même aspect sur Bedrock ?', a: [p('Les textures converties ont le même aspect. Les textures ignorées reprennent celles de Bedrock, et l’éclairage de Bedrock et les Graphismes éclatants peuvent faire paraître les couleurs un peu différentes.')] },
    { id: 'shaders', q: 'Je peux convertir un pack de shaders Java en Bedrock ?', a: [p('Non. Bedrock ne charge pas de code de shader perso. Utilise plutôt un pack ', link('/guides/bedrock-vibrant-visuals-settings', 'Graphismes éclatants'), ', que tu peux faire avec le ', link('/shaders', 'Shader Maker'), '.')] },
    { id: 'png', q: 'Je peux transformer des fichiers PNG en .mcpack ?', a: [p('Oui. Choisis un PNG, ou un zip de PNG, nommés comme les textures du jeu (par exemple ', code('stone.png'), '), et convertis-le pour Bedrock.')] },
    { id: 'console', q: 'Je peux utiliser le pack converti sur console ?', a: [p('Les consoles ne peuvent pas importer de fichiers. Ajoute le pack à un monde sur un PC ou un téléphone et rejoins ce monde, ou utilise un Realm ou un serveur qui l’a.')] },
  ],
  ctaLabel: 'Ouvrir le convertisseur de packs de textures',
};

const mergePacks: GuideText = {
  image: SHOTS.mergeResult,
  intro: [
    p(
      'Minecraft sait déjà empiler les packs de textures : actives-en plusieurs, et celui qui est le plus haut dans la liste gagne partout où deux packs changent la même texture. Fusionner, c’est construire un seul pack à partir de plusieurs, avec ce même ordre intégré. C’est pratique pour un serveur ou un Realm qui n’accepte qu’un pack, pour partager ta combinaison préférée, ou pour garder une liste de packs courte. L’outil gratuit ',
      link('/merge-texture-packs', 'Merge Texture Packs'),
      ' le fait dans ton navigateur.',
    ),
  ],
  quick: {
    title: 'En bref',
    items: [
      ['Ouvre ', link('/merge-texture-packs', 'Merge Texture Packs'), ' et ajoute de deux à huit packs de la même édition.'],
      'Fais-les glisser dans l’ordre : le pack du haut gagne chaque conflit.',
      'Clique sur Merge, vérifie la liste des conflits, puis télécharge le pack.',
    ],
  },
  howto: { name: 'Comment fusionner des packs de textures Minecraft', steps: MERGE_STEPS },
  sections: [
    { id: 'steps', title: 'Pas à pas', body: [steps(MERGE_STEPS), figure(SHOTS.mergeSettings), figure(SHOTS.mergeResult)] },
    {
      id: 'wins',
      title: 'Quel pack gagne ?',
      body: [
        p('La même règle que celle de Minecraft : pour chaque fichier, le pack le plus haut dans la liste gagne. Une texture et son fichier d’animation voyagent toujours ensemble, donc l’animation d’un pack plus bas n’est jamais collée à l’image d’un pack plus haut.'),
        p('Certains fichiers sont combinés au lieu d’être remplacés, pour que rien d’utile ne soit perdu :'),
        ul([
          [strong('Java : '), 'les fichiers de langue (clé par clé), ', code('sounds.json'), ' (son par son), les atlas de textures et les polices.'],
          [strong('Bedrock : '), code('terrain_texture.json'), ', ', code('item_texture.json'), ', ', code('flipbook_textures.json'), ', ', code('blocks.json'), ', les définitions de sons et les fichiers de langue.'],
        ]),
        p('Le résultat liste chaque conflit, comme « block/stone.png du pack A, qui remplace le pack B », et combien de fichiers chaque pack a ajoutés.'),
      ],
    },
    {
      id: 'versions',
      title: 'Des packs pour des versions différentes',
      body: [
        p(
          'Les packs Java faits pour des versions différentes peuvent être fusionnés : choisis la version à laquelle tu joues et les packs plus anciens reçoivent d’abord ses noms de textures (les mêmes renommages que ceux du ',
          link('/texture-pack-converter', 'convertisseur'),
          `), donc un pack 1.12 et un pack ${LATEST} vont ensemble. Les packs Java et Bedrock ne peuvent pas être fusionnés directement : convertis d’abord l’un des deux.`,
        ),
      ],
    },
    {
      id: 'by-hand',
      title: 'Fusionner des packs à la main',
      body: [
        steps([
          'Décompresse chaque pack dans son propre dossier.',
          'Crée un nouveau dossier et copies-y d’abord le pack le moins prioritaire, puis chaque pack plus haut par-dessus, en remplaçant les fichiers quand on te le demande.',
          ['Fusionne à la main les fichiers qui doivent être combinés (', code('sounds.json'), ', fichiers de langue, atlas), sinon c’est la dernière copie qui gagne.'],
          ['Garde un seul ', code('pack.mcmeta'), ' (Java) ou écris un nouveau ', code('manifest.json'), ' avec de nouveaux identifiants (Bedrock), puis compresse le contenu.'],
        ]),
        p('L’outil fait tout ça, y compris les fichiers combinés et le bon pack format : fusionner à la main ne vaut donc le coup que pour des packs inhabituels.'),
      ],
    },
  ],
  faq: [
    { id: 'how-many', q: 'Combien de packs je peux fusionner ?', a: [p('De deux à huit à la fois. Pour en combiner plus, fusionne à nouveau le résultat avec les packs suivants.')] },
    { id: 'shaders', q: 'Je peux fusionner des packs de shaders ?', a: [p('Non. Les packs de shaders Iris et OptiFine ne tournent qu’un à la fois. Les packs de ressources de shaders vanilla peuvent être fusionnés comme n’importe quel pack de ressources, mais deux packs qui changent le même fichier de shader ne combineront pas leurs effets.')] },
    { id: 'server', q: 'Je peux utiliser un pack fusionné comme pack de ressources de serveur ?', a: [p('Oui. Mets le ', code('.zip'), ' fusionné en ligne là où tu héberges les packs du serveur et indique-le dans ', code('server.properties'), ' comme n’importe quel autre pack.')] },
    { id: 'upload', q: 'Mes packs sont-ils envoyés quelque part ?', a: [p('Non. Les packs sont fusionnés dans ton navigateur et restent sur ton appareil.')] },
  ],
  ctaLabel: 'Ouvrir Merge Texture Packs',
};

const make3dItems: GuideText = {
  image: SHOTS.model3dSword,
  intro: [
    p(
      'La forme d’un bloc ou d’un objet dans Minecraft Java Edition vient de son ',
      strong('modèle'),
      ' : un petit fichier JSON de cubes dans le pack de ressources. Mets un nouveau modèle dans ton pack de textures et la forme change, sans mods et sans OptiFine : une épée plate devient une épée en 3D, un bloc devient une dalle ou une marche. Le ',
      link('/textures', 'Texture Pack Maker'),
      ' a un éditeur de modèles qui fait ça dans ton navigateur. Il transforme le sprite plat d’un objet en cubes 3D en un clic, te laisse changer chaque cube et écrit les fichiers dont ta version du jeu a besoin. Bedrock fonctionne autrement, comme expliqué plus bas.',
    ),
  ],
  quick: {
    title: 'En bref',
    items: [
      ['Dans le Texture Pack Maker, affiche l’objet dans l’onglet ', strong('Preview'), ' et appuie sur ', strong('Edit shape'), '.'],
      ['Choisis ', strong('3D item from sprite'), ', puis affine les cubes et la façon dont l’objet est tenu.'],
      ['Exporte le pack. Il contient le modèle dans ', code('models/item/'), ' et, en 1.21.4 et plus récent, une définition d’objet dans ', code('items/'), ' quand il en faut une.'],
    ],
  },
  howto: { name: 'Comment faire un objet 3D dans un pack de textures Minecraft', steps: MODEL_STEPS },
  sections: [
    {
      id: 'what',
      title: 'Ce qu’est un modèle Minecraft',
      body: [
        p('Java Edition 1.8 et plus récent dessine la plupart des blocs et des objets à partir de fichiers de modèles dans le pack de ressources :'),
        ul([
          [code('assets/minecraft/models/block/'), ' contient les modèles de blocs, comme ', code('oak_slab.json'), '. Un fichier d’', strong('états de bloc'), ' (blockstate) dans ', code('blockstates/'), ' dit quel modèle un bloc utilise dans chaque état : une dalle en bas ou en haut, une bûche couchée.'],
          [code('assets/minecraft/models/item/'), ' contient les modèles d’objets. La plupart des objets utilisent un modèle plat (', code('item/generated'), ') : le jeu transforme lui-même le sprite 16×16 en forme fine. Depuis la 1.21.4, une ', strong('définition de modèle d’objet'), ' dans ', code('assets/minecraft/items/'), ' dit quel modèle un objet affiche.'],
        ]),
        p('Un fichier de modèle a quatre parties principales :'),
        ul([
          [code('textures'), ' : des noms pour les textures que le modèle utilise, comme ', code('"oak_planks": "minecraft:block/oak_planks"'), '. ', code('particle'), ' est la texture des particules quand le bloc se casse.'],
          [code('elements'), ' : les cubes. Chacun va ', code('from'), ' (de) un coin ', code('to'), ' (à) le coin opposé, mesurés en pixels d’un bloc de 16 × 16 × 16, et peut aller de -16 à 32 sur chaque axe. Un cube peut être tourné avec ', code('rotation'), '.'],
          [code('faces'), ' : pour chaque côté d’un cube (', code('down'), ', ', code('up'), ', ', code('north'), ', ', code('south'), ', ', code('west'), ', ', code('east'), '), la texture qu’il montre, la partie de la texture (', code('uv'), '), et ', code('cullface'), ', qui saute la face quand un bloc plein couvre ce côté.'],
          [code('display'), ' : comment le modèle est tourné, déplacé et mis à l’échelle dans l’inventaire (', code('gui'), '), dans les mains, au sol, dans un cadre (', code('fixed'), ') et sur la tête.'],
        ]),
        p('Voici un modèle d’un seul cube en forme de dalle, écrit comme l’éditeur de modèles l’écrit. Un fichier fait dans l’éditeur liste l’affichage de chaque emplacement, pas seulement celui de l’inventaire :'),
        pre(MODEL_BLOCK_EXAMPLE.trimEnd()),
        p(
          'Les modèles faits à la main utilisent souvent ',
          code('"parent"'),
          ' pour emprunter les textures, les cubes ou l’affichage d’un autre modèle. L’éditeur de modèles écrit plutôt des fichiers autonomes : tout ce qu’il a lu dans les modèles parents est recopié, donc ton fichier ne dépend d’aucun autre.',
        ),
        callout('tip', 'Les coordonnées sont des pixels', 'Un bloc fait 16 unités sur chaque axe, donc 8 c’est un demi-bloc. L’éditeur de modèles s’aligne sur cette grille, ou sur ½ ou ¼ de pixel, et affiche les tailles comme « 16 = one block ».'),
      ],
    },
    {
      id: 'steps',
      title: 'Faire un objet 3D pas à pas',
      body: [steps(MODEL_STEPS), figure(SHOTS.modelEditShape), figure(SHOTS.modelSpriteStart), figure(SHOTS.model3dSword)],
    },
    {
      id: 'sprite',
      title: 'Comment marche « 3D item from sprite »',
      body: [
        p(
          'Un objet plat est une seule image, son sprite, en général de 16×16 pixels. Ce point de départ prend chaque pixel qui n’est pas transparent et en fait des cubes d’un pixel d’épaisseur, centrés comme le jeu centre ses propres objets plats (de 7,5 à 8,5 sur l’axe z). Les pixels d’une même ligne sont réunis en un long cube, et les lignes identiques les unes sous les autres en un rectangle : l’épée en diamant devient donc 19 cubes au lieu d’un cube par pixel. Les faces complètement cachées par un pixel voisin sont laissées de côté.',
        ),
        p('Chaque face montre les pixels correspondants du sprite. Trois pixels à la suite, dans les colonnes 5 à 7 de la ligne 3, deviennent ce cube :'),
        pre(MODEL_SPRITE_CUBE.trimEnd()),
        p(
          'L’avant (',
          code('south'),
          ') montre les pixels tels quels et l’arrière (',
          code('north'),
          ') les montre en miroir, comme quand tu regardes une image de derrière. Les cubes continuent d’utiliser la texture de l’objet (',
          code('#layer0'),
          '), donc repeindre le sprite recolore l’objet 3D. Les pixels que tu ajoutes ou effaces ne changent la forme que si tu choisis à nouveau ',
          strong('3D item from sprite'),
          '. Les objets à plusieurs couches, comme les potions ou l’armure en cuir, reçoivent des cubes pour chaque couche, et le jeu les colore toujours.',
        ),
        p('Ensuite, personnalise-le :'),
        ul([
          'Rends la lame plus épaisse : sélectionne ses cubes et change leur position Z et leur taille, par exemple de 7,5 et 1 à 7 et 2.',
          ['Ajoute un cube pour une garde ou une gemme avec le bouton ', strong('+'), ' (ou N), et donne à ses faces une autre texture dans ', uiPath('Faces', 'Change'), '.'],
          ['Tourne un cube dans ', strong('Rotation'), '. Avant Minecraft 1.21.6, un cube ne tourne que sur un axe, de -45°, -22,5°, 0°, 22,5° ou 45° ; l’éditeur propose ce que ta version accepte.'],
          'Annule n’importe quel changement avec Ctrl+Z.',
        ]),
      ],
    },
    {
      id: 'display',
      title: 'Régler la façon dont il est tenu : Display',
      body: [
        p(
          'L’onglet ',
          strong('Display'),
          ' montre le modèle à six endroits. Chacun a une rotation en degrés, une position en pixels (jusqu’à ±80) et une taille (1 est normal, 4 au maximum).',
        ),
        table(
          ['Dans l’éditeur', 'Où il s’affiche', 'Nom dans le fichier'],
          [
            ['Inventory', 'Inventaire et barre d’action', code('gui')],
            ['First person', 'Dans ta propre main', [code('firstperson_righthand'), ' (la main gauche est une image miroir)']],
            ['Third person', 'Dans la main d’un joueur que tu regardes, ou en vue F5', code('thirdperson_righthand')],
            ['Ground', 'Jeté au sol', code('ground')],
            ['Item frame', 'Dans un cadre', code('fixed')],
            ['Head', 'Porté sur la tête', code('head')],
          ],
        ),
        p(
          strong('3D item from sprite'),
          ' garde les réglages d’affichage de l’objet, donc une épée 3D est tenue comme la plate. ',
          strong('Game’s default'),
          ' remet un emplacement aux valeurs du jeu, et ',
          strong('No change'),
          ' supprime le réglage. Java 1.21.9 a ajouté un emplacement ',
          code('on_shelf'),
          ' pour les étagères ; l’éditeur garde la valeur du modèle du jeu.',
        ),
        figure(SHOTS.modelDisplay),
      ],
    },
    {
      id: 'flat',
      title: 'Garder l’icône plate dans l’inventaire (1.21.4+)',
      body: [
        p(
          'Beaucoup de packs 3D gardent l’icône plate habituelle dans l’inventaire et ne montrent le modèle 3D qu’en main. Depuis Java 1.21.4, une définition de modèle d’objet peut choisir un modèle selon l’endroit où l’objet s’affiche. Active ',
          strong('Flat in the inventory'),
          ' dans l’onglet ',
          strong('Model'),
          ' et l’éditeur :',
        ),
        ul([
          ['enregistre ta forme comme deuxième modèle, ', code('models/item/diamond_sword_3d.json'), ', et laisse le ', code('diamond_sword.json'), ' plat tel quel ;'],
          ['écrit ', code('items/diamond_sword.json'), ', qui montre le modèle plat dans l’inventaire (', code('gui'), '), au sol et dans les cadres (', code('fixed'), '), et le modèle 3D partout ailleurs :'],
        ]),
        pre(MODEL_FLAT_DEFINITION.trimEnd()),
        p('Les versions avant la 1.21.4 n’ont pas de définitions d’objets : un objet y montre le même modèle partout et l’option n’est pas proposée.'),
        figure(SHOTS.modelFlatInventory),
      ],
    },
    {
      id: 'blocks',
      title: 'Changer la forme d’un bloc',
      body: [
        p(
          'Les blocs marchent de la même façon. Affiche un bloc dans l’onglet Preview et appuie sur ',
          strong('Edit shape'),
          '. L’éditeur ouvre le modèle que le bloc utilise dans l’état que tu regardes, et le menu en haut liste ses autres modèles, comme les versions haute et double d’une dalle. Garde le modèle du jeu ou pars de ',
          strong('Full cube'),
          ', ',
          strong('Slab'),
          ', ',
          strong('Cross (plant)'),
          ' ou ',
          strong('Empty'),
          ', puis ajoute, déplace et redimensionne des cubes. Pour transformer la roche en marche, il suffit du point de départ Slab et d’un cube de plus :',
        ),
        figure(SHOTS.modelBlock),
        ul([
          [strong('Modèles partagés : '), 'certains blocs utilisent le même fichier de modèle. Quand un autre bloc utilise le modèle que tu modifies, l’éditeur te dit lequel ; il change aussi.'],
          [strong('Les objets restent à part : '), 'un objet qui montre un modèle de bloc, comme une dalle dans ta main, reçoit son propre modèle d’objet quand tu modifies l’objet, donc le bloc garde sa forme.'],
          [strong('Seule l’apparence change : '), 'la hitbox, les collisions et la lumière viennent du code du jeu. Un bloc de roche en forme de marche t’arrête toujours comme un bloc plein, et les blocs voisins cachent toujours les faces qui le touchent, ce qui peut laisser des trous transparents.'],
          [strong('Les blocs dessinés par le code : '), 'les coffres, les lits, les pancartes, les bannières et les autres blocs que le jeu dessine lui-même n’ont pas de modèle de bloc, donc Edit shape n’est pas proposé pour eux. Les objets dessinés par le code, comme le bouclier, peuvent recevoir un modèle, qui remplace cet aspect.'],
        ]),
        p(
          'La roche et quelques autres blocs choisissent au hasard entre deux modèles : la roche et une copie en miroir, chacune aussi retournée. ',
          strong('Use for every random variant'),
          ' dans l’onglet Model met ta forme sur toutes en écrivant le fichier d’états du bloc. L’entrée ',
          code('"y": 180'),
          ' garde la rotation au hasard, et ',
          code('weight'),
          ' règle la fréquence à laquelle chaque entrée est choisie :',
        ),
        pre(MODEL_STONE_BLOCKSTATE.trimEnd()),
      ],
    },
    {
      id: 'files',
      title: 'Quels fichiers vont dans le pack',
      body: [
        table(
          ['Ce que tu changes', 'Fichiers dans le pack'],
          [
            ['Un objet 3D', code(MODEL_FILES.sword.latest[0])],
            ['Un objet 3D, plat dans l’inventaire (1.21.4+)', [code(MODEL_FILES.swordFlat.latest[0]), ' et ', code(MODEL_FILES.swordFlat.latest[1])]],
            ['La forme d’un bloc', code(MODEL_FILES.slab.latest[0])],
            ['La forme d’un bloc sur chaque variante au hasard', [code(MODEL_FILES.stoneEvery.latest[0]), ' et ', code(MODEL_FILES.stoneEvery.latest[1])]],
          ],
        ),
        p(
          'Chaque chemin est dans ',
          code('assets/minecraft/'),
          '. Chaque version de Java depuis la 1.8 reçoit les mêmes fichiers ; seul « plat dans l’inventaire » a besoin de la 1.21.4 ou plus récent. L’éditeur n’ajoute une définition d’objet ou un fichier d’états de bloc que quand le jeu en a besoin, et les fichiers de modèles déjà présents dans un pack que tu ouvres sont gardés et peuvent être modifiés. À l’export, chaque modèle est vérifié pour ta version du jeu, et tu reçois un avertissement pour tout ce qui ne se chargerait pas.',
        ),
        h3('Ce qui a changé entre les versions'),
        table(
          ['Version', 'Ce qui a changé pour les modèles'],
          [
            ['1.8', 'Les modèles de blocs et d’objets sont devenus des fichiers JSON que les packs de ressources peuvent remplacer. Les cubes tournent sur un axe de -45°, -22,5°, 0°, 22,5° ou 45°.'],
            ['1.13', ['Les dossiers de textures ont été renommés de ', code('blocks'), ' et ', code('items'), ' en ', code('block'), ' et ', code('item'), ', donc les noms de textures dans les modèles ont changé aussi.']],
            ['1.15.2', [code('gui_light'), ' règle si l’icône de l’inventaire est éclairée de côté (blocs) ou de face (objets).']],
            ['1.19.3', ['Les textures des modèles doivent être dans un dossier que les atlas de textures du jeu lisent, comme ', code('textures/block/'), ' ou ', code('textures/item/'), '.']],
            ['1.21.4', ['Les définitions de modèles d’objets dans ', code('items/'), ' choisissent le modèle d’un objet, aussi selon l’endroit où il s’affiche.']],
            ['1.21.6', 'Les cubes peuvent tourner de n’importe quel angle entre -45° et 45°.'],
            ['1.21.9', ['Nouvel emplacement d’affichage ', code('on_shelf'), '.']],
            ['1.21.11', 'Les cubes peuvent tourner sur plusieurs axes à la fois, de n’importe quel angle.'],
          ],
        ),
        p('L’éditeur de modèles suit ces règles pour la version pour laquelle ton pack est fait.'),
      ],
    },
    {
      id: 'install',
      title: 'L’installer et le tester',
      body: [
        steps([
          ['Appuie sur ', strong('Done'), ' pour quitter l’éditeur de modèles, puis exporte le pack (', strong('Export'), ') en ', code('.zip'), '.'],
          ['Dans Minecraft, ouvre ', uiPath(JAVA.options, JAVA.packs, JAVA.openFolder), ', dépose le zip dedans (sans le décompresser) et passe le pack dans ', strong(JAVA.selected), ', au-dessus des autres packs.'],
          'Prends l’objet en main, appuie sur F5 pour la troisième personne, jette-le au sol et mets-le dans un cadre pour vérifier chaque affichage.',
          'Après avoir changé le modèle, exporte à nouveau, remplace le zip et appuie sur F3 + T dans le jeu pour recharger les packs.',
        ]),
        p('Plus d’aide : ', link('/guides/install-resource-packs', 'Comment installer des packs de ressources'), ' et ', link('/guides/texture-pack-not-working', 'Pack de textures qui ne marche pas'), '.'),
      ],
    },
    {
      id: 'bedrock',
      title: 'Bedrock Edition',
      body: [
        p('Les packs Bedrock marchent autrement, et l’éditeur de modèles ne fait que des modèles Java :'),
        ul([
          [strong('Blocs : '), 'un pack de ressources Bedrock ne peut pas changer la forme des blocs du jeu. Un bloc de forme perso est un nouveau bloc, ajouté par un add-on avec un pack de comportements et un fichier de géométrie.'],
          [strong('Objets en main : '), 'Bedrock donne aux objets un modèle 3D en main avec des attachables, des fichiers de pack de ressources qui utilisent la géométrie et les animations de Bedrock. Le Texture Pack Maker ne les fait pas ; ', ext('https://www.blockbench.net/', 'Blockbench'), ' oui.'],
          [strong('Un point de départ : '), 'dans le menu de l’éditeur de modèles, ', strong('Download as Bedrock geometry'), ' enregistre ton modèle dans un fichier ', code('.geo.json'), ' (format 1.12.0, un seul os, tous les cubes) à importer dans Blockbench ou un add-on. La géométrie Bedrock utilise une seule texture, donc chaque face garde sa place sur sa propre texture.'],
        ]),
        p('Dans un pack Bedrock, ', strong('Edit shape'), ' explique ça au lieu d’ouvrir l’éditeur. Peindre les textures marche comme d’habitude.'),
      ],
    },
    {
      id: 'problems',
      title: 'Problèmes courants',
      body: [
        ul([
          [strong('Des faces violettes et noires : '), 'une face utilise une texture que le jeu ne trouve pas : un nom (', code('#…'), ') qui n’est pas défini dans ', code('textures'), ', un fichier qui n’est ni dans le jeu ni dans le pack, ou, depuis la 1.19.3, une texture hors des dossiers d’atlas. L’onglet Model liste ces problèmes avec le cube concerné.'],
          [strong('Un cube violet et noir à la place du modèle : '), 'le fichier ne s’est pas chargé. Les causes habituelles sont un JSON cassé, un cube hors de -16 à 32, ou une rotation que la version n’autorise pas. Le journal du jeu donne le nom du fichier.'],
          [strong('Le modèle ne s’affiche pas du tout : '), 'vérifie que le pack est sélectionné et au-dessus des autres packs, que le fichier a exactement le nom et le dossier du modèle qu’il remplace, et, en 1.21.4 et plus récent, qu’un nouveau modèle (comme une copie ', code('_3d'), ') a une définition d’objet qui pointe vers lui.'],
          [strong('Bien en main, bizarre dans l’inventaire : '), ['règle l’affichage Inventory, essaie l’autre éclairage d’inventaire (de côté ou de face), ou active ', strong('Flat in the inventory'), '.']],
          [strong('Trop de cubes : '), 'chaque cube ajoute des faces à dessiner. Ça compte peu pour un objet dans ta main, mais un bloc posé des milliers de fois doit rester simple. Garde les cubes réunis que fait 3D item from sprite au lieu de les découper.'],
          [strong('Un angle n’est pas autorisé : '), 'avant la 1.21.6, un cube tourne par pas de 22,5° jusqu’à 45°, sur un seul axe. Pour un quart de tour, échange plutôt la taille du cube sur deux axes ; pour d’autres formes, construis-les avec plus de cubes.'],
        ]),
        p('D’autres solutions pour les packs en général : ', link('/guides/texture-pack-not-working', 'Ton pack de textures ne marche pas ? Solutions'), '.'),
      ],
    },
  ],
  faq: [
    {
      id: 'mods',
      q: 'Faut-il OptiFine ou un mod pour les objets 3D ?',
      a: [p('Non. Les packs de ressources Java peuvent remplacer les modèles de blocs et d’objets depuis la 1.8, donc un pack avec des fichiers de modèles marche dans le jeu normal. Il change chaque objet de ce type.')],
    },
    {
      id: 'renamed',
      q: 'Seul un objet renommé peut être en 3D ?',
      a: [
        p(
          'Pas avec un simple changement de modèle. Les packs qui ne changent que les objets renommés utilisent les textures d’objets perso (CIT) d’OptiFine ou un mod qui les lit. Depuis la 1.21.4, les définitions d’objets peuvent aussi choisir un modèle selon ',
          code('custom_model_data'),
          ', que les serveurs et les créateurs de cartes règlent avec des commandes. L’éditeur de modèles change chaque objet d’un type.',
        ),
      ],
    },
    {
      id: 'bedrock',
      q: 'Je peux faire des objets 3D sur Bedrock ?',
      a: [p('Oui, avec des attachables dans un pack de ressources Bedrock, faits dans un outil comme Blockbench. Cet éditeur de modèles fait des modèles Java, mais il peut télécharger un modèle en géométrie Bedrock pour partir de là. Les packs de ressources Bedrock ne peuvent pas changer la forme des blocs du jeu.')],
    },
    {
      id: 'blockbench',
      q: 'Je peux utiliser des modèles faits dans Blockbench ?',
      a: [p('Oui. Les modèles de blocs et d’objets Java exportés depuis Blockbench sont des fichiers de modèles ordinaires. Mets-les dans ton pack sous le nom du modèle qu’ils remplacent et ouvre le pack avec ', strong('Open a pack'), ' : les fichiers sont gardés, et l’éditeur de modèles peut les ouvrir et les changer.')],
    },
    {
      id: 'undo',
      q: 'Comment revenir à la forme d’origine ?',
      a: [p('Dans le menu de l’éditeur de modèles, choisis ', strong('Put back the original model'), '. Tes fichiers pour ce modèle sont retirés du pack et le modèle du jeu est à nouveau utilisé.')],
    },
    {
      id: 'phone',
      q: 'Je peux faire des objets 3D sur téléphone ?',
      a: [p('Oui. Sur un téléphone, la vue 3D est au-dessus des panneaux et tu travailles au toucher. Le pack doit quand même être un pack Java, donc tu y joues sur un ordinateur.')],
    },
  ],
  ctaLabel: 'Ouvrir le Texture Pack Maker',
};

const pvpPack: GuideText = {
  image: SHOTS.pvpTweaks,
  intro: [
    p(
      'Un pack de textures PvP change ce qui te gêne pendant un combat : le feu qui couvre la moitié de l’écran quand tu brûles, le verre à travers lequel tu ne vois rien, la vue sombre de la citrouille, un gros viseur et une épée qui cache le joueur que tu frappes. Les packs FPS vont plus loin et rendent les textures plus petites et immobiles, pour que les ordinateurs moins puissants suivent. Tout ça, ce sont des fichiers de pack de ressources ordinaires, sans mods. Le ',
      link('/textures', 'Texture Pack Maker'),
      ' les fait dans ton navigateur avec un interrupteur pour chacun, pour Java 1.8.9 (la version autour de laquelle beaucoup de serveurs PvP sont construits) jusqu’à la ',
      LATEST,
      ', et en partie pour Bedrock.',
    ),
  ],
  quick: {
    title: 'En bref',
    items: [
      ['Dans le Texture Pack Maker, choisis ', strong('PvP / FPS pack'), ' et la version de Minecraft à laquelle tu joues, puis ', strong('Create PvP pack'), '.'],
      ['Dans l’onglet ', strong('PvP'), ', choisis la hauteur du feu, le viseur, la taille des épées et les options FPS que tu veux.'],
      ['Exporte le pack et sélectionne-le dans Minecraft au-dessus de tes autres packs.'],
    ],
  },
  howto: { name: 'Comment faire un pack de textures PvP avec Texture Pack Maker', steps: PVP_STEPS },
  sections: [
    {
      id: 'what',
      title: 'Ce qu’un pack PvP change',
      body: [
        p('La plupart des packs PvP et FPS, des packs Bedwars aux packs « FPS boost », sont un mélange des mêmes quelques changements. Chacun ci-dessous est un interrupteur dans l’onglet PvP de l’éditeur :'),
        table(
          ['Changement', 'Ce qu’il fait', 'Java', 'Bedrock'],
          [
            ['Feu bas', 'Les flammes sur ton écran quand tu brûles sont plus basses.', 'Toutes les versions', 'Non'],
            ['Verre transparent', 'Le verre, le verre teinté et les vitres sont transparents à l’intérieur et gardent leur bordure.', 'Toutes les versions', 'Oui'],
            ['Sans le flou de la citrouille', 'Une citrouille sculptée sur ta tête n’assombrit plus l’écran.', 'Toutes les versions', 'Oui'],
            ['Viseur perso', 'Un viseur plus petit : un point, une petite croix, une croix avec un trou, un cercle ou un X, ou un que tu dessines.', 'Toutes les versions', 'Oui'],
            ['Épées plus petites', 'Les épées, ou toutes les armes, ont l’air plus petites et plus basses à la première personne.', '1.8 et plus récent', 'Non'],
            ['Bouclier plus bas', 'Le bouclier est plus bas à la première personne, aussi quand tu te protèges.', '1.9 et plus récent', 'Non'],
            ['Textures 8×', 'Les blocs (et les objets) en 8 × 8 pixels.', 'Toutes les versions', 'Oui'],
            ['Sans animations', 'L’eau, la lave, le feu et les portails restent immobiles.', 'Toutes les versions', 'Non'],
          ],
        ),
        p('Chaque interrupteur écrit des fichiers de pack normaux, donc tu peux toujours peindre par-dessus. En désactiver un remet les fichiers qu’il a changés, sauf ceux que tu as peints ou modifiés depuis. Le tableau à la fin liste les fichiers exacts pour chaque version.'),
      ],
    },
    {
      id: 'steps',
      title: 'Faire un pack PvP pas à pas',
      body: [steps(PVP_STEPS), figure(SHOTS.pvpStart), figure(SHOTS.pvpTweaks)],
    },
    {
      id: 'fire',
      title: 'Feu bas',
      body: [
        p(
          'Java dessine le feu sur l’écran avec une seule texture : ',
          code('textures/block/fire_1.png'),
          ' (',
          code('textures/blocks/fire_layer_1.png'),
          ' avant la 1.13). C’est une bande animée de 32 images, et Low fire descend les flammes de chaque image de 5, 8 ou 11 pixels sur 16 (',
          strong('Low'),
          ', ',
          strong('Lower'),
          ', ',
          strong('Lowest'),
          '), pour que le haut de ton écran reste dégagé. L’animation continue de tourner.',
        ),
        p(
          'Les blocs de feu utilisent la même texture, donc un simple pack de feu bas donne aussi l’impression que le feu dans le monde est coupé. Avec ',
          enLabel('Keep fire blocks as they are'),
          ' (Java 1.8 et plus récent), le pack reçoit une copie de la texture d’origine, ',
          code('fire_1_world.png'),
          ', et les modèles des blocs de feu pointent vers elle. Les joueurs et les créatures en feu montrent toujours les flammes plus basses.',
        ),
      ],
    },
    {
      id: 'glass',
      title: 'Verre transparent et sans le flou de la citrouille',
      body: [
        p(
          'Clear glass garde l’anneau de pixels extérieur, un pixel en 16× et deux en 32×, et rend tout l’intérieur transparent. Ça concerne ',
          code('glass.png'),
          ' et les 16 textures de verre teinté (',
          code('red_stained_glass.png'),
          ', etc. ; avant la 1.13 ',
          code('glass_red.png'),
          ', avec ',
          code('glass_silver.png'),
          ' pour le gris clair). Les vitres utilisent les mêmes textures, donc elles deviennent transparentes aussi. Choisis ',
          strong('Light tint'),
          ' pour garder une légère couleur dans le verre teinté, pour que les équipes puissent toujours distinguer les couleurs.',
        ),
        p('No pumpkin blur remplace ', code('textures/misc/pumpkinblur.png'), ', l’image que le jeu pose sur ta vue quand tu portes une citrouille sculptée, par une image complètement transparente de la même taille. Sur Bedrock, le fichier est aussi ', code('textures/misc/pumpkinblur.png'), '.'),
      ],
    },
    {
      id: 'crosshair',
      title: 'Viseur perso',
      body: [
        p('L’endroit où se trouve le viseur dépend de la version :'),
        ul([
          [strong('Java 1.20.1 et avant, et Bedrock : '), 'le carré de 16 × 16 en haut à gauche de ', code('textures/gui/icons.png'), ', une planche qui contient aussi les icônes des cœurs, de la faim et de l’armure. Seul ce carré change.'],
          [strong('Java 1.20.2 et plus récent : '), 'son propre fichier de 15 × 15, ', code('textures/gui/sprites/hud/crosshair.png'), '.'],
        ]),
        p(
          'Choisis l’un des cinq dessins faits pour l’éditeur, ou appuie sur ',
          strong('Draw your own'),
          ' : l’éditeur ouvre la texture du viseur et, sur une planche, sélectionne le carré du viseur pour toi. Java dessine le viseur en inversant ce qu’il y a derrière, donc peins-le en blanc ou en gris ; les autres couleurs sortent changées. Le jeu le centre sur le pixel du milieu, (7, 7).',
        ),
        figure(SHOTS.pvpCrosshair),
      ],
    },
    {
      id: 'swords',
      title: 'Des épées plus petites et un bouclier plus bas',
      body: [
        p(
          'La façon dont un objet est tenu en main vient de la partie ',
          code('display'),
          ' de son fichier de modèle : une rotation, une position et une taille pour chaque endroit où il s’affiche. Smaller swords ne règle que les emplacements à la première personne, à 80, 65 ou 50 % de la taille et un peu plus bas, pour que la poignée reste près de ta main. Les autres joueurs, la troisième personne et l’inventaire montrent toujours l’épée normale. ',
          strong('All weapons'),
          ' fait la même chose pour les haches, la masse et les lances, quand ta version les a.',
        ),
        p('Java 1.8 a un seul emplacement, ', code('firstperson'), ', dans le fichier de chaque épée. Voici l’épée en diamant en ', strong('Smaller'), ' :'),
        pre(PVP_SWORD_189.trimEnd()),
        p(
          'Depuis la 1.9, il y a deux emplacements, ',
          code('firstperson_righthand'),
          ' et ',
          code('firstperson_lefthand'),
          ', et les épées les empruntent à ',
          code('item/handheld'),
          '. Le fichier garde son parent, donc l’épée reste un objet plat, et reçoit les deux emplacements :',
        ),
        pre(PVP_SWORD_LATEST.trimEnd()),
        p(
          'Lower shield descend le bouclier de 3 ou 6 pixels dans ',
          code('models/item/shield.json'),
          ' et ',
          code('shield_blocking.json'),
          ' (Java 1.9 et plus récent ; depuis la 1.21.4, le jeu lit toujours la position du bouclier en main dans ces fichiers). Si tu as fait ton propre modèle d’épée ou de bouclier dans l’',
          link('/guides/make-3d-items-texture-pack', 'éditeur de modèles'),
          ', seuls ses emplacements à la première personne changent et ta forme reste.',
        ),
      ],
    },
    {
      id: 'fps',
      title: 'FPS boost : textures 8× et sans animations',
      body: [
        p(
          strong('8× textures'),
          ' réduit les textures des blocs, et des objets si tu veux, à 8 × 8 pixels à l’export. Les feuilles, le verre et les plantes gardent des bords nets. ',
          strong('No animations'),
          ' ne garde que la première image des textures animées et retire leur animation du fichier ',
          code('.mcmeta'),
          ', donc le jeu ne les met plus à jour à chaque tick (Java ; les boussoles et les montres marchent toujours). Les deux sont des couches d’effets, listées aussi dans l’onglet Effects, donc tes propres textures ne sont pas modifiées.',
        ),
        callout(
          'info',
          'C’est plus rapide de combien ?',
          'Des textures plus petites et immobiles utilisent moins de mémoire vidéo et moins de travail par image, ce qui aide surtout les vieux ordinateurs et les puces graphiques intégrées. Les plus gros gains de FPS viennent de la distance d’affichage, des particules et de mods comme Sodium ou OptiFine, qu’un pack de textures ne peut pas changer.',
        ),
      ],
    },
    {
      id: 'files',
      title: 'Quels fichiers vont dans le pack',
      body: [
        table(
          ['', ...PVP_EXAMPLE_FILES.map((e) => e.label)],
          [
            ['Feu bas', ...PVP_EXAMPLE_FILES.map((e) => (e.files.lowFire ? code(e.files.lowFire) : '—'))],
            ['Verre transparent', ...PVP_EXAMPLE_FILES.map((e) => code(e.files.glass))],
            ['Sans le flou de la citrouille', ...PVP_EXAMPLE_FILES.map((e) => code(e.files.pumpkin))],
            ['Viseur', ...PVP_EXAMPLE_FILES.map((e) => code(e.files.crosshair))],
            ['Épées plus petites', ...PVP_EXAMPLE_FILES.map((e) => (e.files.sword ? code(e.files.sword) : '—'))],
            ['Bouclier plus bas', ...PVP_EXAMPLE_FILES.map((e) => (e.files.shield ? code(e.files.shield) : '—'))],
          ],
        ),
        p('Le verre représente chaque texture de verre à côté, et l’épée chaque épée. L’éditeur trouve les chemins pour la version de ton pack, donc tu n’as pas à le faire.'),
      ],
    },
    {
      id: 'bedrock',
      title: 'Bedrock Edition',
      body: [
        p('Le verre transparent, l’absence de flou de citrouille, le viseur et les textures 8× marchent dans un pack Bedrock. Les autres y sont désactivés, avec la raison :'),
        ul([
          [strong('Feu bas : '), 'Bedrock dessine le feu sur ton écran à sa façon, qu’un pack de textures ne peut pas abaisser de manière fiable.'],
          [strong('Épées et bouclier : '), 'Bedrock place les objets en main avec des fichiers attachables, comme les add-ons, que l’éditeur ne fait pas.'],
          [strong('Sans animations : '), 'Bedrock joue les textures animées à partir d’une liste d’images dans ', code('flipbook_textures.json'), ' qu’un pack ne peut pas retirer.'],
        ]),
        figure(SHOTS.pvpBedrock),
      ],
    },
    {
      id: 'install',
      title: 'L’installer et le tester',
      body: [
        steps([
          ['Appuie sur ', strong('Export'), ' et télécharge le ', code('.zip'), ' (Java) ou le ', code('.mcpack'), ' (Bedrock).'],
          ['Java : ouvre ', uiPath(JAVA.options, JAVA.packs, JAVA.openFolder), ', dépose le zip dedans et passe le pack tout en haut de ', strong(JAVA.selected), '. Bedrock : ouvre le .mcpack et active le pack dans ', uiPath(BEDROCK.settings, BEDROCK.globalResources), '.'],
          'Mets-toi le feu, regarde à travers du verre, porte une citrouille et prends une épée et un bouclier en main pour vérifier chaque changement.',
        ]),
        p(
          'Pas ce que tu attendais ? Un autre pack au-dessus du tien remplace peut-être les mêmes fichiers. Plus d’aide : ',
          link('/guides/install-resource-packs', 'Comment installer des packs de ressources'),
          ' et ',
          link('/guides/texture-pack-not-working', 'Pack de textures qui ne marche pas'),
          '.',
        ),
      ],
    },
  ],
  faq: [
    {
      id: 'allowed',
      q: 'Les packs de textures PvP sont autorisés sur les serveurs ?',
      a: [p('Un pack de textures ne change que l’apparence du jeu, et les changements d’ici (feu plus bas, verre transparent, épée plus petite) sont du genre que la plupart des serveurs autorisent. Les packs qui montrent des choses que tu ne pourrais pas voir autrement, comme les minerais à travers la roche, sont en général interdits. Chaque serveur a ses propres règles, donc vérifie-les.')],
    },
    {
      id: 'fps',
      q: 'Un pack FPS donne vraiment plus de FPS ?',
      a: [p('Un peu, surtout sur les ordinateurs moins puissants : les textures 8× utilisent moins de mémoire vidéo et les textures immobiles économisent du travail à chaque tick. Sur un PC rapide, la différence est faible. La distance d’affichage, les particules et des mods comme Sodium ou OptiFine comptent beaucoup plus.')],
    },
    {
      id: 'version',
      q: 'Pour quelle version faire mon pack PvP ?',
      a: [p('La version à laquelle tu joues. Beaucoup de serveurs PvP tournent en 1.8.9, et un pack 1.8.9 a des noms de fichiers différents d’un pack récent. Pour utiliser un pack sur plusieurs versions, règle une plage dans l’onglet ', strong('Pack'), ' : le jeu l’affiche comme compatible, mais les fichiers ne marchent que là où les noms correspondent.')],
    },
    {
      id: 'short',
      q: 'Je peux faire une épée courte au lieu d’une petite épée ?',
      a: [p('Oui : peins une lame plus courte sur la texture de l’épée, comme beaucoup de packs 1.8.9. Ça change l’épée partout, aussi dans l’inventaire et dans les mains des autres joueurs. Smaller swords ne change que la taille qu’elle a l’air d’avoir dans ta propre main. Tu peux faire les deux.')],
    },
    {
      id: 'crosshair',
      q: 'Pourquoi mon viseur coloré n’a pas la bonne couleur ?',
      a: [p('Java dessine le viseur en inversant ce qu’il y a derrière, donc un viseur blanc paraît sombre sur un ciel clair et clair sur un sol sombre. Les couleurs se mélangent avec le fond de la même façon. Utilise du blanc ou du gris.')],
    },
    {
      id: 'mods',
      q: 'Un pack de textures peut ajouter un zoom, un compteur de FPS ou enlever le brouillard ?',
      a: [p('Non. Le zoom, l’affichage des FPS et des touches, le sprint automatique, enlever le brouillard et le flou de mouvement demandent un mod (OptiFine, Sodium et d’autres), un client PvP ou les réglages du jeu. Un pack ne change que les textures, les modèles, les sons et les fichiers de ce genre.')],
    },
  ],
  ctaLabel: 'Faire un pack PvP',
};

export const GUIDES: Record<string, GuideText> = {
  'make-a-texture-pack': makeATexturePack,
  'texture-pack-not-working': notWorking,
};
