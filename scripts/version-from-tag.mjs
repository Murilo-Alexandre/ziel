// Converte uma tag (v0.1.0-beta.1) em versionName/versionCode do Android.
// versionCode = MAJOR*1_000_000 + MINOR*10_000 + PATCH*100 + estágio, com estágio:
//   alpha.N -> N (1..29) | beta.N -> 30+N (31..69) | rc.N -> 70+N (71..98) | final -> 99
// Cresce sempre com a versão, então cada release instala como ATUALIZAÇÃO da anterior.
const tag = process.argv[2] ?? '';
const m = /^v(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?$/.exec(tag);
if (!m) {
  console.error(`Tag inválida: "${tag}". Use vMAJOR.MINOR.PATCH ou vMAJOR.MINOR.PATCH-(alpha|beta|rc).N`);
  process.exit(1);
}
const [, major, minor, patch, stage, n] = m;
const base = { alpha: 0, beta: 30, rc: 70 };
const num = Number(n ?? 0);
if (stage && (num < 1 || num > 28)) {
  console.error('O número do pré-lançamento deve estar entre 1 e 28.');
  process.exit(1);
}
if (Number(minor) > 99 || Number(patch) > 99 || Number(major) > 2000) {
  console.error('MINOR e PATCH devem ser <= 99.');
  process.exit(1);
}
const stageCode = stage ? base[stage] + num : 99;
const code = Number(major) * 1_000_000 + Number(minor) * 10_000 + Number(patch) * 100 + stageCode;
const name = tag.slice(1);
if (process.argv[3] === '--github-output') {
  console.log(`version_name=${name}\nversion_code=${code}\nprerelease=${stage ? 'true' : 'false'}`);
} else {
  console.log(JSON.stringify({ versionName: name, versionCode: code, prerelease: Boolean(stage) }));
}
