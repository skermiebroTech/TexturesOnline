// French About page (see AboutText in src/tools/about/content.ts).

import { el } from '../../app/markup';
import { code, ext, link, strong } from '../../app/content/blocks';
import { PUBLISHER, REPO_URL } from '../../app/site';
import { F, LATEST } from '../../app/content/facts';
import type { AboutText } from '../../tools/about/content';

export const ABOUT: AboutText = {
  differences: [
    {
      title: 'Toutes les versions de Java depuis la 1.6.1',
      text: [`Pas seulement la dernière : crée un pack pour ${LATEST}, 1.21.11, 1.20.1 ou 1.8.9, chacune avec ses textures et le bon pack.mcmeta.`],
    },
    {
      title: 'Java et Bedrock, et un convertisseur',
      text: ['Crée des packs pour l’une ou l’autre édition et transforme un pack Java en pack Bedrock, ou l’inverse, avec le ', link('/texture-pack-converter', 'convertisseur de packs de textures'), '.'],
    },
    {
      title: 'Textures, skins et shaders',
      text: ['Un seul site pour les packs de textures, les skins et packs de skins, et les shaders pour Iris, OptiFine, Java vanilla et les Graphismes éclatants de Bedrock.'],
    },
    {
      title: 'Rien n’est envoyé',
      text: ['Tout fonctionne dans ton navigateur. Les fichiers du jeu viennent directement de Mojang et ton travail reste sur ton appareil.'],
    },
    {
      title: 'Gratuit et open source',
      text: ['Pas de compte, pas de pub et pas d’offre payante. Le code est public sous licence MIT sur ', ext(REPO_URL, 'GitHub'), '.'],
    },
    {
      title: 'Marche hors ligne',
      text: ['Après la première visite, l’appli et les fichiers du jeu que tu as utilisés sont gardés sur ton appareil : elle continue donc de marcher sans connexion.'],
    },
  ],
  faq: [
    {
      id: 'who',
      q: 'Qui fait Texture Pack Maker ?',
      a: [el('p', null, `Texture Pack Maker est fait par ${PUBLISHER.name}, un créateur indépendant. C’est un outil fait par des fans, sans lien avec Mojang ni Microsoft.`)],
    },
    {
      id: 'cost',
      q: 'Est-ce que c’est payant ?',
      a: [el('p', null, 'Non. Tous les outils sont gratuits, sans compte, sans pub et sans limite de packs.')],
    },
    {
      id: 'files',
      q: 'D’où viennent les textures de Minecraft ?',
      a: [
        el(
          'p',
          null,
          'Ton navigateur les télécharge chez Mojang quand tu choisis une version : les textures Java viennent des fichiers officiels du jeu, et celles de Bedrock du dépôt ',
          ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'),
          ' de Mojang. Elles sont gardées sur ton appareil, jamais sur ce site.',
        ),
      ],
    },
    {
      id: 'contact',
      q: 'Comment signaler un bug ou proposer une idée ?',
      a: [el('p', null, 'Ouvre un ticket (issue) sur ', ext(`${REPO_URL}/issues`, 'GitHub'), '. Précise l’outil, l’édition et la version que tu utilisais.')],
    },
  ],
  eyebrow: 'À propos',
  title: 'À propos de Texture Pack Maker',
  intro: `Texture Pack Maker est un site gratuit et open source pour créer des packs de textures, des skins et des shaders Minecraft dans le navigateur, pour Java Edition (${LATEST} et toutes les versions jusqu’à la 1.6.1) et Bedrock Edition. Il est fait par ${PUBLISHER.name}.`,
  differentTitle: 'Ce qui rend Texture Pack Maker différent',
  toolsTitle: 'Les outils',
  tools: [
    [link('/textures', 'Créateur de packs de textures'), ' : repeins n’importe quel bloc, objet ou créature sur son modèle 3D, importe tes propres images, change les sons, change le style de tout le pack en un clic ou ouvre un pack existant.'],
    [link('/texture-pack-converter', 'Convertisseur de packs de textures'), ' : de Java vers Bedrock, de Bedrock vers Java, entre versions de Java ou de textures PNG vers un .mcpack.'],
    [link('/merge-texture-packs', 'Fusion de packs de textures'), ' : réunis jusqu’à huit packs en un seul, dans l’ordre que tu choisis.'],
    [link('/pack-doctor', 'Pack Doctor'), ' : découvre pourquoi un pack Java ou Bedrock ne marche pas dans le jeu et répare-le en un clic.'],
    [link('/totem-maker', 'Créateur de totems'), ' : transforme n’importe quel skin en totem d’immortalité personnalisé, en pack de ressources pour Java ou Bedrock.'],
    [link('/font-maker', 'Créateur de polices'), ' : dessine une police en pixels ou convertis un fichier de police, regarde-la dans le tchat, sur les pancartes et dans les livres, puis télécharge-la en pack de ressources.'],
    [link('/skins', 'Éditeur de skins'), ' et ', link('/skin-pack-maker', 'créateur de packs de skins'), ' : peins des skins en 2D ou en 3D avec des bras classiques ou fins et réunis-les dans un pack de skins Bedrock.'],
    [link('/cape-maker', 'Créateur de capes'), ' : peins une cape et des élytres en 3D sur le modèle 64×32 et télécharge le PNG ou un pack de textures d’élytres.'],
    [link('/shaders', 'Créateur de shaders'), ' : packs de shaders pour Iris et OptiFine, shaders vanilla de Java qui n’ont besoin d’aucun mod et packs Graphismes éclatants pour Bedrock.'],
    [link('/guides', 'Guides'), ' : comment créer, installer et réparer des packs, et le format de pack de chaque version de Java.'],
  ],
  howTitle: 'Comment ça marche',
  how: [
    'Quand tu choisis une version du jeu, ton navigateur télécharge les textures de cette version directement chez Mojang et les garde sur ton appareil. Tes projets sont aussi enregistrés dans le navigateur (IndexedDB), et les exports sont créés sur ton appareil : un ',
    code('.zip'),
    ' Java avec le bon ',
    code('pack.mcmeta'),
    ` (Java ${LATEST} utilise le pack format ${F(LATEST)}) ou un `,
    code('.mcpack'),
    ' Bedrock avec un ',
    code('manifest.json'),
    '. Rien de ce que tu fais n’est envoyé à un serveur.',
  ],
  makerTitle: 'Qui le fait',
  maker: ['Texture Pack Maker est fait par ', strong(PUBLISHER.name), '. Le code source est public : tout le monde peut voir comment il marche, proposer des changements ou signaler des problèmes.'],
  notOfficial: 'Ce n’est pas un produit officiel de Minecraft. Il n’est ni approuvé par Mojang ou Microsoft, ni associé à eux.',
  questions: 'Questions fréquentes',
};
