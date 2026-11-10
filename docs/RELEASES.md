# Releases do Ziel (Android)

## Publicar uma versão
```bash
git tag v0.1.0-beta.2
git push origin v0.1.0-beta.2
```
O workflow **Release APK** (`.github/workflows/release.yml`) roda typecheck, testes e build, compila o APK **assinado**,
confere que a chave é a esperada e anexa `Ziel-vX.Y.Z[-beta.N].apk` (+ `.sha256`) à Release. Tags com `-alpha/-beta/-rc` saem como pré-lançamento.

Formato de tag aceito: `vMAJOR.MINOR.PATCH` ou `vMAJOR.MINOR.PATCH-(alpha|beta|rc).N`.

## Versionamento Android
`versionName` = tag sem o `v`. `versionCode` é calculado por `scripts/version-from-tag.mjs`
(`MAJOR*1.000.000 + MINOR*10.000 + PATCH*100 + estágio`; alpha 1–28, beta 31–58, rc 71–98, final 99).
Exemplos: `0.1.0-beta.1` = 10031 · `0.1.0-beta.2` = 10032 · `0.1.0` = 10099 · `0.1.1-beta.1` = 10131.
Sempre crescente, então cada release instala **por cima** da anterior, mantendo metas e registros (IndexedDB do app).

## Assinatura (essencial para atualizar sem perder dados)
* O Android só aceita atualizar um app se o APK novo for assinado com a **mesma chave**. Perder a chave = não há mais atualização
  (só reinstalar, o que apaga os dados locais; use Ajustes → Exportar antes).
* A chave está em `signing/ziel-release.jks` (**fora do Git**) com senhas em `signing/keystore-credentials.txt`.
  **Faça backup dos dois em local seguro (gerenciador de senhas / pendrive / nuvem privada).**
* No GitHub (Settings → Secrets): `ZIEL_KEYSTORE_BASE64`, `ZIEL_KEYSTORE_PASSWORD`, `ZIEL_KEY_PASSWORD`, `ZIEL_KEY_ALIAS`;
  variável `ZIEL_CERT_SHA256` (impressão digital esperada; o workflow aborta se a chave for outra).
* Nunca commite `*.jks`, `keystore.properties` ou senhas (já no `.gitignore`).

## Build local
```powershell
$env:JAVA_HOME='C:\Users\<voce>\.jdks\jdk-21.0.13+9'   # Capacitor 7 exige JDK 21 (o 17 nao compila)
npm run build; npx cap sync android
cd android; .\gradlew.bat assembleDebug      # APK debug (assinado com a chave debug do Android Studio)
```
Release local assinado: crie `android/keystore.properties` (ignorado pelo Git) com `storeFile`, `storePassword`, `keyAlias`, `keyPassword`
e rode `.\gradlew.bat assembleRelease -PzielVersionName=0.1.0-beta.1 -PzielVersionCode=10031`.
Crie `android/local.properties` com `sdk.dir=C:/Users/<você>/AppData/Local/Android/Sdk` se o Gradle não achar o SDK.

> O APK de **debug** e o de **release** têm assinaturas diferentes: não se atualizam entre si. Instale sempre o da Release.

## Atualização pelo app (Android)
O Ziel consulta `https://api.github.com/repos/Murilo-Alexandre/ziel/releases` (no máximo a cada 12 h ao abrir, e em Ajustes → "Verificar atualizações"),
compara o `versionCode` da tag com o instalado e, se houver versão maior com `Ziel-<tag>.apk` e `.sha256` anexados, mostra um aviso discreto.
Em "Instalar atualização": o plugin nativo `ZielUpdater` baixa o APK (apenas hosts do GitHub, HTTPS), confere o SHA-256 do `.sha256` da Release,
o nome do pacote (`com.ziel.app`), o `versionCode` e a **assinatura** (igual à do app instalado) e só então abre o instalador do Android.
A primeira vez o Android pede a permissão "Instalar apps desconhecidos" para o Ziel. O repositório precisa ser **público** para o app consultar a API sem login.
Notas exibidas no app: `docs/release-notes/<tag>.md` (se existir) vira o texto da Release.
