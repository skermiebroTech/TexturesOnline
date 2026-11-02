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

export const GUIDES: Record<string, GuideText> = {
  'make-a-texture-pack': makeATexturePack,
  'texture-pack-not-working': notWorking,
};
