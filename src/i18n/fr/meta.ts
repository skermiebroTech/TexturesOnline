// French page titles, descriptions and short names (see MetaTranslation in src/app/seo/meta.ts).

import type { MetaTranslation } from '../../app/seo/meta';
import { F, LATEST } from '../../app/content/facts';

export const META_FR: MetaTranslation = {
  pages: {
    '/': {
      title: 'Créer un pack de textures Minecraft gratuit – Java, Bedrock',
      description: `Crée ton pack de textures Minecraft en quelques minutes : peins des blocs en 3D, change le style en un clic, exporte en .zip ou .mcpack. Java ${LATEST}.`,
      label: 'Accueil',
    },
    '/textures': {
      title: 'Éditeur de packs de textures et de ressources Minecraft',
      description: 'Modifie n’importe quelle texture Minecraft : peins blocs, objets et créatures en 3D, importe des PNG ou change le style en un clic. Export .zip ou .mcpack.',
      label: 'Packs de textures',
    },
    '/texture-pack-converter': {
      title: 'Convertisseur de packs de textures : Java vers Bedrock',
      description: 'Convertis un pack de textures Minecraft de Java vers Bedrock, de Bedrock vers Java ou entre versions de Java, ou des PNG en .mcpack. Gratuit.',
      label: 'Convertisseur de packs',
    },
    '/merge-texture-packs': {
      title: 'Fusionner des packs de textures Minecraft en ligne',
      description: 'Fusionne plusieurs packs de textures Minecraft en un seul .zip ou .mcpack. Range-les et le pack du haut gagne, comme dans le jeu. Gratuit.',
      label: 'Fusionner des packs',
    },
    '/pack-doctor': {
      title: 'Réparer un pack de textures Minecraft cassé – Pack Doctor',
      description: 'Ton pack de textures ne marche pas ? Pack Doctor vérifie ton pack Java ou Bedrock, explique chaque problème et le corrige en un clic. Gratuit.',
      label: 'Pack Doctor',
    },
    '/totem-maker': {
      title: 'Créer un totem d’immortalité personnalisé – Minecraft',
      description: 'Transforme n’importe quel skin Minecraft en totem d’immortalité : importe un PNG ou tape un pseudo, choisis un style, télécharge un .zip ou un .mcpack.',
      label: 'Créateur de totems',
    },
    '/font-maker': {
      title: 'Créateur de polices Minecraft – pack de police gratuit',
      description: 'Crée ta police Minecraft : dessine des lettres en pixels ou convertis un TTF/OTF, teste-la dans le tchat, les pancartes et les livres, et télécharge-la.',
      label: 'Créateur de polices',
    },
    '/skins': {
      title: 'Éditeur de skins Minecraft et créateur de packs de skins',
      description: 'Peins un skin Minecraft en 2D ou en 3D, avec des bras classiques ou fins, et exporte-le en PNG pour Java ou en pack de skins Bedrock (.mcpack). Gratuit.',
      label: 'Skins',
    },
    '/skin-pack-maker': {
      title: 'Créer un pack de skins Minecraft gratuit (.mcpack Bedrock)',
      description: 'Crée ton pack de skins Minecraft en ligne : peins ou importe des skins, mélange bras classiques et fins et télécharge un .mcpack Bedrock prêt pour le jeu.',
      label: 'Créateur de packs de skins',
    },
    '/cape-maker': {
      title: 'Créateur de capes Minecraft – dessine cape et élytres',
      description: 'Dessine une cape Minecraft et ses élytres sur le modèle 64×32, avec un aperçu 3D. Télécharge le PNG ou un pack de textures d’élytres. Gratuit.',
      label: 'Créateur de capes',
    },
    '/shaders': {
      title: 'Créer des shaders Minecraft : Iris, OptiFine et sans mods',
      description: 'Crée des packs de shaders pour Iris ou OptiFine, des shaders vanilla sans mods pour Java ou des packs Graphismes éclatants pour Bedrock, avec aperçu 3D.',
      label: 'Shaders',
    },
    '/help': {
      title: 'Installer des packs de textures, skins et shaders Minecraft',
      description: 'Pas à pas pour Java et Bedrock sur Windows, Mac, Android, iPhone et consoles : le dossier resourcepacks, l’activation et que faire en cas de souci.',
      label: 'Aide',
    },
    '/about': {
      title: 'À propos de Texture Pack Maker : outils gratuits et libres',
      description: 'Qui fait Texture Pack Maker, ce qui le rend différent (chaque version de Java depuis 1.6.1, Bedrock, open source) et comment il protège ton travail.',
      label: 'À propos',
    },
    '/privacy': {
      title: 'Politique de confidentialité – Texture Pack Maker',
      description: 'Texture Pack Maker n’a ni comptes, ni pubs, ni pistage. Tes packs, skins et shaders restent sur ton appareil et rien de ce que tu crées n’est envoyé.',
      label: 'Confidentialité',
    },
    '/all': {
      title: 'Tous les outils Minecraft : packs, skins et shaders',
      description: 'Tous les outils, fonctions et guides gratuits de Texture Pack Maker au même endroit : packs de textures, modèles 3D, sons, skins et shaders.',
      label: 'Tout le site',
    },
    '/guides': {
      title: 'Guides Minecraft : packs de textures, skins et shaders',
      description: `Des guides pas à pas pour créer et installer packs de textures, skins et shaders Minecraft, et le pack format de chaque version Java jusqu’à ${LATEST}.`,
      label: 'Guides',
    },
  },
  guides: {
    'make-a-texture-pack': {
      title: 'Comment créer un pack de textures Minecraft (Java, Bedrock)',
      h1: 'Comment créer un pack de textures Minecraft',
      description: 'Crée ton pack de textures Minecraft gratuitement : choisis une version, peins des textures, exporte un .zip avec pack.mcmeta (Java) ou un .mcpack.',
      label: 'Créer un pack de textures',
      blurb: 'Choisis une version, peins des textures et exporte un pack que Minecraft charge.',
    },
    'install-resource-packs': {
      title: 'Installer un pack de textures Minecraft (Java et Bedrock)',
      h1: 'Comment installer des packs de textures, des shaders et des fichiers .mcpack',
      description: 'Installe un pack de ressources sur Java, importe un .mcpack Bedrock sur PC ou mobile, ajoute des shaders avec Iris ou OptiFine et répare les packs absents.',
      label: 'Installer packs et shaders',
      blurb: 'Packs de ressources Java, fichiers .mcpack Bedrock et packs de shaders, avec les solutions.',
    },
    'texture-pack-not-working': {
      title: 'Ton pack de textures Minecraft ne marche pas ? Solutions',
      h1: 'Ton pack de textures Minecraft ne marche pas ? Comment le réparer',
      description: 'Pack absent, « ancienne version », blocs violets et noirs, herbe grise, erreurs du manifeste du pack : ce que veut dire chaque message et la solution.',
      label: 'Pack qui ne marche pas ? Solutions',
      blurb: 'Packs qui n’apparaissent pas, alertes de version, blocs violets et noirs et plus encore.',
    },
    'minecraft-pack-format-versions': {
      title: `Pack format Minecraft ${LATEST} (${F(LATEST)}) et toutes les versions`,
      h1: `Le pack format de Minecraft pour chaque version Java (${LATEST} utilise ${F(LATEST)})`,
      description: `Chaque version de Minecraft Java de 1.6.1 à ${LATEST} avec son format de pack de ressources (${LATEST} utilise ${F(LATEST)}) et l’évolution de pack.mcmeta.`,
      label: 'Formats de pack par version',
      blurb: `Le pack format de chaque version Java, de 1.6.1 à ${LATEST}.`,
    },
    'make-a-skin': {
      title: 'Comment faire un skin Minecraft (Java et Bedrock)',
      h1: 'Comment faire ton propre skin Minecraft',
      description: 'Fais un skin Minecraft gratuitement : peins le modèle 64×64 ou HD 128×128 en 2D ou en 3D, avec des bras classiques ou fins, pour Java ou Bedrock.',
      label: 'Faire un skin',
      blurb: 'Peins le modèle 64×64 ou HD 128×128 pour Java ou un pack de skins Bedrock.',
    },
    'make-shaders-without-mods': {
      title: 'Shaders Minecraft sans mods ni OptiFine (Java et Bedrock)',
      h1: 'Peut-on avoir des shaders dans Minecraft sans mods ?',
      description: 'Oui, sans OptiFine ni Iris : sur Java 1.17+ un pack de ressources change les shaders du jeu et Bedrock a les Graphismes éclatants. Crée le tien.',
      label: 'Shaders sans mods',
      blurb: 'Ce que peuvent faire les shaders vanilla de Java et les Graphismes éclatants de Bedrock.',
    },
    'java-vs-bedrock-packs': {
      title: 'Des packs de textures Java sur Bedrock ? Convertis-les',
      h1: 'Packs de textures Java ou Bedrock : différences et conversion',
      description: 'Pas directement : un pack Java est un .zip avec pack.mcmeta et Bedrock veut un .mcpack. Convertis-le gratuitement dans le navigateur, fichier par fichier.',
      label: 'Packs Java ou Bedrock',
      blurb: 'Fichiers, dossiers, formats, shaders et skins, comparés côte à côte.',
    },
    'bedrock-vibrant-visuals-settings': {
      title: 'Réglages des Graphismes éclatants de Minecraft Bedrock',
      h1: 'Les réglages des Graphismes éclatants de Bedrock expliqués',
      description: 'Ce qu’un pack Graphismes éclatants peut changer sur Bedrock (soleil, ciel, brouillard, eau, ombres, couleurs), les appareils compatibles et l’activation.',
      label: 'Réglages Graphismes éclatants',
      blurb: 'Soleil, ciel, brouillard, eau et couleurs, et les appareils compatibles.',
    },
    'convert-java-to-bedrock-texture-pack': {
      title: 'Convertir un pack de textures Java en Bedrock (et l’inverse)',
      h1: 'Comment convertir un pack de textures Java en Bedrock',
      description: 'Convertis gratuitement un pack de textures Minecraft Java en .mcpack Bedrock, ou l’inverse : ce qui est converti, ce qui ne l’est pas et l’installation.',
      label: 'Convertir Java en Bedrock',
      blurb: 'Transforme un pack Java en .mcpack Bedrock, ou l’inverse, en quelques clics.',
    },
    'merge-texture-packs': {
      title: 'Comment fusionner des packs de textures Minecraft',
      h1: 'Comment fusionner des packs de textures Minecraft',
      description: 'Réunis plusieurs packs de textures Minecraft en un seul pour un serveur, un Realm ou pour le partager : quel pack gagne, en ligne ou à la main.',
      label: 'Fusionner des packs',
      blurb: 'Réunis plusieurs packs en un seul, dans l’ordre que tu choisis.',
    },
    'make-a-bedrock-skin-pack': {
      title: 'Comment faire un pack de skins Minecraft Bedrock (gratuit)',
      h1: 'Comment faire un pack de skins Minecraft Bedrock',
      description: 'Crée un pack de skins pour Minecraft Bedrock : peins ou importe des skins, exporte un .mcpack, importe-le sur PC ou mobile et mets-le à jour.',
      label: 'Pack de skins Bedrock',
      blurb: 'Réunis tes skins dans un .mcpack et équipe-les depuis le Vestiaire.',
    },
    'make-3d-items-texture-pack': {
      title: 'Comment faire des objets 3D dans un pack de textures',
      h1: 'Comment faire des objets 3D et des modèles perso dans un pack de textures',
      description: 'Transforme les objets plats de Minecraft en 3D et change la forme des blocs dans un pack Java : modèles JSON, définitions d’objets 1.21.4+ et solutions.',
      label: 'Faire des objets 3D',
      blurb: 'Transforme des objets plats en modèles 3D et change la forme des blocs, fichier par fichier.',
    },
    'make-a-pvp-texture-pack': {
      title: 'Comment faire un pack de textures PvP (Java et Bedrock)',
      h1: 'Comment faire un pack de textures PvP pour Minecraft',
      description: 'Fais un pack de textures PvP Minecraft gratuit : feu bas, verre transparent, petites épées, viseur perso et textures 8× pour les FPS, de 1.8.9 à 26.3.',
      label: 'Faire un pack PvP',
      blurb: 'Feu bas, verre transparent, petites épées, viseur et textures pour les FPS.',
    },
    'make-a-pbr-texture-pack': {
      title: 'Pack de textures PBR pour Graphismes éclatants et shaders',
      h1: 'Comment faire un pack de textures PBR pour Graphismes éclatants et les shaders',
      description: 'Crée un pack de textures PBR gratuit : brillance, métal, lumière et relief en jeux de textures Graphismes éclatants et en cartes labPBR pour Iris.',
      label: 'Faire un pack PBR',
      blurb: 'Brillance, métal, lumière propre et relief pour Graphismes éclatants et les shaders labPBR.',
    },
    'rename-items-texture-pack': {
      title: 'Changer la texture d’un objet en le renommant – Minecraft',
      h1: 'Renomme des objets pour changer leur texture',
      description: 'Crée un pack Minecraft gratuit où les objets renommés changent d’apparence : définitions d’objets pour Java 1.21.5+ et CIT d’OptiFine avant.',
      label: 'Renommer des objets',
      blurb: 'Donne sa propre texture à un objet renommé, comme une épée appelée « Excalibur ».',
    },
    'make-animated-textures': {
      title: 'Faire des textures animées Minecraft (Java et Bedrock)',
      h1: 'Faire des textures animées',
      description: 'Anime n’importe quel bloc ou objet Minecraft dans ton navigateur : images, durées en ticks, GIF, .png.mcmeta pour Java et flipbooks pour Bedrock.',
      label: 'Textures animées',
      blurb: 'Anime n’importe quel bloc ou objet : images, ticks, GIF, .mcmeta et flipbooks.',
    },
    'make-a-custom-totem': {
      title: 'Faire un totem d’immortalité personnalisé – Minecraft',
      h1: 'Comment faire un totem d’immortalité personnalisé',
      description: 'Transforme n’importe quel skin en totem personnalisé pour Java ou Bedrock : le fichier remplacé, des totems avec leur nom, l’installation et les solutions.',
      label: 'Faire un totem personnalisé',
      blurb: 'Transforme n’importe quel skin en totem, ou donne à chaque totem renommé son propre look.',
    },
  },
};
