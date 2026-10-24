// SPDX-License-Identifier: BSD-3-Clause
package dev.nelyx.sdk.editing

/** Real observations owned by one React application and its focused canvas.
 * This does not query global OS-held keys or guess USB positions. */
internal class NelyxObservedKeyboardState {
    data class Key(val keyCode: Int,val scanCode: Int)
    private var nextOwner=0L
    private var owner=0L
    private var closed=false
    private var overflow=false
    private val keys=linkedMapOf<Long,Key>()
    @Synchronized fun newOwner(): Long {if(closed)return 0L;check(nextOwner<9007199254740991L);return ++nextOwner}
    @Synchronized fun focus(value: Long) {if(closed)return;if(owner!=value){keys.clear();overflow=false;owner=value}}
    @Synchronized fun blur(value: Long) {if(owner==value){keys.clear();overflow=false;owner=0L}}
    @Synchronized fun observe(value: Long,keyCode: Int,scanCode: Int,up: Boolean) {
        if(closed||owner!=value)return
        val id=if(scanCode!=0)scanCode.toLong() else 0x100000000L+keyCode
        if(up){keys.remove(id);return}
        if(keys.containsKey(id))return
        if(keys.size>=1024){overflow=true;return}
        keys[id]=Key(keyCode,scanCode)
    }
    @Synchronized fun snapshot(): List<Key> {check(!closed&&!overflow){"Native observed keyboard snapshot unavailable"};return keys.values.toList()}
    @Synchronized fun close() {closed=true;keys.clear();owner=0L}
}
