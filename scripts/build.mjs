import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
rmSync('assets/app', { recursive: true, force: true });
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc'], { stdio: 'inherit' });
mkdirSync('assets', { recursive: true });
cpSync('src/styles.css', 'assets/queen.css');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
cpSync('index.html', 'dist/index.html');
cpSync('assets', 'dist/assets', { recursive: true });
function files(dir) { return readdirSync(dir).flatMap(name => { const path = join(dir, name); return statSync(path).isDirectory() ? files(path) : [path]; }); }
const code = files('dist').filter(path => /\.(js|css|html)$/.test(path));
const bytes = code.reduce((sum,path) => sum + gzipSync(readFileSync(path)).length, 0);
if (bytes > 120_000) throw new Error(`Core gzip budget exceeded: ${bytes}`);
console.log(`Built static site. HTML + CSS + JS: ${bytes.toLocaleString()} gzip bytes (budget 120,000).`);
