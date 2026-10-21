// Registers every language's content at once, for the build-time prerender and the unit tests
// (the running app loads one language at a time, see content.ts).

import { registerContent } from './content';
import { CONTENT as DE } from './de/content';
import { CONTENT as ES } from './es/content';
import { CONTENT as PT_BR } from './pt-br/content';
import { CONTENT as JA } from './ja/content';
import { CONTENT as RU } from './ru/content';

registerContent('de', DE);
registerContent('es', ES);
registerContent('pt-br', PT_BR);
registerContent('ja', JA);
registerContent('ru', RU);
