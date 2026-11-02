// French help page (see HelpText in src/tools/help/content.ts). Menu names are the ones the French
// game shows (./game-ui.ts: Java fr_fr.json, Bedrock fr_FR.lang, Iris fr_fr.json). Buttons of the
// editors are quoted in English, as the editors show them.

import { el, type Child } from '../../app/markup';
import { backupButtons, callout, code, ext, folderTable, link, steps, strong, tabbed, uiPath } from '../../app/content/blocks';
import { REPO_URL } from '../../app/site';
import { F, LATEST, maxFormat, minFormat } from '../../app/content/facts';
import type { HelpText } from '../../tools/help/content';
import { UI_FR } from './ui';
import { BEDROCK, IRIS, JAVA, LAUNCHER, OPTIFINE } from './game-ui';

const p = (...c: Child[]) => el('p', null, ...c);
const FOLDER = UI_FR.folderTable;

const JAVA_PACK_STEPS: Child[] = [
  ['Exporte ton pack depuis Texture Pack Maker. Tu obtiens un fichier comme ', code('Mon pack.zip'), '.'],
  ['Lance Minecraft Java Edition et ouvre ', uiPath(JAVA.options, JAVA.packs), '.'],
  ['Clique sur ', uiPath(JAVA.openFolder), '. Le dossier ', code('resourcepacks'), ' s’ouvre.'],
  ['Dépose le ', code('.zip'), ' dans ce dossier. Tu peux aussi le faire glisser directement sur l’écran des packs de ressources.'],
  ['Survole ton pack dans la liste ', strong(JAVA.available), ' et clique sur la flèche pour le passer dans ', strong(JAVA.selected), '. Les packs les plus hauts dans la liste gagnent. Clique sur ', strong(JAVA.done), '.'],
];

const BEDROCK_PACK_STEPS: Child[] = [
  ['Exporte ton pack. Tu obtiens un fichier comme ', code('Mon pack.mcpack'), '.'],
  ['Double-clique sur le fichier. Minecraft s’ouvre et affiche ', el('em', null, BEDROCK.importStarted), ', puis ', el('em', null, BEDROCK.imported), '.'],
  ['Va dans ', uiPath(BEDROCK.settings, BEDROCK.globalResources, BEDROCK.myPacks), ', choisis ton pack et appuie sur ', strong(BEDROCK.activate), '.'],
  'Tu utilises plusieurs packs ? Place le tien tout en haut pour qu’il gagne.',
];

const JAVA_SKIN_STEPS: Child[] = [
  ['Ouvre le Minecraft Launcher et choisis ', uiPath('Minecraft: Java Edition', LAUNCHER.skins), '.'],
  ['Clique sur ', strong(LAUNCHER.newSkin), ' (la carte avec le +).'],
  ['Donne-lui un nom et choisis le modèle de joueur : ', strong(LAUNCHER.classic), ' ou ', strong(LAUNCHER.slim), '.'],
  ['Clique sur ', strong(LAUNCHER.browse), ', choisis ton PNG, puis ', strong(LAUNCHER.saveAndUse), '.'],
];

const BEDROCK_SKIN_STEPS: Child[] = [
  ['Exporte en ', strong('Pack de skins Bedrock'), '. Tu obtiens un fichier ', code('.mcpack'), '.'],
  'Ouvre le fichier (double-clic sur Windows, « Ouvrir avec Minecraft » sur téléphone et tablette) pour l’importer.',
  ['Dans Minecraft, va dans ', uiPath(BEDROCK.dressingRoom, BEDROCK.classicSkins), '. Ton pack apparaît avec les packs importés.'],
  ['Choisis ton skin et appuie sur ', strong(BEDROCK.equip), '.'],
];

const IRIS_STEPS: Child[] = [
  ['Télécharge l’Iris Installer sur ', ext('https://www.irisshaders.dev/', 'irisshaders.dev'), '. Il installe Fabric Loader, Iris et Sodium pour ta version en une seule fois.'],
  ['Ouvre le Minecraft Launcher, choisis le nouveau profil ', strong('Iris & Sodium'), ' et joue une fois.'],
  ['Exporte ton pack de shaders depuis le Créateur de shaders (un ', code('.zip'), ' : ne le décompresse pas).'],
  ['Dans le jeu, ouvre ', uiPath(JAVA.options, JAVA.video, IRIS.shaderPacks), ' et clique sur ', strong(IRIS.openFolder), '. Dépose le zip dedans.'],
  ['Choisis ton pack et clique sur ', strong(IRIS.apply), '. Le bouton ', strong(IRIS.settings), ' (en anglais dans Iris) te permet d’affiner les options dans le jeu.'],
];

const VANILLA_SHADER_STEPS: Child[] = [
  ['Exporte avec la cible ', strong('Java vanilla'), '. Tu obtiens un pack de ressources ', code('.zip'), '.'],
  ['Installe-le comme un pack de textures : ', uiPath(JAVA.options, JAVA.packs, JAVA.openFolder), ', puis dépose le zip dedans.'],
  `Passe-le dans « ${JAVA.selected} » et clique sur « ${JAVA.done} ». Le nouveau rendu s’applique tout de suite.`,
];

const VIBRANT_STEPS: Child[] = [
  ['Exporte ton pack (', code('.mcpack'), ') et ouvre le fichier pour l’importer.'],
  ['Va dans ', uiPath(BEDROCK.settings, BEDROCK.globalResources, BEDROCK.myPacks), ' et active-le.'],
  ['Ouvre ', uiPath(BEDROCK.settings, BEDROCK.video), ' et règle ', strong(BEDROCK.graphicsMode), ' sur ', strong(BEDROCK.vibrantVisuals), '.'],
];

export const HELP: HelpText = {
  sections: {
    'java-packs': {
      title: 'Packs de textures sur Java',
      short: 'Packs Java',
      howto: { name: 'Comment installer un pack de textures (pack de ressources) dans Minecraft Java Edition', steps: JAVA_PACK_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Java Edition appelle les packs de textures des ', el('em', null, 'packs de ressources'), '. Ton export est un fichier ', code('.zip'), ' : ne le décompresse pas.'),
        steps(JAVA_PACK_STEPS),
        callout(
          'info',
          `Tu vois « ${JAVA.madeForOlder} » (ou plus récente) ?`,
          'Les packs sont écrits pour la version que tu choisis dans l’éditeur. Si tu joues à une autre version, change la version cible ou la plage de compatibilité dans l’onglet ',
          strong('Pack'),
          ' et exporte à nouveau. Les packs qui ne changent que des textures marchent en général quand même : tu peux cliquer sur ',
          strong(JAVA.yes),
          ' pour l’utiliser malgré tout.',
        ),
        el('h3', { class: 'guide-sub' }, 'Où se trouve le dossier'),
        folderTable('resourcepacks', FOLDER),
      ],
    },
    'bedrock-packs': {
      title: 'Packs de textures sur Bedrock',
      short: 'Packs Bedrock',
      howto: { name: 'Comment installer un pack de textures Bedrock (.mcpack) sur Windows', steps: BEDROCK_PACK_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Les packs Bedrock s’exportent en fichiers ', code('.mcpack'), '. Quand tu en ouvres un, Minecraft l’importe automatiquement.'),
        tabbed(
          'bedrock-packs',
          [
            { value: 'windows', label: 'Windows', icon: 'monitor', content: [steps(BEDROCK_PACK_STEPS)] },
            {
              value: 'mobile',
              label: 'Android et iOS',
              icon: 'smartphone',
              content: [
                steps([
                  ['Télécharge le ', code('.mcpack'), ' sur ton téléphone ou ta tablette.'],
                  [strong('Android : '), 'ouvre-le depuis tes téléchargements ou l’appli Fichiers et choisis ', strong('Minecraft'), '. ', strong('iPhone / iPad : '), 'dans l’appli Fichiers, touche le fichier, puis ', uiPath('Partager', 'Minecraft'), '.'],
                  ['Minecraft importe le pack. Ensuite, ouvre ', uiPath(BEDROCK.settings, BEDROCK.globalResources), ' et active-le.'],
                ]),
              ],
            },
            {
              value: 'console',
              label: 'Consoles',
              icon: 'gamepad',
              content: [
                el(
                  'p',
                  { class: 'muted' },
                  'Xbox, PlayStation et Switch ne peuvent pas importer de fichiers .mcpack. Ajoute le pack à un monde sur un PC ou un téléphone et rejoins ce monde, ou joue sur un Realm ou un serveur qui contient le pack.',
                ),
              ],
            },
          ],
          UI_FR.platform,
        ),
        callout('tip', 'Seulement pour un monde ?', `Au lieu de ${BEDROCK.globalResources}, ouvre `, uiPath(BEDROCK.editWorld, BEDROCK.packs), ' et active le pack là.'),
        callout('info', 'Mettre à jour un pack déjà importé', 'Chaque export garde le même identifiant de pack et augmente son numéro de version : l’importer à nouveau remplace donc l’ancienne copie au lieu d’ajouter un doublon.'),
      ],
    },
    'java-skins': {
      title: 'Skins sur Java',
      short: 'Skins Java',
      howto: { name: 'Comment changer ton skin dans Minecraft Java Edition', steps: JAVA_SKIN_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Exporte ton skin en ', code('.png'), '. Retiens si tu as peint le modèle ', strong(LAUNCHER.classic), ' (bras de 4 pixels) ou ', strong(LAUNCHER.slim), ' (bras de 3 pixels).'),
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
                  ['Connecte-toi sur ', ext('https://www.minecraft.net/', 'minecraft.net'), ' et ouvre ton profil.'],
                  ['Dans la partie skin, choisis le modèle ', strong(LAUNCHER.classic), ' ou ', strong(LAUNCHER.slim), '.'],
                  ['Envoie ton PNG et confirme. Il apparaît dans le jeu la prochaine fois que tu rejoins un monde ou un serveur.'],
                ]),
              ],
            },
          ],
          UI_FR.platform,
        ),
        callout('info', 'Tu joues en 1.7.10 ou avant ?', 'Ces versions ne comprennent que l’ancien format 64×32. Utilise l’option d’export ', strong('Ancien skin Java (64×32)'), '.'),
      ],
    },
    'bedrock-skins': {
      title: 'Skins sur Bedrock',
      short: 'Skins Bedrock',
      howto: { name: 'Comment installer un pack de skins Bedrock (.mcpack)', steps: BEDROCK_SKIN_STEPS },
      body: [
        tabbed(
          'bedrock-skins',
          [
            { value: 'pack', label: 'Pack de skins (.mcpack)', icon: 'package', content: [steps(BEDROCK_SKIN_STEPS)] },
            {
              value: 'png',
              label: 'Un seul PNG',
              icon: 'image',
              content: [
                steps([
                  ['Exporte le skin en ', code('.png'), '.'],
                  ['Ouvre ', uiPath(BEDROCK.dressingRoom, BEDROCK.classicSkins), ' et, dans ', strong('Possédé'), ', choisis l’emplacement vide ', strong(BEDROCK.import), '.'],
                  ['Choisis ton PNG, puis le modèle de bras classique ou fin.'],
                ]),
              ],
            },
          ],
          UI_FR.platform,
        ),
        callout(
          'warn',
          'Tes amis voient un skin par défaut ?',
          'Les joueurs qui ont activé ',
          strong(BEDROCK.trustedSkins),
          ' voient les skins perso comme un skin par défaut. C’est leur propre réglage. Les consoles ne peuvent pas importer de fichiers de skins.',
        ),
      ],
    },
    iris: {
      title: 'Shaders avec Iris ou OptiFine',
      short: 'Iris / OptiFine',
      howto: { name: 'Comment installer un pack de shaders avec Iris', steps: IRIS_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Les packs de shaders classiques ont besoin d’un mod de shaders. ', strong('Iris'), ' est le plus simple et le plus rapide ; OptiFine marche aussi.'),
        tabbed(
          'iris',
          [
            { value: 'iris', label: 'Iris (recommandé)', icon: 'sparkles', content: [steps(IRIS_STEPS)] },
            {
              value: 'optifine',
              label: 'OptiFine',
              icon: 'gear',
              content: [
                steps([
                  ['Installe OptiFine pour ta version de Minecraft depuis ', ext('https://optifine.net/', 'optifine.net'), ' et joue une fois avec le profil OptiFine.'],
                  ['Ouvre ', uiPath(JAVA.options, JAVA.video, OPTIFINE.shaders), ' et clique sur ', strong(OPTIFINE.folder), '.'],
                  'Dépose ton zip exporté dans le dossier, puis choisis-le dans la liste.',
                ]),
              ],
            },
          ],
          UI_FR.platform,
        ),
        el('h3', { class: 'guide-sub' }, 'Dossier des packs de shaders'),
        folderTable('shaderpacks', FOLDER),
      ],
    },
    'vanilla-shaders': {
      title: 'Shaders vanilla (sans mods)',
      short: 'Shaders vanilla',
      howto: { name: 'Comment installer un pack de shaders vanilla (sans mods) dans Minecraft Java', steps: VANILLA_SHADER_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Ils marchent dans le jeu normal parce que ce sont des ', strong('packs de ressources'), ' qui remplacent certains fichiers de shaders de Minecraft lui-même.'),
        steps(VANILLA_SHADER_STEPS),
        callout(
          'warn',
          'Fait pour une version précise',
          'Mojang change souvent les fichiers de shaders, donc un pack de shaders vanilla ne marche que dans la version pour laquelle il a été fait. Après une mise à jour de Minecraft, ouvre ton projet, choisis la nouvelle version et exporte à nouveau.',
        ),
      ],
    },
    'vibrant-visuals': {
      title: 'Graphismes éclatants sur Bedrock',
      short: 'Graphismes éclatants',
      howto: { name: 'Comment utiliser un pack Graphismes éclatants dans Minecraft Bedrock', steps: VIBRANT_STEPS },
      body: [
        el('p', { class: 'guide-intro' }, 'Les « shaders » de Bedrock sont des packs de réglages pour les Graphismes éclatants (Vibrant Visuals) : lumière, ciel, étalonnage des couleurs, eau et brouillard.'),
        steps(VIBRANT_STEPS),
        callout(
          'warn',
          `Impossible de choisir ${BEDROCK.vibrantVisuals} ?`,
          'Minecraft ne le permet que si tous les packs actifs le prennent en charge. Les packs de textures classiques (y compris ceux que tu fais dans le Texture Pack Maker) le désactivent, donc désactive les autres packs pendant que tu utilises celui-ci. Certains serveurs le désactivent aussi.',
        ),
        callout(
          'info',
          'Il faut un appareil compatible',
          'Les Graphismes éclatants marchent sur les PC Windows avec DirectX 12, sur Xbox et PlayStation (sur Xbox One et PS4, ils sont désactivés au départ), sur iPhone et iPad avec une puce A12 ou plus récente, et sur beaucoup d’appareils Android récents. Ils ne sont pas disponibles sur la première Nintendo Switch, les Chromebooks et les tablettes Fire. ',
          strong('Personnaliser le brouillard classique'),
          ' marche aussi dans les autres modes graphiques.',
        ),
      ],
    },
    folders: {
      title: 'Trouver ton dossier Minecraft',
      short: 'Dossiers',
      body: [
        el('p', { class: 'guide-intro' }, 'Le plus rapide, c’est le bouton ', strong(JAVA.openFolder), ' dans Minecraft. Si tu as besoin du chemin :'),
        el(
          'table',
          { class: 'paths-table' },
          el('thead', null, el('tr', null, el('th', { scope: 'col' }, 'Quoi'), el('th', { scope: 'col' }, 'Où'))),
          el(
            'tbody',
            null,
            el('tr', null, el('th', { scope: 'row' }, 'Java sur Windows'), el('td', null, code('%APPDATA%\\.minecraft'))),
            el('tr', null, el('th', { scope: 'row' }, 'Java sur macOS'), el('td', null, code('~/Library/Application Support/minecraft'))),
            el('tr', null, el('th', { scope: 'row' }, 'Java sur Linux'), el('td', null, code('~/.minecraft'))),
            el('tr', null, el('th', { scope: 'row' }, 'Fichiers du jeu (.jar)'), el('td', null, code('.minecraft/versions/<version>/<version>.jar'))),
            el('tr', null, el('th', { scope: 'row' }, 'Bedrock sur Windows'), el('td', null, code('%APPDATA%\\Minecraft Bedrock\\users\\shared\\games\\com.mojang'))),
          ),
        ),
        el('p', { class: 'muted small' }, 'Sur Windows, colle le chemin dans la barre d’adresse de l’Explorateur de fichiers ou dans la fenêtre Exécuter (Win + R).'),
      ],
    },
    backup: {
      title: 'Sauvegarder et déplacer tes projets',
      short: 'Sauvegardes',
      body: [
        el('p', { class: 'guide-intro' }, 'Tes projets sont enregistrés seulement dans ce navigateur. Si tu effaces les données du site ou changes de navigateur ou d’appareil, ils restent derrière : garde donc une copie dans un fichier.'),
        backupButtons('Tout sauvegarder', 'Ouvrir une sauvegarde'),
        el(
          'ul',
          { class: 'guide-list' },
          el(
            'li',
            null,
            strong('Fichier de projet'),
            ' (',
            code('.tpmproject'),
            ') : un projet avec tout ce qu’il faut pour continuer à le modifier, comme les textures, sons et modèles modifiés, les effets, la version et l’édition, les skins d’un pack de skins, les réglages des shaders et les caractères d’une police. Enregistre-le dans l’éditeur avec ',
            strong('Enregistrer le projet'),
            ', ou depuis le menu d’un projet.',
          ),
          el('li', null, strong('Sauvegarde'), ' (', code('.tpmbackup'), ') : tous les packs de textures, skins et shaders de ce navigateur, plus ta cape et ta police, dans un seul fichier.'),
        ),
        el('h3', { class: 'guide-sub' }, 'Les ouvrir dans un autre navigateur ou sur un autre appareil'),
        steps([
          'Ouvre Texture Pack Maker là-bas (ou l’appli installée).',
          ['Dépose le fichier sur n’importe quelle zone de dépôt d’un éditeur, ou utilise ', strong('Ouvrir un fichier projet'), '. Un projet s’ouvre dans son éditeur comme un nouveau projet : rien de ce que tu as déjà n’est remplacé.'],
          ['Pour une sauvegarde, choisis ce que tu veux restaurer. Les projets déjà présents sont ignorés, ou gardés à côté des tiens avec ', strong('Garder les deux'), '.'],
        ]),
        callout(
          'info',
          'Ce n’est pas la même chose qu’un export',
          'Un .zip ou un .mcpack exporté est fait pour le jeu. Un fichier de projet garde aussi l’état de l’éditeur, pour que tu reprennes exactement là où tu t’étais arrêté. Aucun des deux ne contient les fichiers du jeu : ils se téléchargent à nouveau chez Mojang.',
        ),
      ],
    },
  },
  faq: [
    {
      id: 'vanilla-source',
      q: 'D’où viennent les textures vanilla ?',
      a: [
        p(
          'Quand tu commences un projet Java, ton navigateur télécharge le fichier officiel du jeu pour cette version directement depuis les serveurs de Mojang et ne garde sur cet appareil que les textures, les modèles et les shaders. Les textures de Bedrock viennent du dépôt officiel ',
          ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'),
          ' de Mojang sur GitHub.',
        ),
        p('Rien de Mojang n’est stocké sur Texture Pack Maker lui-même : c’est un site web statique, sans serveurs à lui.'),
      ],
    },
    {
      id: 'paint-3d',
      q: 'Je peux peindre sur le modèle 3D plutôt que sur la texture à plat ?',
      a: [
        p(
          'Oui. Dans l’éditeur de textures, utilise l’interrupteur ',
          strong('2D / 3D'),
          ' au-dessus de la zone de dessin (ou appuie sur D). Chaque face peint le pixel exact qu’elle affiche, y compris les faces tournées, les couches comme le côté de l’herbe, les états allumés et éteints, les coffres et les lits. Le crayon, la gomme, le remplissage, la pipette (ou Alt + clic), la taille du pinceau et le miroir marchent tous, et chaque texture garde son propre historique d’annulation. Fais glisser avec le clic droit ou deux doigts pour tourner le modèle, utilise la molette ou pince pour zoomer, et F, B, L, R et T pour sauter à un côté.',
        ),
      ],
    },
    {
      id: 'mobs',
      q: 'Je peux modifier les textures des créatures ?',
      a: [
        p(
          'Oui. Choisis ',
          strong('Créatures'),
          ' dans la liste des textures (Blocs · Objets · Créatures · Tout), ou ouvre n’importe quelle texture du dossier entity. La créature apparaît en 3D et se peint comme un bloc. Utilise les choix à côté (variante, âge, couleur de la laine, métier, etc.) pour atteindre chaque texture qu’elle utilise ; les couches comme la laine du mouton, les yeux lumineux et les vêtements des villageois se peignent sur leurs propres textures. Dans la liste Parts, clique sur une partie pour la masquer et peindre ce qu’elle cache, double-clique pour n’afficher que cette partie, et utilise Tout afficher pour tout faire revenir. Les créatures Bedrock utilisent les modèles de Bedrock, et les masques de teinte cachés dans leurs pixels transparents sont gardés.',
        ),
      ],
    },
    {
      id: 'gear',
      q: 'Je peux modifier les selles, les armures et les armures pour cheval ?',
      a: [
        p(
          'Oui. Les créatures qui portent des choses ont un groupe ',
          strong('Porte'),
          ' dans leurs choix : mets une selle sur un cochon, un arpenteur, un cheval, un dromadaire ou un nautile ; habille les zombies, les squelettes, les piglins et le porte-armure d’une armure (choisis un matériau pour tout l’ensemble, puis active ou désactive chaque pièce, et teins le cuir avec ',
          strong('Teinture'),
          ') ; donne leur armure aux chevaux, aux loups et aux nautiles, un tapis aux lamas et un harnais au ghast heureux. Chaque objet porté se peint sur sa propre texture et a sa propre entrée dans ',
          strong('Parties'),
          ', pour que tu puisses le masquer et peindre la créature en dessous. Ouvrir une texture d’armure, de selle ou de tapis la montre portée, et ',
          strong('Utilisée par'),
          ' liste chaque créature qui la porte. Les anciennes versions utilisent les textures d’armure et de selle qu’elles avaient.',
        ),
        p(
          strong('Ornements d’armure : '),
          'avec une armure humanoïde, choisis un motif dans ',
          strong('Ornement'),
          ' et un ',
          strong('Matériau'),
          ' sous Wearing (Java 1.20 et plus récent, et Bedrock). Le jeu colore le motif gris avec la palette du matériau, et utilise une palette plus sombre quand l’ornement est du même matériau que l’armure, comme un ornement en fer sur une armure en fer. Peins l’ornement sur le modèle ou ouvre son motif : les huit gris prennent la couleur de l’ornement et toute autre couleur reste comme tu la peins. Modifie la palette d’un matériau pour recolorer ce matériau sur tous les ornements, et masque ',
          strong('Ornement'),
          ' dans Parts pour atteindre l’armure en dessous.',
        ),
      ],
    },
    {
      id: 'models',
      q: 'Je peux changer la forme des blocs et des objets, comme une épée en 3D ?',
      a: [
        p(
          'Oui, dans les packs Java (Minecraft 1.8 et plus récent). Affiche un bloc ou un objet dans l’aperçu et appuie sur ',
          strong('Modifier la forme'),
          '. L’éditeur de modèles ouvre le modèle que le jeu utilise, reconstitué à partir de ses modèles parents. Ajoute, copie et supprime des cubes, tape leur position et leur taille ou fais glisser les flèches et les poignées en 3D, alignés sur la grille 16 × 16 ou plus fine, et tourne un cube sur un axe (par pas de 22,5° avant Minecraft 1.21.6). Dans ',
          strong('Faces'),
          ', donne à chaque face une texture de ton pack, ou une nouvelle que tu peindras plus tard, et fais glisser la partie de la texture qu’elle montre ; règle sa rotation, quand elle est cachée et si elle est teintée. ',
          strong('Affichage'),
          ' règle la position du modèle dans l’inventaire, à la première et à la troisième personne, au sol, dans un cadre et sur la tête, chacune avec son aperçu. Chaque changement peut être annulé.',
        ),
        p(
          'Pour commencer, prends le modèle du jeu, un modèle vide, un cube plein, une dalle, une croix comme les fleurs ou, pour les objets, ',
          strong('Objet 3D à partir du sprite'),
          ', qui transforme l’image plate en cubes d’un pixel d’épaisseur réunis en aussi peu de cubes que possible. Depuis la 1.21.4, ',
          strong('À plat dans l’inventaire'),
          ' garde l’icône plate dans l’inventaire et montre le modèle 3D en main. Le pack reçoit le fichier du modèle, plus une définition d’objet ou un fichier d’états de bloc seulement quand le jeu en a besoin ; l’export vérifie les modèles pour ta version, et les fichiers de modèles des packs que tu ouvres sont gardés et peuvent être modifiés. Sur Bedrock, les nouvelles formes de blocs ont besoin d’un add-on et les objets 3D en main de fichiers attachables, que l’éditeur ne fait pas ; tu peux télécharger un modèle en géométrie Bedrock pour partir de là. Pas à pas : ',
          link('/guides/make-3d-items-texture-pack', 'Comment faire des objets 3D'),
          '.',
        ),
      ],
    },
    {
      id: 'pvp',
      q: 'Je peux faire un pack PvP ou FPS ?',
      a: [
        p(
          'Oui. Quand tu crées un pack, choisis ',
          strong('Pack PvP / FPS'),
          ' : l’éditeur active le feu bas, le verre et les vitres transparents, enlève le flou de la citrouille, rend le viseur plus petit, les épées plus petites et le bouclier plus bas, dans la mesure où ta version a tout ça. L’onglet ',
          strong('PvP'),
          ` a un interrupteur pour chaque réglage, avec des choix comme la hauteur du feu, cinq viseurs ou ton propre dessin, et la taille des épées, plus des options FPS : textures 8× et sans animations. Chaque réglage écrit des fichiers de pack normaux pour ta version (de Java 1.6.1 à ${LATEST}, noms de fichiers de la 1.8.9 compris) et peut être désactivé ou annulé. Sur Bedrock, le verre transparent, la vue à travers la citrouille, le viseur et les textures 8× marchent ; le feu bas et les objets en main ne peuvent pas y être changés par un pack. Le zoom, un compteur de FPS ou l’absence de brouillard ont besoin de mods. Pas à pas : `,
          link('/guides/make-a-pvp-texture-pack', 'Comment faire un pack de textures PvP'),
          '.',
        ),
      ],
    },
    {
      id: 'fonts',
      q: 'Je peux changer la police de Minecraft ?',
      a: [
        p(
          'Oui, avec le ',
          link('/font-maker', 'créateur de polices'),
          ' : dessine tes lettres pixel par pixel, pars d’un style intégré, ou transforme une police TTF, OTF ou WOFF en pixels, et vérifie-les dans le tchat, sur les pancartes et dans les livres. Java 1.13 et plus récent reçoivent un ',
          code('font/default.json'),
          ' qui ne remplace que les caractères que tu as dessinés (un fichier TrueType peut aussi y aller) ; Java 1.6.1 à 1.12.2 reçoivent ',
          code('textures/font/ascii.png'),
          ' ; Bedrock reçoit ',
          code('font/default8.png'),
          ' et des pages de caractères. Si le texte a toujours l’air normal sur Java, désactive Police Unicode dans Options... › Langue....',
        ),
      ],
    },
    {
      id: 'sounds',
      q: 'Je peux changer les sons dans mon pack ?',
      a: [
        p(
          'Oui. Dans l’éditeur de packs de textures, appuie sur la note de musique au bout de l’interrupteur Blocs · Objets · Créatures · Tout. Trouve un son par son nom ou sa catégorie et appuie sur lecture pour l’écouter. Ouvre-le, puis ',
          strong('Remplacer'),
          ' un fichier par ton propre audio (MP3, WAV, OGG, M4A et d’autres) ou enregistre-en un avec ton micro. Fais glisser les poignées sur la forme d’onde pour le couper, règle le volume ou appuie sur ',
          strong('Normaliser'),
          ', et utilise Revenir au son du jeu. Les sons remplacés sont enregistrés en Ogg Vorbis et exportés avec ton pack : les packs Java les mettent dans ',
          code('assets/minecraft/sounds'),
          ', les packs Bedrock dans ',
          code('sounds/'),
          ' avec les entrées correspondantes de ',
          code('sound_definitions.json'),
          '.',
        ),
        p(
          'L’enregistrement ne demande l’accès au micro que quand tu appuies sur Lancer l’enregistrement ; s’il est bloqué, autorise le micro pour ce site depuis l’icône dans la barre d’adresse. Les enregistrements ne quittent jamais ton appareil. Garde la plupart des sons en mono pour qu’ils viennent de l’endroit où ils se passent dans le monde, et utilise la stéréo pour la musique et les sons des menus. Les sons de Java sont lus directement depuis les serveurs de Mojang, qui ne laissent pas les pages web lire l’audio : tu peux donc les écouter, mais tu ne peux couper que les sons que tu importes ou enregistres. La modification des sons marche pour Java 1.7.10 et plus récent, et pour Bedrock.',
        ),
      ],
    },
    {
      id: 'hd-skins',
      q: 'Je peux faire un skin HD 128×128 ?',
      a: [
        p(
          'Oui, pour Bedrock Edition. Les skins HD ont deux fois plus de pixels qu’un skin normal (128×128 au lieu de 64×64), donc les visages, les ombres et les motifs peuvent être plus fins. Quand tu commences un skin dans le créateur de skins, choisis ',
          strong('HD 128×128'),
          ' dans ',
          strong('Taille'),
          ', ou passe un skin existant en HD avec ',
          strong('Taille'),
          ' › ',
          strong('HD 128'),
          ' dans l’éditeur : chaque pixel est doublé, donc il a le même aspect jusqu’à ce que tu ajoutes des détails. Exporte ',
          strong('Skin Bedrock (.png)'),
          ` pour l’importer dans le ${BEDROCK.dressingRoom}, ou un `,
          strong('Pack de skins Bedrock (.mcpack)'),
          '. Un pack de skins peut mélanger skins normaux et HD.',
        ),
        p(
          'Java Edition n’accepte que des skins 64×64 sans mods, donc l’export Java fait une copie 64×64 (chaque bloc de 2×2 devient un pixel) et garde ton original HD. Avec un mod de skins HD comme CustomSkinLoader, choisis plutôt ',
          strong('128×128 pour les mods'),
          '. Les consoles ne peuvent pas importer de fichiers de skins, et les tailles au-dessus de 128×128 ne sont pas prises en charge. Les skins HD marchent aussi dans le créateur de totems.',
        ),
      ],
    },
    {
      id: 'poses',
      q: 'Je peux faire prendre la pose à mon skin et enregistrer une image ?',
      a: [
        p(
          'Oui. Dans l’éditeur de skins, appuie sur ',
          strong('Pose et image'),
          ' sous l’aperçu 3D. Choisis une des douze poses (debout, marche, course, salut, assis, accroupi, vol, pose en T, victoire, dab, combat, doigt pointé), ou ouvre ',
          strong('Régler'),
          ' et bouge la tête, le corps, chaque bras et chaque jambe avec des curseurs ; chaque partie a sa propre remise à zéro. Dans ',
          strong('Scène'),
          ', choisis un angle de caméra, le zoom, un fond (ou ',
          strong('Transparent'),
          ') et une cape ou des élytres du ',
          link('/cape-maker', 'créateur de capes'),
          '. ',
          strong('Enregistrer l’image'),
          ' crée un PNG en taille 1×, 2× ou 4×. Fais glisser le modèle pour tourner la caméra, et utilise la molette ou pince pour zoomer.',
        ),
      ],
    },
    {
      id: 'capes',
      q: 'Je peux faire une cape perso ?',
      a: [
        p(
          'Tu peux en dessiner une dans le ',
          link('/cape-maker', 'créateur de capes'),
          ' : peins la texture de cape 64×32 avec un aperçu 3D et télécharge le PNG. Là où elle s’affiche, c’est le jeu qui décide. Java Edition n’affiche que les capes officielles de Mojang, donc une cape perso a besoin d’un mod ou d’un client avec son propre service de capes, et seuls les joueurs qui ont le même mod la voient. Sur Bedrock, les capes sont des objets du Créateur de personnage, et l’outil de vérification des packs de Mojang signale comme une erreur une cape dans tout pack de skins qui n’est pas de Mojang : le créateur de packs de skins laisse donc les capes de côté.',
        ),
        p(
          'Ce qui marche sans mods, ce sont les élytres : le créateur de capes télécharge aussi un pack de textures d’élytres (Java 1.9 et plus récent, ou Bedrock) qui montre ton dessin sur les élytres pour tous ceux qui utilisent le pack. Les joueurs qui portent une cape affichent plutôt le dessin de leur cape sur leurs élytres.',
        ),
      ],
    },
    {
      id: 'upload',
      q: 'Est-ce que quelque chose est envoyé ?',
      a: [p('Non. Tes projets, tes images et tes packs exportés ne quittent jamais ton appareil. L’appli ne fait que télécharger : les fichiers du jeu chez Mojang, la liste des versions et les skins que tu cherches par pseudo.')],
    },
    {
      id: 'offline',
      q: 'Ça marche hors ligne ?',
      a: [
        p(
          'Oui, après le premier chargement. L’appli et chaque version que tu as déjà ouverte restent sur cet appareil, donc tu peux continuer à modifier sans internet. Une version que tu n’as pas encore utilisée a besoin d’une connexion, ou choisis ',
          strong('Utiliser mon propre .jar'),
          ' et prends-la dans ton dossier ',
          code('.minecraft/versions'),
          '.',
        ),
      ],
    },
    {
      id: 'storage',
      q: 'Où sont enregistrés mes projets ?',
      a: [
        p(
          'Dans le stockage de ton navigateur, sur cet appareil. Ils y restent jusqu’à ce que tu les supprimes ou que tu effaces les données de ce site. Pour garder une copie ou les emmener sur un autre ordinateur, enregistre un fichier de projet (',
          code('.tpmproject'),
          ') ou une sauvegarde de tous les projets (',
          code('.tpmbackup'),
          ') et ouvre-le là-bas. ',
          link('/help#backup', 'Comment sauvegarder et restaurer'),
          '.',
        ),
      ],
    },
    {
      id: 'versions',
      q: 'Quelles versions de Minecraft sont prises en charge ?',
      a: [p(`Java ${LATEST} est la version par défaut, et toutes les versions de Java jusqu’à la 1.6.1 (quand les packs de ressources sont apparus) marchent, les snapshots aussi si tu les actives. Pour Bedrock, tu peux utiliser la dernière version, la dernière preview et des versions plus anciennes.`)],
    },
    {
      id: 'pack-format',
      q: `Quel est le format de pack de ressources de Minecraft Java ${LATEST} ?`,
      a: [
        p(
          `Java ${LATEST} utilise le format de pack de ressources ${F(LATEST)}. Un pack fait seulement pour ${LATEST} déclare `,
          code(`"min_format": ${minFormat(LATEST)}`),
          ' et ',
          code(`"max_format": ${maxFormat(LATEST)}`),
          ' dans son ',
          code('pack.mcmeta'),
          '. Le Texture Pack Maker écrit ces champs pour toi. Découvre ',
          link('/guides/minecraft-pack-format-versions', 'le format de chaque version Java'),
          '.',
        ),
      ],
    },
    {
      id: 'java-vs-bedrock',
      q: 'Quelle est la différence entre les packs Java et Bedrock ?',
      a: [
        p(
          'Un pack Java est un ',
          code('.zip'),
          ' avec un fichier ',
          code('pack.mcmeta'),
          ' et des textures PNG dans ',
          code('assets/minecraft/textures/'),
          '. Un pack Bedrock est un ',
          code('.mcpack'),
          ' avec un ',
          code('manifest.json'),
          ' et des textures dans ',
          code('textures/'),
          ' (PNG ou TGA). Aucune des deux éditions ne peut charger les packs de l’autre. ',
          link('/guides/java-vs-bedrock-packs', 'La comparaison complète'),
          '.',
        ),
      ],
    },
    {
      id: 'no-mods',
      q: 'Je peux faire des shaders sans mods ?',
      a: [
        p(
          `Oui. Sur Java 1.17 et plus récent, un pack de ressources peut changer les shaders de Minecraft lui-même (couleurs, vignette, brouillard, et bloom en ${LATEST}). Sur Bedrock, un pack Graphismes éclatants change la lumière, le ciel, le brouillard et l’eau intégrés. Les vraies ombres et les reflets sur Java ont toujours besoin d’Iris ou d’OptiFine. `,
          link('/guides/make-shaders-without-mods', 'Comment ça marche'),
          '.',
        ),
      ],
    },
    {
      id: 'phone',
      q: 'Je peux l’utiliser sur téléphone ou tablette ?',
      a: [p('Oui. Tous les outils marchent au toucher, y compris le zoom à deux doigts dans les éditeurs de pixels. Un plus grand écran est plus confortable pour du pixel art détaillé.')],
    },
    {
      id: 'official',
      q: 'C’est gratuit ? C’est officiel ?',
      a: [p('C’est gratuit et open source, sous licence MIT.'), p('Texture Pack Maker n’est pas un produit officiel de Minecraft. Il n’est ni approuvé par Mojang ou Microsoft, ni associé à eux.')],
    },
    {
      id: 'bug',
      q: 'Quelque chose ne marche pas. Comment le signaler ?',
      a: [p('Ouvre un ticket (issue) sur ', ext(`${REPO_URL}/issues`, 'GitHub'), ' avec ton navigateur, la version du jeu et ce que tu faisais. Les captures d’écran aident beaucoup.')],
    },
  ],
  quick: { 'java-packs': 'Installer un pack de textures', 'java-skins': 'Changer ton skin', iris: 'Utiliser un pack de shaders', faq: 'Questions' },
  toc: {
    title: 'Sur cette page',
    textures: 'Packs de textures',
    skins: 'Skins',
    shaders: 'Shaders',
    more: 'Plus',
    irisOptifine: 'Iris / OptiFine',
    vanilla: 'Vanilla (sans mods)',
    vibrant: 'Graphismes éclatants',
    folders: 'Dossiers',
    backup: 'Sauvegardes',
    faq: 'Questions fréquentes',
    allGuides: 'Tous les guides',
  },
  bothEditions: 'Java et Bedrock',
  eyebrow: 'Guide d’installation et aide',
  title: 'Comment installer des packs de textures, des skins et des shaders',
  lead: 'Fais entrer tes créations dans Minecraft : des guides pas à pas pour Java et Bedrock sur PC, Mac, téléphones et consoles, et des réponses aux questions courantes.',
  faqTitle: 'Questions fréquentes',
};
