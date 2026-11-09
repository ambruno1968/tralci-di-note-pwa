'use strict';
// Genera la cartella "docs" (la PWA pronta da pubblicare) a partire dai sorgenti.
//   app.js, styles.css, logo, icone, guida  -> progetto PC (sempre l'ultima versione)
//   localDbEngine / driveClient / printTemplates -> motore locale senza server (progetto Android)
//   src-pwa -> manifest, service worker, bridge PWA
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PC = path.join(ROOT, '..', 'Tralci di note');
const AND = path.join(ROOT, '..', 'Tralci di note - ANDROID', 'public');
const OUT = path.join(ROOT, 'docs');
const SRC = path.join(ROOT, 'src-pwa');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const cp = (from, to) => fs.copyFileSync(from, path.join(OUT, to));
const read = f => fs.readFileSync(f, 'utf8');
const write = (name, txt) => fs.writeFileSync(path.join(OUT, name), txt, 'utf8');

// Sorgenti condivisi con il PC
cp(path.join(PC, 'public', 'app.js'), 'app.js');
cp(path.join(PC, 'public', 'styles.css'), 'styles.css');
cp(path.join(PC, 'public', 'logo.png'), 'logo.png');
cp(path.join(PC, 'public', 'icon.png'), 'icon.png');
if (fs.existsSync(path.join(PC, 'WIKI.md'))) cp(path.join(PC, 'WIKI.md'), 'WIKI.md');
else write('WIKI.md', '# Guida\n\nConsulta la guida nella versione PC.\n');

// Motore locale (nessun server)
cp(path.join(AND, 'localDbEngine.js'), 'localDbEngine.js');
cp(path.join(AND, 'printTemplates.js'), 'printTemplates.js');

// driveClient: client ID Web, niente client secret in un sito pubblico + rinnovo token silenzioso
const WEB_CLIENT_ID = '1078975750372-goiokfhggk06t2b6s8fr73vfthls1i87.apps.googleusercontent.com';
let dc = read(path.join(AND, 'driveClient.js'));
dc = dc.replace(/const BUNDLED_CLIENT_ID = '[^']*';/, `const BUNDLED_CLIENT_ID = '${WEB_CLIENT_ID}';`);
dc = dc.replace(/const BUNDLED_CLIENT_SECRET = '[^']*';/, "const BUNDLED_CLIENT_SECRET = '';");
dc = dc.replace(
  /if \(!tokenData\.refresh_token\) \{\s*throw new Error\('Sessione Google scaduta\. Ricollega il tuo account Google\.'\);\s*\}/,
  "if (!tokenData.refresh_token) {\n        if (window.PwaGoogle) return await window.PwaGoogle.silentRefresh();\n        throw new Error('Sessione Google scaduta. Ricollega il tuo account Google.');\n      }"
);
if (!dc.includes('PwaGoogle')) throw new Error('Patch driveClient non applicata');
write('driveClient.js', dc);

// index.html: manifest + bridge PWA caricato per primo
let html = read(path.join(AND, 'index.html'));
html = html.replace('<link rel="icon" type="image/png" href="icon.png">',
  '<link rel="icon" type="image/png" href="icon.png">\n  <link rel="manifest" href="manifest.webmanifest">\n  <meta name="theme-color" content="#2563eb">\n  <link rel="apple-touch-icon" href="icon-192.png">');
html = html.replace('<script src="printTemplates.js"></script>', '<script src="pwa.js"></script>\n  <script src="printTemplates.js"></script>');
if (!html.includes('pwa.js')) throw new Error('Patch index.html non applicata');
write('index.html', html);

// PWA
for (const f of ['pwa.js', 'sw.js', 'manifest.webmanifest', 'default-db.json']) cp(path.join(SRC, f), f);
for (const f of ['icon-192.png', 'icon-512.png']) cp(path.join(SRC, f), f);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

console.log('PWA generata in', OUT);
fs.readdirSync(OUT).forEach(f => console.log(' -', f));

