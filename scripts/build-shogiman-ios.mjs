// Build the exact SHOGIMAN-IOS web UI into one self-contained HTML payload for Expo/WebView.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const source = join(root, 'reference', 'shogiman-ios');
const dist = join(source, 'dist');
const output = join(root, 'src', 'generated', 'shogimanIosHtml.ts');

if (!existsSync(join(source, 'package.json'))) {
  throw new Error('SHOGIMAN-IOS submodule is missing. Run: git submodule update --init --recursive');
}

execFileSync('npm', ['install'], { cwd: source, stdio: 'inherit', shell: process.platform === 'win32' });
execFileSync('npm', ['run', 'build'], { cwd: source, stdio: 'inherit', shell: process.platform === 'win32' });

let html = readFileSync(join(dist, 'index.html'), 'utf8');

html = html.replace(/<script\s+type="module"\s+crossorigin\s+src="([^"]+)"\s*><\/script>/g, (_, assetPath) => {
  const js = readFileSync(join(dist, assetPath.replace(/^\/+/, '')), 'utf8');
  return `<script type="module">${js}</script>`;
});

html = html.replace(/<link\s+rel="stylesheet"\s+crossorigin\s+href="([^"]+)"\s*\/?>/g, (_, assetPath) => {
  const css = readFileSync(join(dist, assetPath.replace(/^\/+/, '')), 'utf8');
  return `<style>${css}</style>`;
});

html = html.replace(/<link[^>]+rel="icon"[^>]*>/g, '');
html = html.replace('</head>', '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" /></head>');

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `// AUTO-GENERATED from reference/shogiman-ios. Do not hand-edit.\nexport const SHOGIMAN_IOS_HTML = ${JSON.stringify(html)};\n`, 'utf8');
console.log(`Generated ${output}`);
