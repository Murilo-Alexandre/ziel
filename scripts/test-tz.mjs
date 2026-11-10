// Executa a suíte completa em vários fusos (inclui UTC+14 e UTC-8 com horário de verão).
import { spawnSync } from 'node:child_process';

const zones = ['UTC', 'America/Sao_Paulo', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Australia/Lord_Howe'];
let failed = false;
for (const tz of zones) {
  console.log(`\n=== ZIEL_TZ=${tz} ===`);
  const r = spawnSync('npx', ['vitest', 'run', '--reporter=dot'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ZIEL_TZ: tz },
  });
  if (r.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
