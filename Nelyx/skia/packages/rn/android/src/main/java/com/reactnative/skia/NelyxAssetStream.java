// SPDX-License-Identifier: BSD-3-Clause
package com.reactnative.skia;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLConnection;

/** A single, closed and bounded input read for resource and Metro asset bytes. */
final class NelyxAssetStream {
    static final int MAX_BYTES = 16 * 1024 * 1024;
    static final int TIMEOUT_MS = 15000;

    static byte[] read(InputStream input) throws IOException {
        try (InputStream stream = input; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = stream.read(buffer)) != -1) {
                if (count > MAX_BYTES - output.size()) throw new IOException("Nelyx asset exceeds 16 MiB");
                output.write(buffer, 0, count);
            }
            return output.toByteArray();
        }
    }

    static byte[] read(URL url) throws IOException {
        URLConnection connection = url.openConnection();
        connection.setConnectTimeout(TIMEOUT_MS);
        connection.setReadTimeout(TIMEOUT_MS);
        try {
            return read(connection.getInputStream());
        } finally {
            if (connection instanceof HttpURLConnection) ((HttpURLConnection) connection).disconnect();
        }
    }
}
