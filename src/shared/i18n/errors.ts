// English text of the errors of modules that start screens already load: downloads and storage
// (src/core/net.ts, pixels.ts), the version lists, pack formats, the Bedrock texture
// catalogue and manifests (src/editions). {host} is a server name such as piston-data.mojang.com.
// Translations: src/shared/i18n/<lang>.ts.

import { defineText } from '../../i18n/editor-text';

export const errorText = defineText('shared.errors', {
  cancelled: 'The operation was cancelled.',
  /** friendlyError() for a cancelled task */
  cancelledShort: 'Cancelled.',
  notFound: "The file wasn't found on {host} (HTTP {status}).",
  rateLimited: '{host} is limiting requests right now. Wait a minute and try again.',
  forbidden: '{host} refused the request (HTTP {status}).',
  /** {status} is "500" or "500 Internal Server Error" */
  httpError: '{host} returned an error (HTTP {status}). Try again in a moment.',
  timeout: 'The request to {host} timed out. Check your connection and try again.',
  offline: 'You appear to be offline. Check your internet connection and try again.',
  unreachable: "Couldn't reach {host}. The server may be down, or a firewall or browser extension may be blocking it.",
  badData: "{host} sent data that couldn't be read. Try again later.",
  quota: 'Your browser is out of storage space for this site. Free some space (e.g. clear cached game files) and try again.',
  generic: 'Something went wrong.',
  /** friendlyError(err, context): "Couldn't build the pack: <message>" */
  withContext: '{context}: {message}',
  notInVersionList: "Minecraft {version} isn't in Mojang's version list.",
  noClient: "Mojang doesn't provide a client download for Minecraft {version}.",
  /** Java pack.mcmeta for a version whose pack format couldn't be looked up */
  noPackFormat: "Couldn't find the pack format for Minecraft {version}. Check your connection and try again.",
  noPackFormatShort: "Couldn't find the pack format for Minecraft {version}.",
  skinSize: 'Skins must be 64x64 or 64x32 pixels (this one is {width}x{height}).',
  legacySkin: 'Only 64x64 skins can be saved in the legacy 64x32 format.',
  bedrockList: 'Unexpected file list format.',
  badIds: 'The pack IDs are invalid. Create the pack again to get new ones.',
  sameIds: 'The pack header and module IDs must be different.',
  skinNotPng: 'Skins must be PNG images.',
  bedrockSkinSize: 'Skins must be 64x64 or 128x128 pixels (this one is {width}x{height}).',
  noSkins: 'Add at least one skin to the pack.',
});

export type ErrorText = typeof errorText;
