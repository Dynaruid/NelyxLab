// SPDX-License-Identifier: BSD-3-Clause
package dev.nelyx.sdk.editing

/** Root-owned ordering survives replacement of a nonvisual input carrier.
 * MotionEvent and KeyEvent timestamps share SystemClock.uptimeMillis(). */
internal class NelyxKeyboardFocusOrder {
    private var dismissedAt: Long?=null
    private var requestedAt: Double?=null
    private var admittedDismissal: Long?=null
    fun dismiss(timestamp: Long){require(timestamp>=0);dismissedAt=maxOf(dismissedAt ?: timestamp,timestamp)}
    fun admit(inputTimestamp: Double?,restore: Boolean,now: Long): Boolean {
        require(now>=0&& (inputTimestamp==null||inputTimestamp.isFinite()&&inputTimestamp>=0&&inputTimestamp<=now.toDouble()))
        if(inputTimestamp==null&&restore)return requestedAt!=null&&admittedDismissal==dismissedAt
        val candidate=inputTimestamp ?: now.toDouble()
        if(inputTimestamp!=null&&dismissedAt?.let {candidate<=it.toDouble()}==true)return false
        requestedAt=candidate;admittedDismissal=dismissedAt
        return true
    }
}
