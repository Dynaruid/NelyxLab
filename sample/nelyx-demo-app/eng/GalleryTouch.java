// SPDX-License-Identifier: BSD-3-Clause
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.InputEvent;
import android.view.MotionEvent;
import java.lang.reflect.Method;

/** Injects one continuous Android touchscreen gesture along timed waypoints. */
public final class GalleryTouch {
    public static void main(String[] args) throws Exception {
        Class<?> managerClass;
        try {
            managerClass = Class.forName("android.hardware.input.InputManagerGlobal");
        } catch (ClassNotFoundException ignored) {
            managerClass = Class.forName("android.hardware.input.InputManager");
        }
        Object manager = managerClass.getMethod("getInstance").invoke(null);
        Method inject = managerClass.getMethod("injectInputEvent", InputEvent.class, int.class);
        int step = Integer.parseInt(args[0]);
        float x = Float.parseFloat(args[1]), y = Float.parseFloat(args[2]);
        long started = System.nanoTime(), down = SystemClock.uptimeMillis(), deadline = down;
        send(inject, manager, down, MotionEvent.ACTION_DOWN, x, y);
        boolean canceled = args[args.length - 1].equals("cancel");
        int end = canceled ? args.length - 1 : args.length;
        for (int i = 3; i < end; i += 3) {
            int duration = Integer.parseInt(args[i]);
            float nextX = Float.parseFloat(args[i + 1]), nextY = Float.parseFloat(args[i + 2]);
            int steps = (duration + step - 1) / step;
            for (int j = 1; j <= steps; j++) {
                long time = deadline + (long) duration * j / steps;
                long remaining = time - SystemClock.uptimeMillis();
                if (remaining > 0) SystemClock.sleep(remaining);
                float t = (float) j / steps;
                send(inject, manager, down, MotionEvent.ACTION_MOVE,
                    x + (nextX - x) * t, y + (nextY - y) * t);
            }
            x = nextX;
            y = nextY;
            deadline += duration;
        }
        send(inject, manager, down, canceled ? MotionEvent.ACTION_CANCEL : MotionEvent.ACTION_UP, x, y);
        System.out.println(started + "," + System.nanoTime());
    }

    private static void send(Method inject, Object manager, long down, int action, float x, float y)
            throws Exception {
        MotionEvent motion = MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, x, y, 0);
        motion.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        try {
            if (!(Boolean) inject.invoke(manager, motion, 0)) {
                throw new IllegalStateException("Android input injection failed");
            }
        } finally {
            motion.recycle();
        }
    }
}
