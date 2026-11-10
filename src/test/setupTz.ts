// Permite rodar toda a suíte em outro fuso: ZIEL_TZ=Pacific/Kiritimati npm test
// (a variável TZ definida na linha de comando não é respeitada pelo Node no Windows; process.env.TZ em runtime é).
if (process.env.ZIEL_TZ) process.env.TZ = process.env.ZIEL_TZ;
