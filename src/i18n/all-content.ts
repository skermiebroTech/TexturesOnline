// Registers every language's content and short texts (page titles, interface texts) and every
// tool's introduction at once, for the build-time prerender and the unit tests (the running app
// loads one language and one tool introduction at a time, see content.ts, locale-text.ts and
// src/app/content/tools.ts).

import { registerContent } from './content';
import { registerLocaleText } from './locale-text';
import { registerToolIntro } from '../app/content/tools';
import { CONTENT as DE } from './de/content';
import { CONTENT as ES } from './es/content';
import { CONTENT as PT_BR } from './pt-br/content';
import { CONTENT as JA } from './ja/content';
import { CONTENT as RU } from './ru/content';
import { CONTENT as FR } from './fr/content';
import { CONTENT as PL } from './pl/content';
import { TEXT as DE_TEXT } from './de/text';
import { TEXT as ES_TEXT } from './es/text';
import { TEXT as PT_BR_TEXT } from './pt-br/text';
import { TEXT as JA_TEXT } from './ja/text';
import { TEXT as RU_TEXT } from './ru/text';
import { TEXT as FR_TEXT } from './fr/text';
import { TEXT as PL_TEXT } from './pl/text';
import { INTRO as TEXTURES } from '../app/content/intros/textures';
import { INTRO as PAINTING } from '../app/content/intros/painting';
import { INTRO as GUI } from '../app/content/intros/gui';
import { INTRO as DISC } from '../app/content/intros/disc';
import { INTRO as GLINT } from '../app/content/intros/glint';
import { INTRO as CONVERTER } from '../app/content/intros/converter';
import { INTRO as MERGE } from '../app/content/intros/merge';
import { INTRO as DOCTOR } from '../app/content/intros/doctor';
import { INTRO as TOTEM } from '../app/content/intros/totem';
import { INTRO as FONTS } from '../app/content/intros/fonts';
import { INTRO as SKINS } from '../app/content/intros/skins';
import { INTRO as SKINPACK } from '../app/content/intros/skinpack';
import { INTRO as CAPE } from '../app/content/intros/cape';
import { INTRO as SHADERS } from '../app/content/intros/shaders';

registerContent('de', DE);
registerContent('es', ES);
registerContent('pt-br', PT_BR);
registerContent('ja', JA);
registerContent('ru', RU);
registerContent('fr', FR);
registerContent('pl', PL);

registerLocaleText('de', DE_TEXT);
registerLocaleText('es', ES_TEXT);
registerLocaleText('pt-br', PT_BR_TEXT);
registerLocaleText('ja', JA_TEXT);
registerLocaleText('ru', RU_TEXT);
registerLocaleText('fr', FR_TEXT);
registerLocaleText('pl', PL_TEXT);

registerToolIntro('textures', TEXTURES);
registerToolIntro('painting', PAINTING);
registerToolIntro('gui', GUI);
registerToolIntro('disc', DISC);
registerToolIntro('glint', GLINT);
registerToolIntro('converter', CONVERTER);
registerToolIntro('merge', MERGE);
registerToolIntro('doctor', DOCTOR);
registerToolIntro('totem', TOTEM);
registerToolIntro('fonts', FONTS);
registerToolIntro('skins', SKINS);
registerToolIntro('skinpack', SKINPACK);
registerToolIntro('cape', CAPE);
registerToolIntro('shaders', SHADERS);
