// SPDX-License-Identifier: BSD-3-Clause
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.InputEvent;
import android.view.MotionEvent;
import java.lang.reflect.Method;

/** Injects one continuous Android touchscreen gesture along timed waypoints. */
public final class GalleryTouch {
    public static void main(String[] args) throws Exception {
        if (args.length == 1 && args[0].equals("--clock")) {
            System.out.println(System.nanoTime());
            return;
        }
        if (args.length == 1 && args[0].equals("--clocks")) {
            long before = System.nanoTime();
            long epoch = System.currentTimeMillis();
            System.out.println(before + "," + epoch + "," + System.nanoTime());
            return;
        }
        Class<?> managerClass;
        try {
            managerClass = Class.forName("android.hardware.input.InputManagerGlobal");
        } catch (ClassNotFoundException ignored) {
            managerClass = Class.forName("android.hardware.input.InputManager");
        }
        Object manager = managerClass.getMethod("getInstance").invoke(null);
        Method inject = managerClass.getMethod("injectInputEvent", InputEvent.class, int.class);
        MotionEvent.PointerProperties finger = new MotionEvent.PointerProperties();
        finger.id = 0;
        finger.toolType = MotionEvent.TOOL_TYPE_FINGER;
        MotionEvent.PointerProperties[] properties = {finger};
        MotionEvent.PointerCoords point = new MotionEvent.PointerCoords();
        point.pressure = 1f;
        point.size = 1f;
        MotionEvent.PointerCoords[] coordinates = {point};
        int step = Integer.parseInt(args[0]);
        float x = Float.parseFloat(args[1]), y = Float.parseFloat(args[2]);
        long started = System.nanoTime(), down = SystemClock.uptimeMillis(), deadline = down;
        long lastMovement = started;
        send(inject, manager, down, down, MotionEvent.ACTION_DOWN, x, y, properties, coordinates);
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
                // Keep velocity samples on the scripted path's clock.
                send(inject, manager, down, time, MotionEvent.ACTION_MOVE,
                    x + (nextX - x) * t, y + (nextY - y) * t, properties, coordinates);
            }
            if (nextX != x || nextY != y) lastMovement = System.nanoTime();
            x = nextX;
            y = nextY;
            deadline += duration;
        }
        long released = System.nanoTime();
        send(inject, manager, down, deadline, canceled ? MotionEvent.ACTION_CANCEL : MotionEvent.ACTION_UP,
            x, y, properties, coordinates);
        System.out.println(started + "," + released + "," + lastMovement);
    }

    private static void send(Method inject, Object manager, long down, long eventTime, int action, float x, float y,
            MotionEvent.PointerProperties[] properties, MotionEvent.PointerCoords[] coordinates)
            throws Exception {
        coordinates[0].x = x;
        coordinates[0].y = y;
        MotionEvent motion = MotionEvent.obtain(down, eventTime, action, 1,
            properties, coordinates, 0, 0, 1f, 1f, 0, 0, InputDevice.SOURCE_TOUCHSCREEN, 0);
        try {
            if (!(Boolean) inject.invoke(manager, motion, 0)) {
                throw new IllegalStateException("Android input injection failed");
            }
        } finally {
            motion.recycle();
        }
    }
}
