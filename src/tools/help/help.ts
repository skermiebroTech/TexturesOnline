// Install guides for packs, skins and shaders on every edition, plus FAQ.

import './help.css';
import type { RouteContext } from '../../core/router';
import { isRestoringScroll, parseLocation, replacePath } from '../../core/router';
import { h, prefersReducedMotion, uid, type Child } from '../../ui/dom';
import { icon, type IconName } from '../../ui/icons';
import { badge, tabs } from '../../ui/components';
import { siteFooter } from '../../app/footer';
import { GITHUB_URL } from '../../app/shell';

interface Section {
  id: string;
  title: string;
  short: string;
  icon: IconName;
  accent: string;
  edition?: 'Java' | 'Bedrock' | 'Java & Bedrock';
  body: () => Child[];
}

const path = (...parts: string[]): HTMLElement =>
  h(
    'span',
    { class: 'ui-path' },
    parts.map((p, i) => [i > 0 ? icon('chevron-right', { class: 'ui-path-sep' }) : null, h('span', { class: 'ui-path-item' }, p)]),
  );

const steps = (...items: Child[]): HTMLElement => h('ol', { class: 'guide-steps' }, items.map((it) => h('li', null, h('div', { class: 'guide-step-body' }, it))));

const callout = (tone: 'info' | 'warn' | 'tip', title: string, ...text: Child[]): HTMLElement =>
  h(
    'aside',
    { class: ['callout', `callout-${tone}`] },
    icon(tone === 'warn' ? 'warning-diamond' : tone === 'tip' ? 'sparkle' : 'circle-info'),
    h('div', null, h('div', { class: 'callout-title' }, title), h('p', null, ...text)),
  );

const ext = (href: string, label: string): HTMLElement => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, label);

function tabbed(options: { value: string; label: string; icon?: IconName; content: () => Child[] }[]): HTMLElement {
  const panel = h('div', { class: 'guide-tabpanel', role: 'tabpanel', id: uid('guide-panel'), tabIndex: 0 });
  const t = tabs({ value: options[0].value, tabs: options.map((o) => ({ value: o.value, label: o.label, icon: o.icon })), onChange: (v) => show(v), label: 'Platform' });
  const tabEls = Array.from(t.querySelectorAll<HTMLElement>('[role="tab"]'));
  tabEls.forEach((b) => {
    b.id = uid('guide-tab');
    b.setAttribute('aria-controls', panel.id);
  });
  function show(v: string) {
    const i = Math.max(0, options.findIndex((o) => o.value === v));
    panel.replaceChildren(...(options[i].content().filter(Boolean) as Node[]));
    if (tabEls[i]) panel.setAttribute('aria-labelledby', tabEls[i].id);
  }
  show(options[0].value);
  return h('div', { class: 'guide-tabs' }, t, panel);
}

const folderTable = (sub: string): HTMLElement =>
  h(
    'table',
    { class: 'paths-table' },
    h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'System'), h('th', { scope: 'col' }, 'Folder'))),
    h(
      'tbody',
      null,
      h('tr', null, h('th', { scope: 'row' }, 'Windows'), h('td', null, h('code', null, `%APPDATA%\\.minecraft\\${sub}`))),
      h('tr', null, h('th', { scope: 'row' }, 'macOS'), h('td', null, h('code', null, `~/Library/Application Support/minecraft/${sub}`))),
      h('tr', null, h('th', { scope: 'row' }, 'Linux'), h('td', null, h('code', null, `~/.minecraft/${sub}`))),
    ),
  );

const SECTIONS: Section[] = [
  {
    id: 'java-packs',
    title: 'Texture packs on Java',
    short: 'Java packs',
    icon: 'image',
    accent: 'accent-green',
    edition: 'Java',
    body: () => [
      h('p', { class: 'guide-intro' }, 'Java Edition calls texture packs ', h('em', null, 'resource packs'), '. Your export is a ', h('code', null, '.zip'), ' file — keep it zipped.'),
      steps(
        ['Export your pack from the Texture Pack Maker. You get a file like ', h('code', null, 'My\u00a0Pack.zip'), '.'],
        ['Start Minecraft Java Edition and open ', path('Options…', 'Resource Packs…'), '.'],
        ['Click ', path('Open Pack Folder'), '. This opens the ', h('code', null, 'resourcepacks'), ' folder.'],
        ['Drop the ', h('code', null, '.zip'), ' into that folder. You can also drag it straight onto the Resource Packs screen.'],
        ['Hover your pack in the ', h('strong', null, 'Available'), ' list and click the arrow to move it to ', h('strong', null, 'Selected'), '. Packs higher in the list win. Click ', h('strong', null, 'Done'), '.'],
      ),
      callout(
        'info',
        'Seeing "Made for an older (or newer) version"?',
        'Packs are written for the version you pick in the editor. If you play another version, change the target version or the compatibility range in the ',
        h('strong', null, 'Pack'),
        ' tab and export again. Texture-only packs usually still work — you can click ',
        h('strong', null, 'Yes'),
        ' to use it anyway.',
      ),
      h('h3', { class: 'guide-sub' }, 'Where the folder lives'),
      folderTable('resourcepacks'),
    ],
  },
  {
    id: 'bedrock-packs',
    title: 'Texture packs on Bedrock',
    short: 'Bedrock packs',
    icon: 'gamepad',
    accent: 'accent-green',
    edition: 'Bedrock',
    body: () => [
      h('p', { class: 'guide-intro' }, 'Bedrock packs export as ', h('code', null, '.mcpack'), ' files. Opening one imports it into Minecraft automatically.'),
      tabbed([
        {
          value: 'windows',
          label: 'Windows',
          icon: 'monitor',
          content: () => [
            steps(
              ['Export your pack. You get a file like ', h('code', null, 'My\u00a0Pack.mcpack'), '.'],
              ['Double-click the file. Minecraft opens and shows ', h('em', null, 'Import started…'), ' then ', h('em', null, 'Successfully imported'), '.'],
              ['Go to ', path('Settings', 'Global Resources', 'My Packs'), ', select your pack and press ', h('strong', null, 'Activate'), '.'],
              'Using several packs? Move yours to the top so it wins.',
            ),
          ],
        },
        {
          value: 'mobile',
          label: 'Android & iOS',
          icon: 'smartphone',
          content: () => [
            steps(
              ['Download the ', h('code', null, '.mcpack'), ' on your phone or tablet.'],
              [h('strong', null, 'Android: '), 'open it from your Downloads or Files app and choose ', h('strong', null, 'Minecraft'), '. ', h('strong', null, 'iPhone / iPad: '), 'in the Files app tap the file, then ', path('Share', 'Minecraft'), '.'],
              ['Minecraft imports the pack. Then open ', path('Settings', 'Global Resources'), ' and activate it.'],
            ),
          ],
        },
        {
          value: 'console',
          label: 'Consoles',
          icon: 'gamepad',
          content: () => [
            h(
              'p',
              { class: 'muted' },
              "Xbox, PlayStation and Switch can't import .mcpack files. Add the pack to a world on a PC or phone and join that world, or play on a Realm or server that includes the pack.",
            ),
          ],
        },
      ]),
      callout('tip', 'Only for one world?', 'Instead of Global Resources, open ', path('Edit world', 'Resource Packs'), ' and activate the pack there.'),
      callout(
        'info',
        'Updating a pack you already imported',
        'Each export keeps the same pack ID and raises its version number, so importing again replaces the old copy instead of adding a duplicate.',
      ),
    ],
  },
  {
    id: 'java-skins',
    title: 'Skins on Java',
    short: 'Java skins',
    icon: 'human',
    accent: 'accent-blue',
    edition: 'Java',
    body: () => [
      h('p', { class: 'guide-intro' }, 'Export your skin as a ', h('code', null, '.png'), '. Remember whether you painted the ', h('strong', null, 'Classic'), ' (4 pixel arms) or ', h('strong', null, 'Slim'), ' (3 pixel arms) model.'),
      tabbed([
        {
          value: 'launcher',
          label: 'Minecraft Launcher',
          icon: 'monitor',
          content: () => [
            steps(
              ['Open the Minecraft Launcher and choose ', path('Minecraft: Java Edition', 'Skins'), '.'],
              ['Click ', h('strong', null, 'New skin'), ' (the + card).'],
              ['Name it and pick the player model: ', h('strong', null, 'Classic'), ' or ', h('strong', null, 'Slim'), '.'],
              ['Click ', h('strong', null, 'Browse'), ', choose your PNG, then ', h('strong', null, 'Save & Use'), '.'],
            ),
          ],
        },
        {
          value: 'web',
          label: 'minecraft.net',
          icon: 'globe',
          content: () => [
            steps(
              ['Sign in at ', ext('https://www.minecraft.net/', 'minecraft.net'), ' and open your profile.'],
              ['In the skin section choose the ', h('strong', null, 'Classic'), ' or ', h('strong', null, 'Slim'), ' model.'],
              ['Upload your PNG and confirm. It shows up in game the next time you join a world or server.'],
            ),
          ],
        },
      ]),
      callout('info', 'Playing 1.7.10 or older?', 'Those versions only understand the old 64×32 layout. Use the ', h('strong', null, 'Legacy 64×32'), ' export option.'),
    ],
  },
  {
    id: 'bedrock-skins',
    title: 'Skins on Bedrock',
    short: 'Bedrock skins',
    icon: 'shirt',
    accent: 'accent-blue',
    edition: 'Bedrock',
    body: () => [
      tabbed([
        {
          value: 'pack',
          label: 'Skin pack (.mcpack)',
          icon: 'package',
          content: () => [
            steps(
              ['Export as a ', h('strong', null, 'Bedrock skin pack'), '. You get a ', h('code', null, '.mcpack'), ' file.'],
              'Open the file (double-click on Windows, "Open with Minecraft" on phones and tablets) to import it.',
              ['In Minecraft go to ', path('Dressing Room', 'Classic Skins'), '. Your pack is listed with the imported packs.'],
              ['Pick your skin and press ', h('strong', null, 'Equip'), '.'],
            ),
          ],
        },
        {
          value: 'png',
          label: 'Single PNG',
          icon: 'image',
          content: () => [
            steps(
              ['Export the skin as a ', h('code', null, '.png'), '.'],
              ['Open ', path('Dressing Room', 'Classic Skins'), ' and under ', h('strong', null, 'Owned'), ' select the blank ', h('strong', null, 'Import'), ' slot.'],
              ['Choose your PNG, then pick the classic or slim arm model.'],
            ),
          ],
        },
      ]),
      callout(
        'warn',
        'Friends see a default skin?',
        'Players who have ',
        h('strong', null, 'Only Allow Trusted Skins'),
        ' turned on see custom skins as a default skin. It is their own setting. Consoles cannot import skin files.',
      ),
    ],
  },
  {
    id: 'iris',
    title: 'Shaders with Iris or OptiFine',
    short: 'Iris / OptiFine',
    icon: 'sparkles',
    accent: 'accent-purple',
    edition: 'Java',
    body: () => [
      h('p', { class: 'guide-intro' }, 'Classic shader packs need a shader mod. ', h('strong', null, 'Iris'), ' is the easiest and fastest; OptiFine works too.'),
      tabbed([
        {
          value: 'iris',
          label: 'Iris (recommended)',
          icon: 'sparkles',
          content: () => [
            steps(
              ['Download the Iris Installer from ', ext('https://www.irisshaders.dev/', 'irisshaders.dev'), '. It installs Fabric Loader, Iris and Sodium for your version in one go.'],
              ['Open the Minecraft Launcher, choose the new ', h('strong', null, 'Iris & Sodium'), ' profile and play once.'],
              ['Export your shader pack from the Shader Maker (a ', h('code', null, '.zip'), ' — keep it zipped).'],
              ['In game open ', path('Options…', 'Video Settings…', 'Shader Packs…'), ' and click ', h('strong', null, 'Open Shader Pack Folder'), '. Drop the zip in.'],
              ['Select your pack and click ', h('strong', null, 'Apply'), '. The ', h('strong', null, 'Shader Pack Settings'), ' button lets you fine-tune options in game.'],
            ),
          ],
        },
        {
          value: 'optifine',
          label: 'OptiFine',
          icon: 'gear',
          content: () => [
            steps(
              ['Install OptiFine for your Minecraft version from ', ext('https://optifine.net/', 'optifine.net'), ' and play the OptiFine profile once.'],
              ['Open ', path('Options…', 'Video Settings…', 'Shaders…'), ' and click ', h('strong', null, 'Shaders Folder'), '.'],
              'Drop your exported zip into the folder, then select it in the list.',
            ),
          ],
        },
      ]),
      h('h3', { class: 'guide-sub' }, 'Shader pack folder'),
      folderTable('shaderpacks'),
    ],
  },
  {
    id: 'vanilla-shaders',
    title: 'Vanilla shaders (no mods)',
    short: 'Vanilla shaders',
    icon: 'sun',
    accent: 'accent-purple',
    edition: 'Java',
    body: () => [
      h('p', { class: 'guide-intro' }, 'These work in the normal game because they are a ', h('strong', null, 'resource pack'), ' that replaces some of Minecraft’s own shader files.'),
      steps(
        ['Export with the ', h('strong', null, 'Vanilla Java'), ' target. You get a ', h('code', null, '.zip'), ' resource pack.'],
        ['Install it like a texture pack: ', path('Options…', 'Resource Packs…', 'Open Pack Folder'), ', drop the zip in.'],
        'Move it to Selected and click Done. The new look applies straight away.',
      ),
      callout(
        'warn',
        'Made for one exact version',
        'Mojang changes the shader files often, so a vanilla shader pack only works on the version it was made for. After updating Minecraft, open your project, pick the new version and export again.',
      ),
    ],
  },
  {
    id: 'vibrant-visuals',
    title: 'Vibrant Visuals on Bedrock',
    short: 'Vibrant Visuals',
    icon: 'cloud-sun',
    accent: 'accent-purple',
    edition: 'Bedrock',
    body: () => [
      h('p', { class: 'guide-intro' }, 'Bedrock "shaders" are Vibrant Visuals settings packs: lighting, sky, colour grading, water and fog.'),
      steps(
        ['Export your pack (', h('code', null, '.mcpack'), ') and open the file to import it.'],
        ['Go to ', path('Settings', 'Global Resources', 'My Packs'), ' and activate it.'],
        ['Open ', path('Settings', 'Video'), ' and set ', h('strong', null, 'Graphics Mode'), ' to ', h('strong', null, 'Vibrant Visuals'), '.'],
      ),
      callout(
        'warn',
        "Can't choose Vibrant Visuals?",
        'Minecraft only allows it when every active pack supports it. Classic texture packs (including the ones you make in the Texture Pack Maker) switch it off, so deactivate other packs while you use this one. Some servers also turn it off.',
      ),
      callout(
        'info',
        'Needs a supported device',
        'Vibrant Visuals runs on Windows PCs with DirectX 12, Xbox and PlayStation (on Xbox One and PS4 it starts switched off), iPhone and iPad with an A12 chip or newer, and many recent Android devices. It is not available on the original Nintendo Switch, Chromebooks or Fire tablets. ',
        h('strong', null, 'Customize classic fog'),
        ' also works in the other graphics modes.',
      ),
    ],
  },
  {
    id: 'folders',
    title: 'Finding your Minecraft folder',
    short: 'Folders',
    icon: 'folder',
    accent: 'accent-gold',
    edition: 'Java & Bedrock',
    body: () => [
      h('p', { class: 'guide-intro' }, 'The quickest way is the ', h('strong', null, 'Open Pack Folder'), ' button in Minecraft. If you need the path:'),
      h(
        'table',
        { class: 'paths-table' },
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'What'), h('th', { scope: 'col' }, 'Where'))),
        h(
          'tbody',
          null,
          h('tr', null, h('th', { scope: 'row' }, 'Java on Windows'), h('td', null, h('code', null, '%APPDATA%\\.minecraft'))),
          h('tr', null, h('th', { scope: 'row' }, 'Java on macOS'), h('td', null, h('code', null, '~/Library/Application Support/minecraft'))),
          h('tr', null, h('th', { scope: 'row' }, 'Java on Linux'), h('td', null, h('code', null, '~/.minecraft'))),
          h('tr', null, h('th', { scope: 'row' }, 'Game files (.jar)'), h('td', null, h('code', null, '.minecraft/versions/<version>/<version>.jar'))),
          h('tr', null, h('th', { scope: 'row' }, 'Bedrock on Windows'), h('td', null, h('code', null, '%APPDATA%\\Minecraft Bedrock\\users\\shared\\games\\com.mojang'))),
        ),
      ),
      h('p', { class: 'muted small' }, 'On Windows, paste the path into the File Explorer address bar or the Run box (Win + R).'),
    ],
  },
];

const FAQ: { id: string; q: string; a: () => Child[] }[] = [
  {
    id: 'vanilla-source',
    q: 'Where do the vanilla textures come from?',
    a: () => [
      h(
        'p',
        null,
        "When you start a Java project, your browser downloads the official game file for that version straight from Mojang's servers and keeps only the textures, models and shaders on this device. Bedrock textures come from Mojang's official ",
        ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'),
        ' repository on GitHub.',
      ),
      h('p', null, 'Nothing from Mojang is stored in TexturesOnline itself — it is a static website with no servers of its own.'),
    ],
  },
  {
    id: 'upload',
    q: 'Is anything uploaded?',
    a: () => [
      h(
        'p',
        null,
        'No. Your projects, images and exported packs never leave your device. The app only downloads things: game files from Mojang, the list of versions, and skins you look up by username.',
      ),
    ],
  },
  {
    id: 'offline',
    q: 'Does it work offline?',
    a: () => [
      h(
        'p',
        null,
        "Yes, after the first load. The app and every version you have already opened stay on this device, so you can keep editing without internet. A version you haven't used yet needs a connection — or choose ",
        h('strong', null, 'Use my own .jar'),
        ' and pick it from your ',
        h('code', null, '.minecraft/versions'),
        ' folder.',
      ),
    ],
  },
  {
    id: 'storage',
    q: 'Where are my projects saved?',
    a: () => [
      h(
        'p',
        null,
        "In your browser's storage on this device. They stay until you delete them or clear this site's data. To back up a project or move it to another computer, export it and open the file there with ",
        h('strong', null, 'Open existing pack'),
        '.',
      ),
    ],
  },
  {
    id: 'versions',
    q: 'Which Minecraft versions are supported?',
    a: () => [
      h(
        'p',
        null,
        'Java 26.3 is the default, and every Java release back to 1.6.1 (when resource packs were introduced) works — snapshots too if you switch them on. For Bedrock you can use the latest release, the latest preview and older versions.',
      ),
    ],
  },
  {
    id: 'phone',
    q: 'Can I use it on a phone or tablet?',
    a: () => [h('p', null, 'Yes. Every tool works with touch, including pinch-to-zoom in the pixel editors. A bigger screen is more comfortable for detailed pixel art.')],
  },
  {
    id: 'official',
    q: 'Is this free? Is it official?',
    a: () => [
      h('p', null, 'It is free and open source under the MIT licence.'),
      h('p', null, 'TexturesOnline is not an official Minecraft product and is not approved by or associated with Mojang or Microsoft.'),
    ],
  },
  {
    id: 'bug',
    q: 'Something went wrong. How do I report it?',
    a: () => [h('p', null, 'Please open an issue on ', ext(`${GITHUB_URL}/issues`, 'GitHub'), ' with your browser, the game version and what you were doing. Screenshots help a lot.')],
  },
];

export default function help(root: HTMLElement, ctx: RouteContext): () => void {
  root.classList.add('help');
  const tocLinks = new Map<string, HTMLAnchorElement>();
  const allIds = [...SECTIONS.map((s) => s.id), 'faq'];

  const behavior = (smooth: boolean): ScrollBehavior => (smooth && !prefersReducedMotion() ? 'smooth' : ('instant' as ScrollBehavior));

  // The URL is kept in sync through the router so links to the current section still work.
  const jump = (id: string, smooth = true) => {
    const target = document.getElementById(`help-${id}`);
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - 88;
    window.scrollTo({ top, behavior: behavior(smooth) });
    replacePath(`/help?s=${id}`);
    setActive(id);
  };

  const openFaq = (id: string, smooth = true) => {
    const d = document.getElementById(`faq-${id}`) as HTMLDetailsElement | null;
    if (!d) return;
    d.open = true;
    d.scrollIntoView({ block: 'center', behavior: behavior(smooth) });
    replacePath(`/help?s=${id}`);
    setActive('faq');
  };

  const tocItem = (id: string, label: string, ic: IconName, accent: string) => {
    const a = h('a', { class: ['toc-link', accent], href: `#/help?s=${id}` }, icon(ic), h('span', null, label));
    tocLinks.set(id, a);
    return a;
  };

  const toc = h(
    'nav',
    { class: 'help-toc', 'aria-label': 'On this page' },
    h('div', { class: 'section-title' }, 'On this page'),
    h('div', { class: 'toc-group' }, h('span', { class: 'toc-label' }, 'Texture packs'), tocItem('java-packs', 'Java', 'image', 'accent-green'), tocItem('bedrock-packs', 'Bedrock', 'gamepad', 'accent-green')),
    h('div', { class: 'toc-group' }, h('span', { class: 'toc-label' }, 'Skins'), tocItem('java-skins', 'Java', 'human', 'accent-blue'), tocItem('bedrock-skins', 'Bedrock', 'shirt', 'accent-blue')),
    h(
      'div',
      { class: 'toc-group' },
      h('span', { class: 'toc-label' }, 'Shaders'),
      tocItem('iris', 'Iris / OptiFine', 'sparkles', 'accent-purple'),
      tocItem('vanilla-shaders', 'Vanilla (no mods)', 'sun', 'accent-purple'),
      tocItem('vibrant-visuals', 'Vibrant Visuals', 'cloud-sun', 'accent-purple'),
    ),
    h('div', { class: 'toc-group' }, h('span', { class: 'toc-label' }, 'More'), tocItem('folders', 'Folders', 'folder', 'accent-gold'), tocItem('faq', 'FAQ', 'circle-question', 'accent-gold')),
  );

  const setActive = (id: string) => {
    tocLinks.forEach((a, key) => {
      if (key === id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  };

  const sections = SECTIONS.map((s) =>
    h(
      'section',
      { class: ['help-section', s.accent], id: `help-${s.id}`, tabIndex: -1, 'aria-labelledby': `help-${s.id}-title` },
      h(
        'header',
        { class: 'help-section-head' },
        h('span', { class: 'help-section-icon' }, icon(s.icon)),
        h('h2', { id: `help-${s.id}-title` }, s.title),
        s.edition ? badge(s.edition, s.edition === 'Java' ? 'green' : s.edition === 'Bedrock' ? 'blue' : 'gold') : null,
      ),
      h('div', { class: 'help-section-body' }, s.body()),
    ),
  );

  const faq = h(
    'section',
    { class: 'help-section accent-gold', id: 'help-faq', tabIndex: -1, 'aria-labelledby': 'help-faq-title' },
    h('header', { class: 'help-section-head' }, h('span', { class: 'help-section-icon' }, icon('circle-question')), h('h2', { id: 'help-faq-title' }, 'Frequently asked questions')),
    h(
      'div',
      { class: 'faq-list' },
      FAQ.map((f, i) =>
        h(
          'details',
          { class: 'faq-item', id: `faq-${f.id}`, open: i === 0 },
          h('summary', null, h('span', null, f.q), icon('chevron-down', { class: 'faq-chev' })),
          h('div', { class: 'faq-answer' }, f.a()),
        ),
      ),
    ),
  );

  const quick = h(
    'div',
    { class: 'help-quick' },
    [
      { id: 'java-packs', label: 'Install a texture pack', icon: 'image' as IconName, accent: 'accent-green' },
      { id: 'java-skins', label: 'Change your skin', icon: 'human' as IconName, accent: 'accent-blue' },
      { id: 'iris', label: 'Use a shader pack', icon: 'sparkles' as IconName, accent: 'accent-purple' },
      { id: 'faq', label: 'Questions', icon: 'circle-question' as IconName, accent: 'accent-gold' },
    ].map((q) =>
      h('a', { class: ['help-quick-card', q.accent], href: `#/help?s=${q.id}` }, h('span', { class: 'help-quick-icon' }, icon(q.icon)), h('span', null, q.label), icon('arrow-right', { class: 'help-quick-go' })),
    ),
  );

  root.append(
    h(
      'header',
      { class: 'help-hero container' },
      h('span', { class: 'eyebrow' }, icon('book-open'), 'Install guide & help'),
      h('h1', { class: 'pixel-shadow' }, 'Get your creations into Minecraft'),
      h('p', { class: 'lead' }, 'Step-by-step guides for Java and Bedrock on every platform, plus answers to common questions.'),
      quick,
    ),
    h('div', { class: 'container help-layout' }, toc, h('div', { class: 'help-content' }, sections, faq)),
    siteFooter(),
  );

  // Highlight the section being read
  const visible = new Map<string, number>();
  const io =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(
          (entries) => {
            for (const en of entries) {
              const id = (en.target as HTMLElement).id.replace(/^help-/, '');
              if (en.isIntersecting) visible.set(id, en.boundingClientRect.top);
              else visible.delete(id);
            }
            const first = allIds.find((id) => visible.has(id));
            if (first) setActive(first);
          },
          { rootMargin: '-96px 0px -55% 0px' },
        )
      : null;
  [...sections, faq].forEach((s) => io?.observe(s));

  // In-page links (table of contents, quick cards, footer) scroll instead of re-rendering the page.
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.('a[href^="#/help"]');
    if (!a) return;
    const { path, query } = parseLocation(a.getAttribute('href') ?? '');
    if (path !== '/help') return;
    e.preventDefault();
    const s = query.get('s');
    if (s && allIds.includes(s)) {
      jump(s);
      document.getElementById(`help-${s}`)?.focus({ preventScroll: true });
    } else if (s && FAQ.some((f) => f.id === s)) {
      openFaq(s);
    } else {
      window.scrollTo({ top: 0, behavior: behavior(true) });
      replacePath('/help');
      setActive(allIds[0]);
    }
  };
  root.addEventListener('click', onClick);

  const initial = ctx.query.get('s');
  setActive(initial && allIds.includes(initial) ? initial : allIds[0]);
  if (isRestoringScroll()) {
    // back/forward: the router puts the page back where the reader left it
  } else if (initial && allIds.includes(initial)) {
    requestAnimationFrame(() => requestAnimationFrame(() => jump(initial, false)));
  } else if (initial && FAQ.some((f) => f.id === initial)) {
    requestAnimationFrame(() => openFaq(initial, false));
  }

  return () => {
    io?.disconnect();
    root.removeEventListener('click', onClick);
  };
}
