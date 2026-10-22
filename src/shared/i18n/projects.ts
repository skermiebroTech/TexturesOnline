// English text of the project file entry points every editor shows (the "Open a project file"
// button on start screens, "Save project file" in the editors). The dialogs behind them have their
// own section (src/shared/project-file/i18n/), which loads with them.
// Translations: src/shared/i18n/<lang>.ts.

import { defineText } from '../../i18n/editor-text';

export const projectsText = defineText('shared.projects', {
  /** Button that picks a .tpmproject or .tpmbackup file */
  open: 'Open a project file',
  /** Short line next to it */
  openHint: 'A .tpmproject or backup saved from this site reopens exactly as you left it.',
  /** Editor button and menu item: downloads the project as a .tpmproject file */
  save: 'Save project file',
  /** Heading of the cape maker's project file row */
  fileTitle: 'Project file',
  /** Tooltip of the editors' save button, and the skin export menu's line under the title */
  saveTip: 'A .tpmproject file to keep a copy or to keep editing on another device',
});

export type ProjectsText = typeof projectsText;
