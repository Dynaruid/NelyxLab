// SPDX-License-Identifier: BSD-3-Clause
package dev.nelyx.engine;
import android.view.Surface;
public final class NativeHost {
    static { System.loadLibrary("nelyx_engine_android"); }
    private NativeHost() {}
    public static native String identity();
    public static native long open(String directory, boolean emulator, HostView services);
    public static native void surface(long host, Surface surface, long generation, int width, int height, double scale);
    public static native String snapshot(long host);
    public static native void frame(long host, long nanos, boolean visible);
    public static native boolean input(long host, int phase, int kind, int contact, double time, double x, double y, double dx, double dy, double velocity, int buttons, int modifiers, boolean wheel);
    public static native boolean edit(long host, long owner, long session, long revision, long publication, String text, int anchor, int focus, int composingStart, int composingEnd);
    public static native boolean action(long host, long owner, long publication, int action, double value);
    public static native boolean key(long host, int code, int modifiers, boolean down, boolean repeat);
    public static native void close(long host);
    public static native boolean forceLoss(long host);
}
