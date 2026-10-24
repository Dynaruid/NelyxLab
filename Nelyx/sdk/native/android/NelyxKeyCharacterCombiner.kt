// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
package dev.nelyx.sdk.editing

/** Pinned KeyboardManager.CharacterCombiner; resolver is Android getDeadChar.
 * Keep the source Java Character/UTF-16 projection, including NUL and dead keys. */
internal class NelyxKeyCharacterCombiner(private val deadChar: (Int,Int)->Int) {
    private var combiningCharacter=0
    fun combine(codePoint: Int): String {
        var character=codePoint.toChar()
        if(codePoint and Int.MIN_VALUE!=0) {
            val plain=codePoint and Int.MAX_VALUE
            combiningCharacter=if(combiningCharacter!=0)deadChar(combiningCharacter,plain) else plain
        } else if(combiningCharacter!=0) {
            val combined=deadChar(combiningCharacter,codePoint)
            if(combined>0)character=combined.toChar()
            combiningCharacter=0
        }
        return character.toString()
    }
    /** Native owner/focus retirement must not leak a dead key into another View. */
    fun clear() {combiningCharacter=0}
}
