// French text of the colour swap (English source: ./text.ts).

import type { SwapLanguage } from './load';

const FR: SwapLanguage = {
  'textures.swap': {
    button: 'Remplacer une couleur',
    buttonHint: 'Remplacer une couleur par une autre dans cette texture, la sélection ou tout le pack',
    title: 'Remplacer une couleur',
    from: 'Couleur à remplacer',
    to: 'Nouvelle couleur',
    exchange: 'Échanger les deux couleurs',
    pickFrom: 'Prends-la dans cette texture :',
    tolerance: 'Couleurs proches',
    toleranceHint: 'Prend aussi les couleurs aussi proches. Chacune garde sa petite différence, l’ombrage à l’intérieur reste donc.',
    ramp: 'Remplacer toute la gamme de nuances',
    rampHint: 'Ses nuances plus sombres et plus claires dans cette texture suivent, en gardant leur décalage de teinte.',
    rampShades: '{count, plural, one {# nuance} other {# nuances}}',
    where: 'Où',
    scope: {
      texture: 'Cette texture',
      selection: 'Sélection',
      pack: 'Tout le pack',
    },
    layersNote: 'Tous les calques déverrouillés de la texture changent.',
    selectionNote: 'Seule la zone sélectionnée du calque sur lequel tu peins change.',
    before: 'Avant',
    after: 'Après',
    pixels: '{count, plural, =0 {Aucun pixel ne change} one {# pixel change} other {# pixels changent}}',
    packNote: 'Les textures de ton pack qui utilisent cette couleur :',
    gameToo: 'Chercher aussi dans les textures du jeu (plus lent)',
    searching: 'Recherche dans {done} textures sur {total}…',
    none: 'Aucune texture n’utilise cette couleur.',
    rowPixels: '{count, plural, one {# pixel} other {# pixels}}',
    include: 'Changer {name}',
    apply: 'Remplacer',
    applyCount: '{count, plural, one {Remplacer dans # texture} other {Remplacer dans # textures}}',
    done: 'Couleur remplacée dans {name}',
    doneMany: '{count, plural, one {Couleur remplacée dans # texture} other {Couleur remplacée dans # textures}}',
    nothing: 'Rien à remplacer : aucun pixel n’a cette couleur.',
    locked: 'Le calque sur lequel tu peins est verrouillé ou masqué.',
  },
};

/** Rightly the same as in English ("pixel" is a French word too). */
export const SAME_AS_ENGLISH = ['textures.swap:rowPixels'];

export default FR;
