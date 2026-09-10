import { spawnSync } from 'node:child_process';
for (const args of [['scripts/build.mjs'], ['--test', 'tests/*.test.mjs']]) {
  const result = spawnSync(process.execPath, args, { stdio:'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
