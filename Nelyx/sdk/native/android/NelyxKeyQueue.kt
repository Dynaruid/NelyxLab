// SPDX-License-Identifier: BSD-3-Clause
package dev.nelyx.sdk.editing

/** UI-thread queue: only actual Core replies may release keys to Android.
 * A slow framework response is not an unhandled key. Focus/owner retirement
 * clears admissions; out-of-order replies finish in admission order, once. */
internal class NelyxKeyQueue<T>(private val finish: (T,Boolean)->Unit) {
    private class Pending<T>(val value: T,var handled: Boolean?=null)
    private val pending=linkedMapOf<Long,Pending<T>>()
    private var lastSequence=0L
    private var closed=false
    private var draining=false
    val pendingCount: Int get()=pending.size
    fun admit(sequence: Long,value: T): Boolean {
        if(closed)return false
        require(sequence>lastSequence);lastSequence=sequence
        pending[sequence]=Pending(value)
        return true
    }
    fun acknowledge(sequence: Long,handled: Boolean) {
        val item=pending[sequence] ?: return;if(item.handled!=null)return
        item.handled=handled;drain()
    }
    private fun drain() {
        if(draining)return;draining=true
        try {while(pending.isNotEmpty()) {val entry=pending.entries.first();val handled=entry.value.handled ?: break;pending.remove(entry.key);finish(entry.value.value,handled)}}
        finally {draining=false}
    }
    fun clear() {pending.clear()}
    fun close() {closed=true;clear()}
}
