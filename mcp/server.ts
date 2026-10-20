// Texture Pack Maker as an MCP server (stdio), for AI assistants that make packs on someone's
// behalf. The website stays the main way in: this is a second door onto the same pack code, and
// every pack it writes can be opened on the site to look at and keep editing by hand.
//
//   npm run mcp                   (or: npx tsx mcp/server.ts)
//   TEXTUREPACK_OUTPUT_DIR=...    folder packs are written to (default: the current folder)

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { listVersions, loadAssets } from '../src/editions/versions';
import { loadConvertMaps } from '../src/tools/convert/data';
import { SITE_NAME, SITE_URL } from '../src/app/site';
import {
  convertPackTool,
  createTexturePackTool,
  getTextureTool,
  inspectPackTool,
  listEffectsTool,
  listTexturesTool,
  listVersionsTool,
  type ToolDeps,
} from './tools';

// stdout carries the protocol: anything the shared code logs goes to stderr instead.
console.log = console.info = console.debug = (...args: unknown[]) => console.error(...args);

const assetCache = new Map<string, ReturnType<typeof loadAssets>>();
const deps: ToolDeps = {
  listVersions,
  loadAssets(edition, version) {
    const key = `${edition}:${version}`;
    let p = assetCache.get(key);
    if (!p) {
      p = loadAssets(edition, version);
      p.catch(() => assetCache.delete(key));
      assetCache.set(key, p);
    }
    return p;
  },
  loadConvertMaps,
  outputDir: process.env.TEXTUREPACK_OUTPUT_DIR || process.cwd(),
};

const server = new McpServer(
  { name: 'texture-pack-maker', title: SITE_NAME, version: '0.1.0', websiteUrl: SITE_URL },
  {
    instructions:
      `${SITE_NAME} makes Minecraft resource packs for Java and Bedrock. Find textures with list_textures, look at them with ` +
      'get_texture, then build a pack with create_texture_pack (whole-pack presets/effects, recoloured vanilla textures or new ' +
      `pixel art). Packs are written as files; tell the person where, and that they can open it at ${SITE_URL} to keep editing.`,
  },
);

const edition = z.enum(['java', 'bedrock']).describe('Minecraft edition');
const version = z.string().optional().describe('Game version id (Java e.g. "26.3" or "1.20.1"; Bedrock "latest"). Defaults to the newest.');
const category = z.enum(['block', 'item', 'entity', 'gui', 'particle', 'environment', 'painting', 'armor', 'effect', 'font', 'map', 'misc', 'colormap', 'other']);
const effect = z.object({
  type: z.string().describe('Effect type from list_effects, e.g. "hue", "saturation", "outline"'),
  params: z.record(z.string(), z.union([z.number(), z.boolean(), z.string()])).optional().describe('Effect settings; missing ones use defaults'),
  categories: z.array(category).optional().describe('Only these texture categories (whole-pack effects only)'),
});
const pixelArt = z
  .object({
    palette: z.record(z.string(), z.string()).describe('One character -> colour ("#rrggbb" or "#rrggbbaa"). "." and " " are transparent unless listed.'),
    rows: z.array(z.string()).describe('Rows of palette characters, top to bottom, all the same length (16 rows of 16 for a vanilla-size texture)'),
  })
  .describe('An image drawn as text');
const image = {
  file: z.string().optional().describe('Path of a PNG or TGA on this computer'),
  png_base64: z.string().optional().describe('PNG data, base64'),
  pixel_art: pixelArt.optional(),
};

const json = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] });
const run = async (fn: () => Promise<unknown> | unknown) => {
  try {
    return json(await fn());
  } catch (err) {
    return { isError: true, content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }] };
  }
};

server.registerTool(
  'list_versions',
  {
    title: 'List game versions',
    description: 'Minecraft versions packs can be made for, newest first, with Java resource pack formats.',
    inputSchema: { edition, include_snapshots: z.boolean().optional().describe('Java: include snapshots') },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  (args) => run(() => listVersionsTool(deps, args)),
);

server.registerTool(
  'list_textures',
  {
    title: 'Find textures',
    description: 'Searches the vanilla textures of a version. The first call for a version downloads its game files (cached for the session).',
    inputSchema: {
      edition,
      version,
      search: z.string().optional().describe('Words that must all appear in the texture id, e.g. "diamond sword"'),
      category: category.optional(),
      limit: z.number().int().min(1).max(500).optional().describe('Default 100'),
      offset: z.number().int().min(0).optional(),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  (args) => run(() => listTexturesTool(deps, args)),
);

server.registerTool(
  'get_texture',
  {
    title: 'Show a texture',
    description: 'Returns a vanilla texture as an image (enlarged without blurring so the pixels are visible) and its real size.',
    inputSchema: {
      edition,
      version,
      texture: z.string().describe('Texture id ("block/stone"), name ("stone") or pack path'),
      preview_size: z.number().int().min(16).max(1024).optional().describe('Approximate size of the enlarged preview in pixels (default 256)'),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async (args) => {
    try {
      const res = await getTextureTool(deps, args);
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(res.info, null, 2) },
          { type: 'image' as const, data: Buffer.from(res.preview).toString('base64'), mimeType: 'image/png' },
        ],
      };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }] };
    }
  },
);

server.registerTool(
  'list_effects',
  {
    title: 'List effects and presets',
    description: 'Whole-pack effects (with their settings) and one-click presets such as Dark Mode, Pastel or Retro 8-bit.',
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  () => run(() => listEffectsTool()),
);

server.registerTool(
  'create_texture_pack',
  {
    title: 'Create a texture pack',
    description:
      'Builds a resource pack file (.zip for Java, .mcpack for Bedrock) with the right pack.mcmeta / manifest.json for the version. ' +
      'Combine a preset and effects applied to every vanilla texture, with individual textures: new images, or the vanilla texture with effects.',
    inputSchema: {
      edition,
      version,
      name: z.string().describe('Pack name (also the file name)'),
      description: z.string().optional(),
      compat: z
        .object({ min_version: z.string(), max_version: z.string() })
        .optional()
        .describe('Java: also declare that the pack works on this range of versions'),
      preset: z.string().optional().describe('Preset id from list_effects'),
      effects: z.array(effect).optional().describe('Effects applied to the whole pack, in order, after the preset'),
      textures: z
        .array(
          z.object({
            texture: z.string().describe('Texture id ("block/stone"), name or pack path'),
            ...image,
            effects: z.array(effect).optional().describe('Effects for this texture only (applied to the vanilla texture when no image is given)'),
          }),
        )
        .optional(),
      icon: z.object(image).optional().describe('Pack icon (any size, fitted to the square)'),
      output_dir: z.string().optional().describe('Folder to write the pack to'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  (args) => run(() => createTexturePackTool(deps, args)),
);

server.registerTool(
  'inspect_pack',
  {
    title: 'Inspect a pack',
    description: 'Opens a .zip / .mcpack resource pack and reports its edition, version, textures and (Java) which releases accept its pack.mcmeta.',
    inputSchema: { file: z.string().describe('Path of the pack file') },
    annotations: { readOnlyHint: true },
  },
  (args) => run(() => inspectPackTool(deps, args)),
);

server.registerTool(
  'convert_pack',
  {
    title: 'Convert a pack',
    description: 'Converts a resource pack between Java and Bedrock, or to another Java version, and reports every texture that could not move over.',
    inputSchema: {
      file: z.string().describe('Path of the pack to convert'),
      edition: edition.describe('Edition to convert to'),
      version,
      output_dir: z.string().optional().describe('Folder to write the converted pack to'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  (args) => run(() => convertPackTool(deps, args)),
);

await server.connect(new StdioServerTransport());
