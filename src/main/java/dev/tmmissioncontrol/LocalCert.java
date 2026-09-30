package dev.tmmissioncontrol;

import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

final class LocalCert {
    // Kept from the TM Mission Control days: the saved https.p12 was made with it (the rename moved it over).
    private static final char[] PASS = "tm-mission-control".toCharArray();

    private LocalCert() {
    }

    /** %LOCALAPPDATA%\Terraforming Mars Telemetry: saved games, the HTTPS certificate, settings. */
    static Path dir() throws java.io.IOException {
        Path local = Path.of(System.getProperty("user.home"), "AppData", "Local");
        Path dir = local.resolve("Terraforming Mars Telemetry");
        if (!Files.exists(dir)) {
            migrate(local.resolve("TM Mission Control"), dir);
        }
        Files.createDirectories(dir);
        return dir;
    }

    /** The app was called TM Mission Control; bring its folder (past games included) along once. */
    private static void migrate(Path old, Path dir) {
        if (!Files.isDirectory(old)) {
            return;
        }
        try {
            Files.move(old, dir);
            return;
        } catch (java.io.IOException moveFailed) {
            // A file still held open by an older copy blocks the rename; copy instead and leave the old folder.
        }
        try (var files = Files.walk(old)) {
            for (Path src : files.toList()) {
                Path dst = dir.resolve(old.relativize(src).toString());
                if (Files.isDirectory(src)) {
                    Files.createDirectories(dst);
                } else if (!Files.exists(dst)) {
                    Files.copy(src, dst);
                }
            }
        } catch (java.io.IOException copyFailed) {
            System.err.println("Could not bring over " + old + ": " + copyFailed.getMessage());
        }
    }

    static SSLContext sslContext(List<String> hosts) throws Exception {
        Path dir = dir();
        Path store = dir.resolve("https.p12");
        Path stamp = dir.resolve("https-sans.txt");
        List<String> sans = sanList(hosts);
        String wanted = String.join(",", sans);
        if (!Files.exists(store) || !Files.exists(stamp) || !wanted.equals(Files.readString(stamp).trim())) {
            generate(store, sans);
            Files.writeString(stamp, wanted, StandardCharsets.UTF_8);
        }
        var ks = java.security.KeyStore.getInstance("PKCS12");
        try (var in = Files.newInputStream(store)) {
            ks.load(in, PASS);
        }
        KeyManagerFactory kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
        kmf.init(ks, PASS);
        SSLContext ctx = SSLContext.getInstance("TLS");
        ctx.init(kmf.getKeyManagers(), null, null);
        return ctx;
    }

    private static List<String> sanList(List<String> hosts) {
        LinkedHashSet<String> out = new LinkedHashSet<>();
        out.add("localhost");
        out.add("127.0.0.1");
        out.add(LanNames.SHORT + ".local");
        for (String host : hosts) {
            if (host != null && !host.isBlank()) {
                out.add(host.trim());
            }
        }
        return new ArrayList<>(out);
    }

    private static void generate(Path store, List<String> hosts) throws Exception {
        Files.deleteIfExists(store);
        Path keytool = Path.of(System.getProperty("java.home"), "bin", "keytool.exe");
        if (!Files.isRegularFile(keytool)) {
            keytool = Path.of(System.getProperty("java.home"), "bin", "keytool");
        }
        StringBuilder ext = new StringBuilder("SAN=");
        boolean first = true;
        for (String host : hosts) {
            if (!first) {
                ext.append(',');
            }
            first = false;
            ext.append(ipv4(host) ? "ip:" : "dns:").append(host);
        }
        Process proc = new ProcessBuilder(
                keytool.toString(),
                "-genkeypair",
                "-alias", "tm-mission-control",
                "-keyalg", "RSA",
                "-keysize", "2048",
                "-sigalg", "SHA256withRSA",
                "-validity", "825",
                "-storetype", "PKCS12",
                "-keystore", store.toString(),
                "-storepass", "tm-mission-control",
                "-keypass", "tm-mission-control",
                "-dname", "CN=" + LanNames.SHORT + ".local",
                "-ext", ext.toString(),
                "-noprompt")
                .redirectErrorStream(true)
                .start();
        String output = new String(proc.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        if (proc.waitFor() != 0) {
            throw new IllegalStateException("keytool failed: " + output);
        }
    }

    private static boolean ipv4(String host) {
        return host.matches("\\d{1,3}(\\.\\d{1,3}){3}");
    }

    static String preferPhoneHost(String fallback, List<String> ips) {
        if (ips.contains(fallback)) {
            return fallback;
        }
        return ips.isEmpty() ? fallback : ips.get(0);
    }
}
