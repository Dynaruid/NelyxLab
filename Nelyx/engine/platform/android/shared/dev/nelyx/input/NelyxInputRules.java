// SPDX-License-Identifier: BSD-3-Clause
package dev.nelyx.input;

/** Shared by the RN carrier and the standalone host. Offsets are UTF-16 units. */
public final class NelyxInputRules {
    private NelyxInputRules() {}
    public static boolean boundary(CharSequence text, int index) {
        return index >= 0 && index <= text.length() && (index == 0 || index == text.length() || !Character.isHighSurrogate(text.charAt(index - 1)) || !Character.isLowSurrogate(text.charAt(index)));
    }
    public static void validate(CharSequence text, int anchor, int focus, int limit) {
        if (text.length() > limit || !boundary(text, anchor) || !boundary(text, focus)) throw new IllegalArgumentException("Input budget or UTF-16 boundary");
        for (int at = 0; at < text.length(); at++) {
            char unit = text.charAt(at);
            if (unit == 0 || Character.isLowSurrogate(unit)) throw new IllegalArgumentException("Invalid input UTF-16");
            if (Character.isHighSurrogate(unit) && (++at >= text.length() || !Character.isLowSurrogate(text.charAt(at)))) throw new IllegalArgumentException("Invalid input surrogate");
        }
    }
}
