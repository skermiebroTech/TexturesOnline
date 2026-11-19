#!/usr/bin/env node
/**
 * Prints what the site gets from Bing: clicks, impressions, average position and the search queries
 * people arrived on. Read-only: it only calls the Bing Webmaster API's GET endpoints.
 *
 * Since Bing also feeds Copilot and DuckDuckGo, these numbers cover more than bing.com itself.
 *
 * Usage:
 *   node scripts/bing-queries.mjs                     top queries plus the clicks/impressions totals
 *   node scripts/bing-queries.mjs --limit 40          show more queries
 *   node scripts/bing-queries.mjs --site https://…/   another verified site on the account
 *   node scripts/bing-queries.mjs --json              raw API rows instead of the table
 *
 * Needs one environment variable, never committed:
 *   BING_WEBMASTER_API_KEY   from Bing Webmaster Tools -> Settings -> API access
 *
 * The API decides the window itself: roughly the last three weeks of daily rows for queries and a
 * little more for the traffic totals. It is not a parameter.
 */
const API = 'https://ssl.bing.com/webmaster/api.svc/json';
const DEFAULT_SITE = 'https://texturepackmaker.com/';

function parseArgs(argv) {
  const opts = { limit: 20, site: DEFAULT_SITE, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--limit') opts.limit = Number(argv[(i += 1)]);
    else if (arg === '--site') opts.site = argv[(i += 1)];
    else if (arg === '--json') opts.json = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!Number.isFinite(opts.limit) || opts.limit < 1) throw new Error('--limit needs a positive number');
  return opts;
}

async function get(endpoint, apikey, siteUrl) {
  const url = new URL(`${API}/${endpoint}`);
  url.searchParams.set('apikey', apikey);
  url.searchParams.set('siteUrl', siteUrl);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}`);
  const body = await response.json();
  // Errors come back as 200 with an ErrorCode, not as a failing status.
  if (body.ErrorCode) throw new Error(`${endpoint}: ${body.Message ?? `error ${body.ErrorCode}`}`);
  return body.d ?? [];
}

/** Bing dates arrive as the ASP.NET "/Date(1790812800000)/" form. */
function asDate(value) {
  const ms = Number(/\((-?\d+)/.exec(value)?.[1]);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : '?';
}

function range(rows) {
  const days = rows.map((row) => asDate(row.Date)).sort();
  return days.length ? `${days[0]} to ${days.at(-1)}` : 'no data';
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  const apikey = process.env.BING_WEBMASTER_API_KEY;
  if (!apikey) throw new Error('set BING_WEBMASTER_API_KEY first (see the header of this file)');

  const [traffic, queries] = await Promise.all([
    get('GetRankAndTrafficStats', apikey, opts.site),
    get('GetQueryStats', apikey, opts.site),
  ]);

  if (opts.json) {
    console.log(JSON.stringify({ traffic, queries }, null, 2));
    return;
  }

  console.log(`${opts.site} — Bing Webmaster Tools`);
  console.log(
    `  ${range(traffic)}: ${sum(traffic, 'Clicks')} clicks, ${sum(traffic, 'Impressions')} impressions`,
  );

  // One row per query per day, so fold them together before ranking.
  const byQuery = new Map();
  for (const row of queries) {
    const entry = byQuery.get(row.Query) ?? { clicks: 0, impressions: 0, positions: [] };
    entry.clicks += row.Clicks;
    entry.impressions += row.Impressions;
    if (row.AvgImpressionPosition > 0) entry.positions.push(row.AvgImpressionPosition);
    byQuery.set(row.Query, entry);
  }
  const ranked = [...byQuery].sort((a, b) => b[1].impressions - a[1].impressions);

  console.log(`\nQueries, ${range(queries)} (${byQuery.size} distinct)`);
  console.log('  clicks   impr   pos  query');
  for (const [query, entry] of ranked.slice(0, opts.limit)) {
    const pos = entry.positions.length
      ? (entry.positions.reduce((a, b) => a + b, 0) / entry.positions.length).toFixed(1)
      : '  -';
    console.log(
      `  ${String(entry.clicks).padStart(6)} ${String(entry.impressions).padStart(6)} ${String(pos).padStart(5)}  ${query}`,
    );
  }
  if (ranked.length > opts.limit) console.log(`  … ${ranked.length - opts.limit} more, use --limit`);
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + (row[field] ?? 0), 0);
}

run().catch((error) => {
  console.error(`bing-queries: ${error.message}`);
  process.exitCode = 1;
});
