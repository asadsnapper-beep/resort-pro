/**
 * Puts the embed widget and the WordPress plugin where a resort can reach them.
 *
 * Settings has always told resorts to paste
 *   <script src="https://cdn.resortpro.site/embed.js">
 * and to download https://cdn.resortpro.site/resortpro-wp-plugin.zip. Both
 * returned 404 for as long as they have been offered. The code for both was in
 * the repository the whole time — apps/embed and apps/wordpress-plugin — and
 * nothing ever built or published either one. (The plugin itself pointed at
 * cdn.resortpro.app, a different domain again.)
 *
 * There is no separate CDN to deploy to, and inventing one would be a second
 * thing to keep in step with the app. The web app already serves public/ on
 * resortpro.site, so the build writes both files there and every deploy ships
 * the matching version with no extra step anyone has to remember.
 *
 * Runs as part of `next build`. Fails the build rather than shipping a web
 * image whose Settings page links to files that are not in it.
 */
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EMBED = resolve(WEB, '../embed');
const PLUGIN = resolve(WEB, '../wordpress-plugin');
const PUBLIC = join(WEB, 'public');

function fail(message) {
  console.error(`\n[bundle-embed] ${message}\n`);
  process.exit(1);
}

// ── embed.js ────────────────────────────────────────────────────────────────
if (!existsSync(join(EMBED, 'node_modules'))) {
  fail(`apps/embed has no node_modules, so the widget cannot be built.
  In Docker the install must include it: pnpm install --filter "@resort-pro/web..." --filter "@resort-pro/embed"`);
}

console.log('[bundle-embed] building apps/embed');
execSync('pnpm exec vite build', { cwd: EMBED, stdio: 'inherit' });

const built = join(EMBED, 'dist/embed.iife.js');
if (!existsSync(built) || statSync(built).size === 0) fail(`vite build produced no ${relative(WEB, built)}`);

mkdirSync(PUBLIC, { recursive: true });
copyFileSync(built, join(PUBLIC, 'embed.js'));
console.log(`[bundle-embed] public/embed.js  ${statSync(built).size} bytes`);

// ── resortpro-wp-plugin.zip ─────────────────────────────────────────────────
// WordPress installs a plugin zip by unpacking it into wp-content/plugins, so
// every entry sits under one folder named for the plugin.
const FOLDER = 'resortpro';

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/**
 * A stored (uncompressed) zip. The plugin is a few dozen KB of PHP, so
 * compression buys nothing worth a dependency, and every unzip — WordPress's
 * included — reads method 0.
 */
function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf-8');
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);            // version needed
    local.writeUInt16LE(0x0800, 6);        // UTF-8 names
    local.writeUInt16LE(0, 8);             // stored
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);          // version made by
    central.writeUInt16LE(20, 6);          // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + data.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

const files = walk(PLUGIN).sort();
if (!files.some((f) => f.endsWith('resortpro.php'))) fail('apps/wordpress-plugin has no resortpro.php');

const archive = zip(files.map((f) => ({
  name: `${FOLDER}/${relative(PLUGIN, f).split('\\').join('/')}`,
  data: readFileSync(f),
})));
writeFileSync(join(PUBLIC, 'resortpro-wp-plugin.zip'), archive);
console.log(`[bundle-embed] public/resortpro-wp-plugin.zip  ${files.length} files, ${archive.length} bytes`);
