// The three things the Shader Maker can build: what each one is, what it needs and how to install
// it. How the final pack files are put together is in ./build.ts (loaded with the export dialog).

import type { Edition, ShaderTarget } from '../../core/types';
import type { IconName } from '../../ui/icons';
import { DEFAULT_JAVA_VERSION } from '../../editions/versions';
import { loadGenerator, type AnyGenerator } from './ui/generator';
import { t, type ShadersText } from './i18n/text';

export interface InstallStep {
  text: string;
  /** Menu path shown as "A > B > C" */
  path?: string[];
}

export interface ShaderTargetInfo {
  id: ShaderTarget;
  name: string;
  shortName: string;
  edition: Edition;
  needsMods: boolean;
  icon: IconName;
  tagline: string;
  /** Who it is for, one line */
  bestFor: string;
  gets: string[];
  limits: string[];
  install: InstallStep[];
  fileExt: '.zip' | '.mcpack';
  /** Where the file goes, in words */
  installPlace: string;
  /** Section id on the help page */
  helpSection: string;
  /** Preset + time of day used for the start-screen picture */
  showcase: { preset: string; timeOfDay: number };
  /** Label for the "before" side of the compare button */
  compareLabel: string;
  defaultVersion: string;
  load(): Promise<AnyGenerator>;
}

type TargetTextKey = keyof ShadersText['targets'];

/** A target whose words come from the start screen's text section (read when shown, so they follow the language). */
function target(
  k: TargetTextKey,
  fixed: Pick<ShaderTargetInfo, 'id' | 'edition' | 'needsMods' | 'icon' | 'fileExt' | 'helpSection' | 'showcase' | 'defaultVersion' | 'load'>,
  install: () => InstallStep[],
): ShaderTargetInfo {
  const tx = () => t.targets[k];
  return {
    ...fixed,
    get name() {
      return tx().name;
    },
    get shortName() {
      return tx().shortName;
    },
    get tagline() {
      return tx().tagline;
    },
    get bestFor() {
      return tx().bestFor;
    },
    get gets() {
      return Object.values(tx().gets);
    },
    get limits() {
      return Object.values(tx().limits);
    },
    get install() {
      return install();
    },
    get installPlace() {
      return tx().installPlace;
    },
    get compareLabel() {
      return tx().compareLabel;
    },
  };
}

export const TARGETS: readonly ShaderTargetInfo[] = [
  target(
    'iris',
    {
      id: 'iris',
      edition: 'java',
      needsMods: true,
      icon: 'sparkles',
      fileExt: '.zip',
      helpSection: 'iris',
      showcase: { preset: 'golden', timeOfDay: 11600 },
      defaultVersion: DEFAULT_JAVA_VERSION,
      load: () => loadGenerator('iris'),
    },
    () => {
      const x = t.targets.iris.install;
      return [{ text: x.iris }, { text: x.folder, path: Object.values(t.paths.shaderFolder) }, { text: x.apply }];
    },
  ),
  target(
    'vanilla',
    {
      id: 'java-vanilla',
      edition: 'java',
      needsMods: false,
      icon: 'sun',
      fileExt: '.zip',
      helpSection: 'vanilla-shaders',
      showcase: { preset: 'vivid', timeOfDay: 4200 },
      defaultVersion: DEFAULT_JAVA_VERSION,
      load: () => loadGenerator('java-vanilla'),
    },
    () => {
      const x = t.targets.vanilla.install;
      return [{ text: x.folder, path: Object.values(t.paths.packFolder) }, { text: x.select }, { text: x.update }];
    },
  ),
  target(
    'bedrock',
    {
      id: 'bedrock-vibrant',
      edition: 'bedrock',
      needsMods: false,
      icon: 'cloud-sun',
      fileExt: '.mcpack',
      helpSection: 'vibrant-visuals',
      showcase: { preset: 'vivid', timeOfDay: 7400 },
      defaultVersion: 'latest',
      load: () => loadGenerator('bedrock-vibrant'),
    },
    () => {
      const x = t.targets.bedrock.install;
      return [{ text: x.open }, { text: x.activate, path: Object.values(t.paths.globalPacks) }, { text: x.mode, path: Object.values(t.paths.graphicsMode) }];
    },
  ),
];

export function targetInfo(id: ShaderTarget): ShaderTargetInfo {
  return TARGETS.find((t) => t.id === id) ?? TARGETS[0];
}
