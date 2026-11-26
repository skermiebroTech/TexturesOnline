// French texts of the installable-app features (see AppText in src/pwa/text.ts).

import type { AppText } from '../../pwa/text';

export const APP_TEXT_FR: Partial<AppText> = {
  installApp: 'Installer l’appli',
  installTitle: 'Installer Texture Pack Maker',
  installWhy: 'Ouvre-la depuis ton écran d’accueil ou ton bureau comme n’importe quelle autre appli. Elle marche aussi hors ligne.',
  installIos: ['Touche le bouton Partager dans la barre de Safari.', 'Choisis « Sur l’écran d’accueil ».', 'Touche « Ajouter ».'],
  installMacSafari: ['Dans la barre des menus de Safari, choisis Fichier › Ajouter au Dock.', 'Clique sur « Ajouter ».'],
  gotIt: 'Compris',
  installed: 'Texture Pack Maker est installé. Tu le trouveras avec tes autres applis.',
  exportHint: 'Astuce : installe Texture Pack Maker comme une appli pour l’ouvrir depuis ton bureau ou ton écran d’accueil, même hors ligne.',
  install: 'Installer',
  updateReady: 'Une nouvelle version de Texture Pack Maker est prête.',
  reload: 'Recharger',
  cantOpen: 'Texture Pack Maker ne peut pas ouvrir « {name} ». Choisis un pack .zip, .mcpack ou .mcaddon, ou un skin ou une texture en .png.',
  privacy: 'Confidentialité',
};
