package com.reactnative.skia;

import android.os.Handler;
import android.os.Looper;

import com.facebook.jni.HybridData;
import com.facebook.proguard.annotations.DoNotStrip;
import com.facebook.react.bridge.ReactContext;

import java.io.IOException;
import java.net.MalformedURLException;
import java.net.URI;
import java.net.URISyntaxException;

public class PlatformContext {
    @DoNotStrip
    private final HybridData mHybridData;

    private final ReactContext mContext;

    private final String TAG = "PlatformContext";

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public PlatformContext(ReactContext reactContext) {
        mContext = reactContext;
        mHybridData = initHybrid(reactContext.getResources().getDisplayMetrics().density);
    }

    @DoNotStrip
    Object takeScreenshotFromViewTag(int tag) {
        return ViewScreenshotService.makeViewScreenshotFromTag(mContext, tag);
    }

    @DoNotStrip
    public byte[] getJniStreamFromSource(String sourceUri) throws IOException {
      try {
        // First try loading the input as a resource directly
        int resourceId = mContext.getResources().getIdentifier(sourceUri, "drawable", mContext.getPackageName());

        // Test to see if we have a raw resource (for SVG)
        if (resourceId == 0) {
            resourceId = mContext.getResources().getIdentifier(sourceUri, "raw", mContext.getPackageName());
        }

        if (resourceId != 0) {
            // We can just return the input stream directly
            return NelyxAssetStream.read(mContext.getResources().openRawResource(resourceId));
        }

        // We should try to open a connection and return a stream to download this
        // object
            URI uri = new URI(sourceUri);

            String scheme = uri.getScheme();

            // App-declared fonts are packaged once for both Skia and native editors.
            if ("asset".equals(scheme)) {
                String path = uri.getPath();
                if (uri.getRawAuthority() != null || uri.getRawQuery() != null || uri.getRawFragment() != null || path == null || !path.matches("^/nelyx/fonts/[a-f0-9]{64}\\.ttf$")) {
                    throw new IOException("Invalid owned Nelyx font asset URI");
                }
                return NelyxAssetStream.read(mContext.getAssets().open(path.substring(1)));
            }

            if (scheme == null)
                throw new Exception("Invalid URI scheme");

            // TODO: Base64??

            return NelyxAssetStream.read(uri.toURL());

        } catch (URISyntaxException e) {
            e.printStackTrace();
        } catch (MalformedURLException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }

    @Override
    protected void finalize() throws Throwable {
        mHybridData.resetNative();
        super.finalize();
    }

    @DoNotStrip
    public void raise(final String message) {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                mContext.handleException(new Exception(message));
            }
        });
    }

    @DoNotStrip
    public void notifyTaskReady() {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            notifyTaskReadyNative();
        } else {
            mainHandler.post(this::notifyTaskReadyNative);
        }
    }

    // Private c++ native methods
    private native HybridData initHybrid(float pixelDensity);

    private native void notifyTaskReadyNative();
}
