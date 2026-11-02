// French privacy policy (see PrivacyText in src/tools/privacy/content.ts).

import { code, ext, link, strong } from '../../app/content/blocks';
import { PUBLISHER, REPO_URL, SITE_NAME } from '../../app/site';
import type { PrivacyText } from '../../tools/privacy/content';

export const PRIVACY: PrivacyText = {
  eyebrow: 'Confidentialité',
  title: 'Politique de confidentialité',
  intro: `${SITE_NAME} est conçu pour que ton travail ne quitte jamais ton appareil. Il n’y a ni comptes, ni pubs, ni pistage. Cette page explique ce que ça veut dire concrètement, pour le site web comme pour l’appli installée.`,
  updated: 'Dernière mise à jour',
  sections: [
    {
      id: 'nothing-uploaded',
      title: 'Rien de ce que tu crées n’est envoyé',
      body: [
        [
          'Chaque outil fonctionne dans ton navigateur. Les packs, skins, shaders et images que tu ouvres, modifies et exportes sont traités sur ton appareil et ne sont envoyés ni à ce site ni à personne d’autre. Les exports (',
          code('.zip'),
          ', ',
          code('.mcpack'),
          ', ',
          code('.png'),
          ') sont créés sur ton appareil et enregistrés directement dans tes téléchargements.',
        ],
      ],
    },
    {
      id: 'no-tracking',
      title: 'Ni comptes, ni pubs, ni pistage',
      body: [
        ['Il n’y a ni inscription ni connexion. Le site n’a ni pubs, ni cookies de pistage, ni traqueurs tiers. Aucune donnée personnelle n’est collectée, vendue ou partagée.'],
        [
          'Pour savoir quelles pages et quels outils sont utilisés, le site compte les visites avec ',
          ext('https://www.cloudflare.com/web-analytics/', 'Cloudflare Web Analytics'),
          '. Ce service n’utilise pas de cookies, ne te suit pas sur d’autres sites et ne crée pas de profil de toi : il note la page, le site d’où tu viens, ton pays et ton type de navigateur et d’appareil. Ce que tu crées n’en fait jamais partie.',
        ],
      ],
    },
    {
      id: 'on-your-device',
      title: 'Ce qui est gardé sur ton appareil',
      body: [
        [
          strong('Tes projets'),
          ' sont enregistrés dans le stockage de ton navigateur (IndexedDB) pour que tu puisses y revenir. ',
          strong('Les fichiers du jeu'),
          ' que tu as téléchargés y sont aussi gardés, pour que les outils marchent hors ligne. ',
          strong('Les réglages'),
          ', comme le thème clair ou sombre, sont gardés dans le stockage local, et les fichiers de l’appli elle-même sont mis en cache pour qu’elle s’ouvre hors ligne.',
        ],
        ['Tout ça reste sur ton appareil. Quand tu supprimes un projet dans l’appli, il disparaît. Pour tout enlever, efface les données de ce site dans les réglages de ton navigateur ou désinstalle l’appli.'],
      ],
    },
    {
      id: 'other-services',
      title: 'Les services auxquels ton navigateur se connecte',
      body: [
        [
          'Quand tu choisis une version du jeu, ton navigateur télécharge ses fichiers directement chez Mojang (',
          code('piston-meta.mojang.com'),
          ', ',
          code('piston-data.mojang.com'),
          ', ',
          code('resources.download.minecraft.net'),
          '). Les fichiers Bedrock viennent du dépôt ',
          ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'),
          ' de Mojang via GitHub et jsDelivr, et la liste des versions Java vient de jsDelivr.',
        ],
        [
          'La liste des sons du jeu et les images de l’écran titre, que le téléchargement Java ne contient pas, viennent du dépôt ',
          ext('https://github.com/misode/mcmeta', 'misode/mcmeta'),
          ' via GitHub et jsDelivr.',
        ],
        ['Si tu cherches le skin d’un joueur avec son pseudo, ce pseudo est envoyé à playerdb.co (ou mc-heads.net) pour trouver le skin, qui est ensuite chargé depuis textures.minecraft.net.'],
        ['Ces services reçoivent les données habituelles d’une requête, comme ton adresse IP, comme n’importe quel site web, et ont leurs propres politiques de confidentialité. Rien de ce que tu as créé ne leur est envoyé.'],
      ],
    },
    {
      id: 'hosting',
      title: 'Hébergement',
      body: [
        [
          'Le site est hébergé sur GitHub Pages. GitHub peut enregistrer des données techniques comme les adresses IP pour faire tourner et protéger son service ; consulte la ',
          ext('https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement', 'déclaration de confidentialité de GitHub'),
          '.',
        ],
      ],
    },
    {
      id: 'app',
      title: 'L’appli installée',
      body: [['L’appli que tu installes depuis ton navigateur ou le Microsoft Store est ce même site web dans sa propre fenêtre. Tout ce que dit cette page s’applique à elle de la même façon.']],
    },
    {
      id: 'children',
      title: 'Enfants',
      body: [[`${SITE_NAME} ne collecte de données personnelles sur personne, enfants compris.`]],
    },
    {
      id: 'contact',
      title: 'Changements et questions',
      body: [
        ['Si cette politique change, cette page sera mise à jour avec une nouvelle date.'],
        [`${SITE_NAME} est fait par ${PUBLISHER.name}. Tu peux poser tes questions en ouvrant un ticket (issue) sur `, ext(`${REPO_URL}/issues`, 'GitHub'), '. Tu en sauras plus sur le projet sur la page ', link('/about', 'À propos'), '.'],
      ],
    },
  ],
};
