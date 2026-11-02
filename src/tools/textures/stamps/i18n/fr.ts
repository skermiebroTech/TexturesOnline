// French text of the stamp tool (English source: ./text.ts).

import type { StampsLanguage } from './load';

const FR: StampsLanguage = {
  'textures.stamps': {
    choose: 'Choisir un tampon',
    current: 'Tampon : {name}',
    title: 'Tampons',
    presets: 'Tout prêts',
    presetsHint: 'Les tampons tout prêts sont dessinés dans des nuances de ta couleur principale.',
    yours: 'Tes tampons',
    none: 'Tu n’as pas encore de tampons à toi. Sélectionne une zone et enregistre-la comme tampon.',
    names: {
      ore: 'Points de minerai',
      cracks: 'Fissures',
      moss: 'Mousse',
      dither: 'Tramage',
      sparkles: 'Étincelles',
      pebbles: 'Cailloux',
    },
    stampName: 'Tampon {n}',
    size: '{width} × {height}',
    save: 'Enregistrer la sélection comme tampon',
    saveHint: 'Sélectionne d’abord une zone (jusqu’à 32 × 32 pixels)',
    saved: '« {name} » enregistré comme tampon.',
    tooBig: 'Les tampons font au maximum 32 × 32 pixels. Sélectionne une zone plus petite.',
    empty: 'La sélection n’a aucun pixel pour faire un tampon.',
    delete: 'Supprimer « {name} »',
    deleted: '« {name} » supprimé.',
    undo: 'Annuler',
    rotate: 'Tourner le tampon (R)',
    rotateTouch: 'Tourner le tampon',
    flipH: 'Retourner le tampon de gauche à droite (H)',
    flipHTouch: 'Retourner le tampon de gauche à droite',
    flipV: 'Retourner le tampon de haut en bas (Maj + H)',
    flipVTouch: 'Retourner le tampon de haut en bas',
    hint: 'Clique pour tamponner. Maintiens et fais glisser pour le placer d’abord, puis relâche. Le clic droit tamponne sa forme avec la deuxième couleur.',
    hintTouch: 'Touche pour tamponner. Maintiens et fais glisser pour le placer d’abord, puis lève le doigt.',
    kept: 'Tes tampons sont gardés dans ce navigateur, et ceux enregistrés dans ce pack vont avec son fichier projet.',
  },
};

export default FR;
