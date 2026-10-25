#!/usr/bin/env node
/**
 * Prints a traffic summary for the live site from Cloudflare Web Analytics (the cookieless beacon in
 * index.html). Read-only: it runs one GraphQL query and writes nothing anywhere.
 *
 * Usage:
 *   node scripts/cloudflare-traffic.mjs                 last 7 days
 *   node scripts/cloudflare-traffic.mjs --days 30       a different window
 *   node scripts/cloudflare-traffic.mjs --host 9dtr.com  another host in the same account
 *   node scripts/cloudflare-traffic.mjs --json          raw numbers instead of the table
 *
 * Needs two environment variables, never committed:
 *   CLOUDFLARE_API_TOKEN    token with Account -> Account Analytics -> Read
 *   CLOUDFLARE_ACCOUNT_ID   account ID from the Cloudflare dashboard sidebar
 *
 * Counts come back sampled and rounded to the nearest ten, so treat small numbers as approximate.
 */
const API = 'https://api.cloudflare.com/client/v4/graphql';
const DEFAULT_HOST = 'texturepackmaker.com';

function parseArgs(argv) {
  const opts = { days: 7, host: DEFAULT_HOST, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--days') opts.days = Number(argv[(i += 1)]);
    else if (arg === '--host') opts.host = argv[(i += 1)];
    else if (arg === '--json') opts.json = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!Number.isFinite(opts.days) || opts.days < 1) throw new Error('--days needs a positive number');
  return opts;
}

const QUERY = `query($acct:String!,$host:String!,$since:Time!,$until:Time!){
  viewer{ accounts(filter:{accountTag:$acct}){
    totals: rumPageloadEventsAdaptiveGroups(limit:1,filter:{datetime_geq:$since,datetime_leq:$until,requestHost:$host}){
      count sum{ visits }
    }
    pages: rumPageloadEventsAdaptiveGroups(limit:15,filter:{datetime_geq:$since,datetime_leq:$until,requestHost:$host},orderBy:[count_DESC]){
      count sum{ visits } dimensions{ requestPath }
    }
    countries: rumPageloadEventsAdaptiveGroups(limit:10,filter:{datetime_geq:$since,datetime_leq:$until,requestHost:$host},orderBy:[count_DESC]){
      count dimensions{ countryName }
    }
    referers: rumPageloadEventsAdaptiveGroups(limit:10,filter:{datetime_geq:$since,datetime_leq:$until,requestHost:$host},orderBy:[count_DESC]){
      count dimensions{ refererHost }
    }
  } }
}`;

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !account) {
    throw new Error('set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID first (see the header of this file)');
  }

  const until = new Date();
  const since = new Date(until.getTime() - opts.days * 86_400_000);
  const response = await fetch(API, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      query: QUERY,
      variables: { acct: account, host: opts.host, since: since.toISOString(), until: until.toISOString() },
    }),
  });
  if (!response.ok) throw new Error(`Cloudflare returned HTTP ${response.status}`);

  const body = await response.json();
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '));
  const data = body.data?.viewer?.accounts?.[0];
  if (!data) throw new Error('no such account, or the token cannot read its analytics');

  if (opts.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  const totals = data.totals[0] ?? { count: 0, sum: { visits: 0 } };
  const day = (d) => d.toISOString().slice(0, 10);
  console.log(`${opts.host} — ${day(since)} to ${day(until)} (${opts.days} days)`);
  console.log(`  page views ${totals.count}    visits ${totals.sum.visits}`);
  list('Top pages', data.pages, (r) => r.dimensions.requestPath);
  list('Countries', data.countries, (r) => r.dimensions.countryName);
  list('Referrers', data.referers, (r) => r.dimensions.refererHost || '(direct)');
}

function list(title, rows, label) {
  if (!rows?.length) return;
  console.log(`\n${title}`);
  const width = Math.max(...rows.map((r) => String(r.count).length));
  for (const row of rows) console.log(`  ${String(row.count).padStart(width)}  ${label(row)}`);
}

run().catch((error) => {
  console.error(`cloudflare-traffic: ${error.message}`);
  process.exitCode = 1;
});
