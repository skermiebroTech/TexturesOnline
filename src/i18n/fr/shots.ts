// French alt texts and captions of the screenshots (the images themselves show the English app).

import { localShots } from '../../app/content/shots';

export const SHOTS = localShots({
  newPack: {
    alt: 'Le formulaire « New texture pack » rempli : nom My First Pack, édition Java, version Java 26.3 (pack format 97.1), résolution 32× et une description, à côté de la zone pour ouvrir un pack.',
    caption: 'Donne un nom au pack, puis choisis l’édition, la version du jeu et la résolution.',
  },
  editor: {
    alt: 'L’éditeur de textures avec la façade du fourneau ouverte dans l’éditeur de pixels 16×16, des traits orange autour de l’ouverture du feu et la même peinture sur le modèle 3D du fourneau dans l’aperçu.',
    caption: 'On peint la façade du fourneau : l’aperçu 3D montre le changement sur le vrai modèle du bloc.',
  },
  effects: {
    alt: 'L’onglet « Effects » avec le préréglage Autumn appliqué : des bandes avant et après de textures recolorées, et les blocs de mousse de la liste devenus brun orangé.',
    caption: 'Des effets en un clic comme Autumn changent le style de toutes les textures d’un coup.',
  },
  packSettings: {
    alt: 'La carte de version du jeu dans l’onglet « Pack » : le pack est fait pour Java 26.3 (pack format 97.1) et marche aussi de Java 1.21 (pack format 34) à 26.3.',
    caption: 'Une plage de compatibilité permet à un pack de se charger dans plusieurs versions de Java.',
  },
  export: {
    alt: 'La fenêtre d’export de My First Pack.zip : une texture modifiée, les effets Autumn, fait pour Java 26.3 avec le pack format 97.1, marche de 1.21 à 26.3, et un bouton « Export .zip ».',
    caption: 'La fenêtre d’export résume ce qui va dans le pack avant le téléchargement.',
  },
  openPack: {
    alt: 'Un pack existant ouvert depuis un .zip : le filtre « Edited » montre ses trois textures modifiées et sa texture de roche bleutée apparaît dans l’éditeur de pixels et sur un bloc de roche en 3D.',
    caption: 'Quand tu ouvres un .zip existant, ses textures modifiées apparaissent dans la liste, prêtes à être retouchées.',
  },
  skin2d: {
    alt: 'L’éditeur de skins sur le modèle 64×64 avec les zones du corps indiquées et la peinture en miroir activée, des traits bleus et jaunes sur le torse et les bras, et l’aperçu 3D du skin à droite.',
    caption: 'On peint sur le modèle 64×64 en miroir pendant que le modèle 3D se met à jour.',
  },
  skin3d: {
    alt: 'L’éditeur de skins en mode peinture 3D : le modèle est un peu tourné, le bras gauche est masqué avec la silhouette des parties du corps et il y a de la peinture rouge sur le torse.',
    caption: 'On peint directement sur le modèle 3D, avec un bras masqué pour atteindre le corps.',
  },
  skinPack: {
    alt: 'La fenêtre « Make a skin pack » : un pack appelé Adventure Crew avec trois skins, Wizard (bras classiques, ce skin), Robot (bras fins) et Explorer (bras classiques), et un bouton « Download pack ».',
    caption: 'Trois skins, classiques et fins, dans un seul pack de skins Bedrock.',
  },
  shaderVanilla: {
    alt: 'Le Shader Maker pour Vanilla Java avec des curseurs de couleur et de teinte (luminosité, contraste et saturation) à côté d’un aperçu 3D en direct d’une île d’herbe.',
    caption: 'Un pack de shaders vanilla pour Java : des curseurs de couleur avec aperçu en direct, sans mods.',
  },
  shaderIris: {
    alt: 'Le Shader Maker pour Iris et OptiFine au coucher du soleil : l’aperçu montre une lumière chaude et basse et de longues ombres, avec des préréglages et un curseur d’intensité du soleil.',
    caption: 'Un pack de shaders Iris / OptiFine avec de vraies ombres, au coucher du soleil.',
  },
  vibrantVisuals: {
    alt: 'Le Shader Maker pour les Graphismes éclatants de Bedrock : un aperçu lumineux avec un ciel bleu, des préréglages, un curseur de luminosité du soleil et des notes indiquant qu’aucun mod n’est nécessaire.',
    caption: 'On crée un pack Graphismes éclatants pour Bedrock, avec aperçu en direct.',
  },
  paint3d: {
    alt: 'L’éditeur de textures en mode 3D : un modèle de fourneau remplit la zone de dessin avec des traits rouges peints directement sur sa face avant, et à côté la texture plate de la façade avec les mêmes traits.',
    caption: 'On peint directement sur le fourneau en 3D : chaque face peint la texture qu’elle affiche.',
  },
  mobGear: {
    alt: 'Un modèle de cheval dans l’éditeur de textures avec une selle et une armure en cuir pour cheval, et les options de robe, de marques, d’âge, de selle et d’armure dans le panneau latéral.',
    caption: 'Les mobs apparaissent sur leurs propres modèles 3D, avec des selles et des armures que tu peux peindre aussi.',
  },
  mobParts: {
    alt: 'Un zombie en armure de fer avec le plastron masqué dans la liste des parties, pour pouvoir peindre son t-shirt en 3D.',
    caption: 'Masque une partie, ici le plastron, pour peindre ce qu’elle cache.',
  },
  convertPack: {
    alt: 'Le convertisseur de packs de textures avec un pack Java 26.2 choisi (6 textures) et Bedrock Edition comme cible, avec le bouton « Convert to Bedrock ».',
    caption: 'Choisis un pack et ce en quoi le convertir.',
  },
  convertResult: {
    alt: 'Le résultat du convertisseur : 4 textures sur 6 converties de Java 26.2 vers Bedrock, avec des boutons pour télécharger et ouvrir dans l’éditeur, et les listes des textures ignorées avec leur raison.',
    caption: 'Le rapport montre ce qui a été converti et pourquoi quelque chose a été ignoré.',
  },
  mergeSettings: {
    alt: '« Merge Texture Packs » avec trois packs par ordre de priorité (Top Pack, Extras et un pack Java 1.12.2), le nom du pack fusionné, le choix de l’icône et Java 26.3 comme version cible.',
    caption: 'Range les packs : celui du haut gagne à chaque conflit.',
  },
  mergeResult: {
    alt: 'Le résultat : 3 packs fusionnés en un seul, avec une barre par pack qui montre les fichiers utilisés, combinés et non utilisés, et la liste des conflits.',
    caption: 'Le résultat montre la part de chaque pack incluse et chaque conflit.',
  },
  modelEditShape: {
    alt: 'L’éditeur de textures avec l’épée en diamant choisie dans la liste des objets : son sprite 16×16 dans l’éditeur de pixels et, dans l’onglet « Preview », l’épée plate avec le bouton « Edit shape » en dessous.',
    caption: 'Affiche un objet dans l’onglet « Preview » et clique sur « Edit shape » pour ouvrir l’éditeur de modèles.',
  },
  modelSpriteStart: {
    alt: 'L’éditeur de modèles ouvert sur l’épée en diamant, un sprite plat sans cubes : les points de départ « 3D item from sprite », « Full cube », « Slab », « Cross (plant) » et « Empty », dans la vue 3D et dans l’onglet « Model ».',
    caption: 'Un objet plat commence sans cubes : choisis « 3D item from sprite ».',
  },
  model3dSword: {
    alt: 'L’épée en diamant en modèle 3D de 19 cubes d’un pixel d’épaisseur. Le cube 5 est choisi dans la liste et s’affiche avec des flèches pour le déplacer dans la vue 3D, avec sa position (9, 11, 7,5) et sa taille (5 × 1 × 1) dans l’onglet « Cube ».',
    caption: 'Le sprite devient 19 cubes. Choisis-en un pour le déplacer, changer sa taille ou ses faces.',
  },
  modelDisplay: {
    alt: 'L’onglet « Display » sur « Third person » : l’épée en diamant 3D dans la main d’un modèle de joueur, et les champs de rotation (0, -90, 55), de position (0, 4, 0,5) et de taille (0,85) pour la main droite.',
    caption: '« Display » règle comment le modèle est tenu, porté et affiché, chacun avec son aperçu.',
  },
  modelFlatInventory: {
    alt: 'L’onglet « Model » avec « Flat in the inventory » activé, qui garde l’icône plate dans l’inventaire, au sol et dans les cadres. En haut, il est maintenant écrit item/diamond_sword_3d.json.',
    caption: '« Flat in the inventory » (1.21.4+) garde la forme 3D comme deuxième modèle pour la main.',
  },
  modelBlock: {
    alt: 'Le modèle du bloc de roche transformé en marche : un cube de 16×8×16 comme une dalle et un second cube de 16×8×8 posé sur une moitié, avec sa position et sa taille dans l’onglet « Cube ».',
    caption: 'La roche transformée en marche : le point de départ « Slab » et un cube de plus.',
  },
  pvpStart: {
    alt: 'Le formulaire « New texture pack » avec le pack PvP / FPS choisi comme point de départ, l’option pack FPS en plus activée, l’édition Java, la version Java 1.8.9 et le bouton pour créer le pack PvP.',
    caption: 'Choisis le pack PvP / FPS et la version à laquelle tu joues.',
  },
  pvpTweaks: {
    alt: 'L’éditeur de textures d’un pack PvP pour Java 1.8.9 : fire_layer_1 ouvert dans l’éditeur de pixels avec les flammes descendues dans la moitié basse de l’image, et l’onglet PvP avec le feu bas activé, sa hauteur réglée sur plus bas et l’option qui laisse les blocs de feu tels quels activée.',
    caption: 'L’onglet PvP : chaque réglage est un interrupteur, avec ses choix et les fichiers qu’il change.',
  },
  pvpCrosshair: {
    alt: 'icons.png agrandi, son carré de viseur 16×16 en haut à gauche sélectionné avec un viseur gris en losange peint dedans, à côté des icônes de cœurs et d’armure, et la carte du viseur perso avec cinq dessins et un bouton pour dessiner le tien.',
    caption: 'Dessine le tien : jusqu’à Java 1.20.1, le viseur est le coin en haut à gauche d’icons.png.',
  },
  pvpBedrock: {
    alt: 'Un pack PvP Bedrock : la texture du verre teinté en rouge ouverte, transparente à l’intérieur avec sa bordure gardée, et l’onglet PvP avec le feu bas désactivé et la raison pour laquelle Bedrock ne peut pas l’avoir, au-dessus du verre transparent activé.',
    caption: 'Sur Bedrock, les réglages qu’un pack ne peut pas faire sont désactivés, avec la raison.',
  },
});
