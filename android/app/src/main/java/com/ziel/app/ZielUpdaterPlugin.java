package com.ziel.app;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Atualização do app via APK de GitHub Releases.
 * Fluxo: getAppInfo -> download (verifica SHA-256, pacote, versão e ASSINATURA) -> install (instalador nativo).
 * O Android só instala por cima se o APK tiver a MESMA assinatura do app instalado; aqui conferimos antes
 * para dar uma mensagem clara, e o sistema volta a conferir na instalação. Os dados do app são preservados.
 */
@CapacitorPlugin(name = "ZielUpdater")
public class ZielUpdaterPlugin extends Plugin {

    private static final String APK_NAME = "Ziel-update.apk";

    private File apkFile() {
        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.exists()) dir.mkdirs();
        return new File(dir, APK_NAME);
    }

    private static boolean isAllowedHost(String host) {
        if (host == null) return false;
        host = host.toLowerCase(Locale.ROOT);
        return host.equals("github.com")
                || host.endsWith(".github.com")
                || host.endsWith(".githubusercontent.com");
    }

    @SuppressWarnings("deprecation")
    private long versionCodeOf(PackageInfo info) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode;
    }

    @PluginMethod
    public void getAppInfo(PluginCall call) {
        try {
            String pkg = getContext().getPackageName();
            PackageInfo info = getContext().getPackageManager().getPackageInfo(pkg, 0);
            JSObject ret = new JSObject();
            ret.put("packageName", pkg);
            ret.put("versionName", info.versionName);
            ret.put("versionCode", versionCodeOf(info));
            ret.put("canInstall", canInstallPackages());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Não foi possível ler a versão instalada.", e);
        }
    }

    private boolean canInstallPackages() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                || getContext().getPackageManager().canRequestPackageInstalls();
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Não foi possível abrir as configurações de instalação.", e);
        }
    }


    /** Baixa um texto pequeno (ex.: arquivo .sha256) de um host permitido; evita CORS do WebView nos redirecionamentos do GitHub. */
    @PluginMethod
    public void fetchText(final PluginCall call) {
        final String url = call.getString("url");
        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                URL u = new URL(url == null ? "" : url);
                if (!"https".equals(u.getProtocol()) || !isAllowedHost(u.getHost())) {
                    call.reject("Endereço não permitido.", "BAD_URL");
                    return;
                }
                conn = (HttpURLConnection) u.openConnection();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);
                conn.setInstanceFollowRedirects(true);
                if (conn.getResponseCode() != 200 || !isAllowedHost(conn.getURL().getHost())) {
                    call.reject("Resposta inesperada do servidor.", "HTTP_ERROR");
                    return;
                }
                java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
                try (InputStream in = conn.getInputStream()) {
                    byte[] buf = new byte[1024];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        bos.write(buf, 0, n);
                        if (bos.size() > 16 * 1024) {
                            call.reject("Arquivo de texto grande demais.", "TOO_LARGE");
                            return;
                        }
                    }
                }
                JSObject ret = new JSObject();
                ret.put("text", bos.toString("UTF-8"));
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Falha ao consultar: " + e.getMessage(), "FETCH_FAILED", e);
            } finally {
                if (conn != null) conn.disconnect();
            }
        }, "ziel-updater-fetch").start();
    }

    @PluginMethod
    public void download(final PluginCall call) {
        final String url = call.getString("url");
        final String expectedSha = call.getString("sha256");
        final Long minVersionCode = call.getLong("minVersionCode");
        if (url == null || url.isEmpty()) {
            call.reject("URL ausente.", "BAD_URL");
            return;
        }
        if (expectedSha == null || expectedSha.length() != 64) {
            call.reject("SHA-256 esperado ausente ou inválido.", "NO_HASH");
            return;
        }
        new Thread(() -> {
            File out = apkFile();
            File tmp = new File(out.getParentFile(), APK_NAME + ".part");
            HttpURLConnection conn = null;
            try {
                URL u = new URL(url);
                if (!"https".equals(u.getProtocol()) || !isAllowedHost(u.getHost())) {
                    call.reject("Endereço de download não permitido.", "BAD_URL");
                    return;
                }
                conn = (HttpURLConnection) u.openConnection();
                conn.setConnectTimeout(20000);
                conn.setReadTimeout(30000);
                conn.setInstanceFollowRedirects(true);
                int code = conn.getResponseCode();
                if (code != 200) {
                    call.reject("O servidor respondeu " + code + ".", "HTTP_ERROR");
                    return;
                }
                // Redirecionamentos só podem terminar em hosts do GitHub.
                if (!isAllowedHost(conn.getURL().getHost())) {
                    call.reject("Redirecionamento para host não permitido.", "BAD_URL");
                    return;
                }
                long total = conn.getContentLengthLong();
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                long done = 0;
                long lastEmit = 0;
                try (InputStream in = conn.getInputStream(); OutputStream os = new FileOutputStream(tmp)) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        os.write(buf, 0, n);
                        md.update(buf, 0, n);
                        done += n;
                        long now = System.currentTimeMillis();
                        if (now - lastEmit > 120) {
                            lastEmit = now;
                            JSObject p = new JSObject();
                            p.put("received", done);
                            p.put("total", total);
                            notifyListeners("downloadProgress", p);
                        }
                    }
                }
                StringBuilder hex = new StringBuilder();
                for (byte b : md.digest()) hex.append(String.format("%02x", b));
                String actual = hex.toString();
                if (!actual.equalsIgnoreCase(expectedSha)) {
                    tmp.delete();
                    call.reject("A verificação de integridade falhou (SHA-256 diferente). O arquivo foi descartado.", "HASH_MISMATCH");
                    return;
                }
                if (out.exists()) out.delete();
                if (!tmp.renameTo(out)) {
                    tmp.delete();
                    call.reject("Não foi possível salvar o APK.", "IO_ERROR");
                    return;
                }

                String problem = verifyPackage(out, minVersionCode);
                if (problem != null) {
                    out.delete();
                    call.reject(problem, "PACKAGE_REJECTED");
                    return;
                }

                JSObject ret = new JSObject();
                ret.put("sha256", actual);
                ret.put("size", done);
                call.resolve(ret);
            } catch (Exception e) {
                tmp.delete();
                call.reject("Falha no download: " + e.getMessage(), "DOWNLOAD_FAILED", e);
            } finally {
                if (conn != null) conn.disconnect();
            }
        }, "ziel-updater-download").start();
    }

    /** Confere pacote, versão e assinatura do APK baixado contra o app instalado. Retorna mensagem de erro ou null. */
    @SuppressWarnings("deprecation")
    private String verifyPackage(File apk, Long minVersionCode) throws Exception {
        PackageManager pm = getContext().getPackageManager();
        String myPkg = getContext().getPackageName();
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo archive = pm.getPackageArchiveInfo(apk.getAbsolutePath(), flags);
        if (archive == null) return "O arquivo baixado não é um APK válido.";
        if (!myPkg.equals(archive.packageName)) return "O APK é de outro aplicativo.";
        long newCode = versionCodeOf(archive);
        PackageInfo installed = pm.getPackageInfo(myPkg, flags);
        if (newCode <= versionCodeOf(installed)) return "Este APK não é mais novo que a versão instalada.";
        if (minVersionCode != null && newCode < minVersionCode) return "O APK é mais antigo que o anunciado.";

        Set<String> a = signerHashes(archive);
        Set<String> b = signerHashes(installed);
        if (a.isEmpty() || !a.equals(b)) {
            return "A assinatura do APK é diferente da do app instalado, então o Android não faria a atualização. "
                    + "Instale a versão publicada em Releases (assinada com a chave oficial).";
        }
        return null;
    }

    @SuppressWarnings("deprecation")
    private Set<String> signerHashes(PackageInfo info) throws Exception {
        Signature[] sigs;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            if (info.signingInfo == null) return new HashSet<>();
            sigs = info.signingInfo.getApkContentsSigners();
        } else {
            sigs = info.signatures;
        }
        Set<String> out = new HashSet<>();
        if (sigs == null) return out;
        for (Signature s : sigs) {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            StringBuilder hex = new StringBuilder();
            for (byte x : md.digest(s.toByteArray())) hex.append(String.format("%02x", x));
            out.add(hex.toString());
        }
        return out;
    }

    @PluginMethod
    public void install(PluginCall call) {
        try {
            File apk = apkFile();
            if (!apk.exists()) {
                call.reject("Nenhum APK baixado para instalar.", "NO_APK");
                return;
            }
            if (!canInstallPackages()) {
                call.reject("Permita que o Ziel instale atualizações nas configurações do Android.", "NEEDS_PERMISSION");
                return;
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Não foi possível abrir o instalador: " + e.getMessage(), "INSTALL_FAILED", e);
        }
    }
}
