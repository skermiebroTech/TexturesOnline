// French text of project files and backups (English source: ./text.ts).

import type { ProjectFileLanguage } from './load';

const FR: ProjectFileLanguage = {
  'shared.projectFile': {
    saved: '{file} enregistré. Ouvre-le ici quand tu veux pour continuer à le modifier.',
    saveFailed: 'Impossible d’enregistrer le fichier projet.',
    opened: '« {name} » ouvert',
    openedCopy: '« {name} » ouvert en copie. Celui que tu avais déjà n’a pas changé.',
    copyName: '{name} (copie)',
    untitled: 'Sans titre',
    errors: {
      notZip: 'Ce n’est pas un fichier projet. Les fichiers projet finissent par .tpmproject ou .tpmbackup.',
      notProject: 'Ce n’est pas un fichier projet de Texture Pack Maker. Pour ouvrir un pack, utilise « Ouvrir un pack » dans l’Éditeur de packs de textures.',
      damaged: 'Ce fichier projet est endommagé et ne peut pas être ouvert.',
      newer: 'Ce fichier a été enregistré par une version plus récente de Texture Pack Maker (format {version}). Recharge la page pour la mettre à jour, puis ouvre-le à nouveau.',
      empty: 'Ce fichier ne contient aucun projet.',
      item: '« {name} » est endommagé et a été laissé de côté.',
    },
    types: {
      texturepack: 'Pack de textures',
      skin: 'Skin',
      shader: 'Shader',
      cape: 'Cape',
      font: 'Police',
    },
    counts: {
      texturepack: '{count, plural, one {# pack de textures} other {# packs de textures}}',
      skin: '{count, plural, one {# skin} other {# skins}}',
      shader: '{count, plural, one {# shader} other {# shaders}}',
      cape: 'Ta cape',
      font: 'Ta police',
    },
    backup: {
      title: 'Sauvegarder tes projets',
      intro: 'Un seul fichier avec tous les projets de ce navigateur. Garde-le en lieu sûr, ou ouvre-le dans un autre navigateur ou sur un autre appareil pour tout y retrouver.',
      none: 'Il n’y a encore aucun projet dans ce navigateur.',
      contains: 'Dans la sauvegarde',
      gameFiles: 'Les fichiers du jeu ne sont pas inclus : ils se téléchargent à nouveau depuis Mojang quand tu ouvres un projet.',
      download: 'Télécharger la sauvegarde',
      done: 'Sauvegarde enregistrée : {file}',
      failed: 'Impossible de créer la sauvegarde.',
    },
    restore: {
      title: 'Restaurer une sauvegarde',
      intro: 'Enregistrée le {date}. Choisis ce que tu veux ramener dans ce navigateur.',
      choose: 'Projets',
      already: 'Déjà là',
      existing: 'Déjà dans ce navigateur',
      skip: 'Ignorer',
      keepBoth: 'Garder les deux',
      skipNote: 'Gardé tel qu’il est dans ce navigateur',
      copyNote: 'Restauré en copie à côté du tien',
      replaceNote: 'Remplace celui de ce navigateur',
      selectAll: 'Tout sélectionner',
      selectNone: 'Ne rien sélectionner',
      restore: '{count, plural, =0 {Restaurer} one {Restaurer # projet} other {Restaurer # projets}}',
      done: '{count, plural, one {# projet restauré} other {# projets restaurés}}',
      failed: 'Impossible de restaurer « {name} ».',
      edited: 'Modifié {date}',
    },
    replace: {
      capeTitle: 'Remplacer ta cape ?',
      capeText: 'Le Créateur de capes garde une seule cape à la fois : ouvrir « {name} » remplace celle sur laquelle tu travailles. Enregistre-la d’abord comme fichier projet si tu veux la garder.',
      saveFirst: 'Enregistrer l’actuelle d’abord',
      replace: 'Remplacer',
    },
  },
};

/** Rightly the same as in English (the French pages say "un skin", "un shader"). */
export const SAME_AS_ENGLISH = ['shared.projectFile:counts.skin', 'shared.projectFile:counts.shader'];

export default FR;
