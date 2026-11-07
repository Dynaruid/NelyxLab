// SPDX-License-Identifier: BSD-3-Clause
package dev.nelyx.engine;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.InputStream;
import java.util.HashSet;
import java.util.Locale;

/** Called exclusively by the native IO owner. No View or engine references. */
public final class HttpTransport {
    public int status, requests;
    public long size = -1;
    private HttpURLConnection connection;
    private InputStream stream;
    private volatile boolean cancelled;
    public void cancel(){cancelled=true;}
    private void checkCancelled()throws java.io.InterruptedIOException{if(cancelled)throw new java.io.InterruptedIOException("Android HTTP request cancelled");}
    public void open(String base, String key, String headers) throws Exception {
        // URL/Android's HTTP transport canonicalizes Unicode and raw spaces;
        // URI rejects otherwise valid public AssetBundle keys before transport.
        URL target = key.isEmpty() ? new URL(base) : new URL(new URL(base),key);
        URL origin = target;
        for (int hop = 0; hop <= 5; hop++) {
            checkCancelled();
            String scheme = target.getProtocol();
            if (!("https".equals(scheme) || "http".equals(scheme)) || target.getHost() == null || target.getUserInfo() != null) throw new IllegalArgumentException("HTTP(S) URL required");
            connection = (HttpURLConnection) target.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(3000);
            connection.setReadTimeout(2000);
            HashSet<String> names = new HashSet<>();
            boolean sameOrigin = origin.getProtocol().equals(target.getProtocol()) && origin.getHost().equalsIgnoreCase(target.getHost()) && port(origin) == port(target);
            if (!headers.isEmpty()) for (String header : headers.split("\r\n", -1)) {
                if (header.isEmpty()) continue;
                int colon = header.indexOf(':');
                if (colon <= 0 || names.size() >= 32) throw new IllegalArgumentException("Invalid HTTP header");
                String name = header.substring(0, colon), value = header.substring(colon + 1).trim();
                String folded = name.toLowerCase(Locale.ROOT);
                if (!name.matches("[!#$%&'*+.^_`|~0-9A-Za-z-]+") || !names.add(folded) || value.matches(".*[\\x00-\\x08\\x0a-\\x1f\\x7f].*")) throw new IllegalArgumentException("Invalid HTTP header");
                if (sameOrigin || !(folded.equals("authorization") || folded.equals("proxy-authorization") || folded.equals("cookie") || folded.equals("cookie2") || folded.equals("host"))) connection.setRequestProperty(name, value);
            }
            status = connection.getResponseCode(); requests++;
            checkCancelled();
            if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
                String next = connection.getHeaderField("Location");
                connection.disconnect(); connection = null;
                if (next == null || hop == 5) throw new IllegalArgumentException("HTTP redirect limit or missing location");
                target = new URL(target,next); continue;
            }
            size = connection.getContentLengthLong();
            stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            return;
        }
    }
    private static int port(URL url) { return url.getPort() >= 0 ? url.getPort() : url.getDefaultPort(); }
    public byte[] read() throws Exception {
        checkCancelled();
        if (stream == null) return null;
        byte[] bytes = new byte[65536];
        int count = stream.read(bytes);
        return count < 0 ? null : java.util.Arrays.copyOf(bytes, count);
    }
    public void close() { try { if (stream != null) stream.close(); } catch (Exception ignored) {} finally { stream = null; if (connection != null) connection.disconnect(); connection = null; } }
}
