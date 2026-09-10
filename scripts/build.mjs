import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
mkdirSync('dist', { recursive: true });
for (const args of [
  ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'],
  ['node_modules/tailwindcss/lib/cli.js', '-i', 'styles/table.css', '-o', 'dist/table.css', '--minify']
]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
