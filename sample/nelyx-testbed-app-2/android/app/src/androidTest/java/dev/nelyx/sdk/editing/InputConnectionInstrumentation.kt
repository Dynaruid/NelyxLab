// SPDX-License-Identifier: BSD-3-Clause
package dev.nelyx.sdk.editing

import android.app.Activity
import android.app.Instrumentation
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Bundle
import android.view.autofill.AutofillValue
import android.view.MotionEvent
import android.view.InputDevice
import com.facebook.react.bridge.ReadableMap
import android.view.View
import android.view.KeyEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.inputmethod.ExtractedTextRequest
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.widget.TextView
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.TouchTargetHelper
import com.facebook.react.views.view.ReactViewGroup

/** Real Android BaseInputConnection/buffer and View paint regression.
 * Actual application/IME interaction, Core pixels and physical input are separate checks. */
class InputConnectionInstrumentation: Instrumentation() {
    override fun onCreate(arguments: Bundle?){super.onCreate(arguments);start()}
    override fun onStart(){
        val result=Bundle()
        var editor: NelyxInputConnectionView?=null
        var connection: InputConnection?=null
        fun main(action: ()->Unit){var failure: Throwable?=null;runOnMainSync {try{action()}catch(error: Throwable){failure=error}};failure?.let {throw it}}
        try {
            // A real UI-thread delay longer than the former one-second fallback
            // must not release keys that Core can still handle afterwards.
            val replies=mutableListOf<Pair<Int,Boolean>>()
            val keyQueue=NelyxKeyQueue<Int> {value,handled->replies.add(value to handled)}
            main {for(sequence in 1..65)check(keyQueue.admit(sequence.toLong(),sequence));check(replies.isEmpty())}
            Thread.sleep(1200)
            main {
                check(replies.isEmpty()&&keyQueue.pendingCount==65){"Neither response latency nor queue pressure may fabricate unhandled keys"}
                keyQueue.acknowledge(65,false);keyQueue.acknowledge(65,true)
                check(replies.isEmpty()){"A later reply must wait for the first admitted key"}
                keyQueue.acknowledge(1,true);keyQueue.acknowledge(3,false)
                check(replies==listOf(1 to true))
                keyQueue.acknowledge(2,false);check(replies==listOf(1 to true,2 to false,3 to false))
                for(sequence in 4..64)keyQueue.acknowledge(sequence.toLong(),true)
                check(replies.map {it.first}==(1..65).toList()&&replies.last()==(65 to false)&&keyQueue.pendingCount==0)
                check(keyQueue.admit(66,66));keyQueue.clear();keyQueue.acknowledge(66,false)
                check(replies.size==65){"A retired focus admission must not reach a new native target"}
                check(keyQueue.admit(67,67));keyQueue.close();keyQueue.acknowledge(67,false)
                check(!keyQueue.admit(68,68)&&keyQueue.pendingCount==0&&replies.size==65)
                val reentrantReplies=mutableListOf<Int>()
                lateinit var reentrant: NelyxKeyQueue<Int>
                reentrant=NelyxKeyQueue {value,_->reentrantReplies.add(value);if(value==1){check(reentrant.admit(3,3));reentrant.acknowledge(3,false)}}
                check(reentrant.admit(1,1));check(reentrant.admit(2,2));reentrant.acknowledge(2,false);reentrant.acknowledge(1,true)
                check(reentrantReplies==listOf(1,2,3)&&reentrant.pendingCount==0)
            }
            main {
                val context=targetContext
                val themed=ThemedReactContext(BridgeReactContext(context),context,"back-order-regression",-1)
                val keyboardRoot=NelyxKeyboardHost(themed)
                val origin=android.os.SystemClock.uptimeMillis()
                check(keyboardRoot.keyboardFocusOrder.admit(origin.toDouble(),false,origin))
                android.os.SystemClock.sleep(2)
                val back=android.os.SystemClock.uptimeMillis()
                keyboardRoot.dispatchKeyEventPreIme(KeyEvent(back,back,KeyEvent.ACTION_UP,KeyEvent.KEYCODE_BACK,0))
                check(!keyboardRoot.keyboardFocusOrder.admit(origin.toDouble(),false,back)){"Delayed native pointer focus cannot reopen the IME after a newer Back"}
                check(!keyboardRoot.keyboardFocusOrder.admit(null,true,back)){"Automatic carrier restoration cannot turn the old intent into a new show"}
                val replacementCarrier=NelyxInputConnectionView(themed);keyboardRoot.addView(replacementCarrier)
                check(!keyboardRoot.keyboardFocusOrder.admit(back.toDouble(),false,back)){"A carrier replacement retains the root Back cutoff, including equal timestamps"}
                android.os.SystemClock.sleep(2)
                val newer=android.os.SystemClock.uptimeMillis()
                check(keyboardRoot.keyboardFocusOrder.admit(newer.toDouble(),false,newer)){"A genuine newer input can reopen the keyboard"}
                check(keyboardRoot.keyboardFocusOrder.admit(null,false,newer)){"An explicit programmatic keyboard request remains valid"}
                replacementCarrier.close();keyboardRoot.removeView(replacementCarrier);keyboardRoot.close()
                val view=NelyxInputConnectionView(ThemedReactContext(BridgeReactContext(context),context,"input-regression",-1));editor=view
                val early=NelyxInputConnectionView(ThemedReactContext(BridgeReactContext(context),context,"early-key-regression",-1))
                try {
                    early.initialize(JavaOnlyMap.of("owner",JavaOnlyMap.of("id","early-input","generation",1.0),"text","before","anchor",6,"focus",6))
                    check(early.onKeyDown(KeyEvent.KEYCODE_Z,KeyEvent(KeyEvent.ACTION_DOWN,KeyEvent.KEYCODE_Z)))
                    check(early.readValue().text=="beforez"){"Actual hardware text must not depend on IME connection creation"}
                }finally{early.close()}
                check(!TextView::class.java.isInstance(view)){"OS input endpoint must not be a TextView"}
                val root=ReactViewGroup(context);root.id=101;val canvas=View(context);canvas.id=102;view.id=103
                root.addView(canvas);root.addView(view);root.layout(0,0,200,48);canvas.layout(0,0,200,48);view.layout(0,0,200,48)
                check(TouchTargetHelper.findTargetTagForTouch(100f,24f,root)==102){"The nonvisual endpoint must pass actual RN touch targeting to the Core canvas"}
                root.removeView(view)
                view.initialize(JavaOnlyMap.of("owner",JavaOnlyMap.of("id","native-input","generation",1.0),"text","A👩‍🚀B","anchor",1,"focus",1))
                verifyCoreGeometry(view)
                verifyInputAndSemanticsLifetimes()
                val info=EditorInfo();val input=requireNotNull(view.onCreateInputConnection(info));connection=input
                check(info.initialSelStart==1&&info.initialSelEnd==1)
                check(input.setComposingText("한",1));check(view.readValue().text=="A한👩‍🚀B")
                check(view.readValue().composingStart==1&&view.readValue().composingEnd==2)
                val activeBeforeSelection=view.readValue()
                view.replaceFromCore(activeBeforeSelection.text,2,1,activeBeforeSelection.revision,90,false)
                check(view.readValue().anchor==2&&view.readValue().focus==1&&view.readValue().composingStart==1&&view.readValue().composingEnd==2){"A Core selection-only command must preserve the actual BaseInputConnection composing spans"}
                check(input.setComposingText("한글",1));check(view.readValue().text=="A한글👩‍🚀B")
                view.replaceFromCore("",0,0,view.readValue().revision,7,false)
                check(view.readValue().composingStart==1&&view.readValue().text=="A한글👩‍🚀B"){"Ordinary replacement must preserve actual composition"}
                check(input.commitText("한국",1));check(view.readValue().text=="A한국👩‍🚀B"&&view.readValue().composingStart==-1)
                check(input.setSelection(3,1));check(view.readValue().anchor==3&&view.readValue().focus==1)
                val stable=view.readValue();check(!input.setSelection(4,4));check(view.readValue()==stable){"A surrogate-splitting selection must roll back"}
                check(!input.setComposingRegion(4,5));check(view.readValue()==stable){"A surrogate-splitting composition must roll back without reaching Core"}
                check(input.commitText("x",1));check(view.readValue().text=="Ax👩‍🚀B")
                view.configureAction("next");check(view.onKeyDown(KeyEvent.KEYCODE_ENTER,KeyEvent(KeyEvent.ACTION_DOWN,KeyEvent.KEYCODE_ENTER)))
                check(view.readValue().text=="Ax👩‍🚀B"){"Single-line hardware Enter must emit the configured action instead of a newline"}
                check(input.setSelection(7,7));check(input.deleteSurroundingTextInCodePoints(1,0));check(view.readValue().text=="Ax👩‍B")
                val before=view.readValue();check(!input.commitText("\uD800",1));check(view.readValue()==before){"Malformed UTF-16 must roll back text and spans"}
                check(input.setComposingText("조합",1));val composing=view.readValue();check(composing.composingStart>=0)
                view.replaceFromCore("cancelled",9,9,view.readValue().revision,8,true)
                view.autofill(AutofillValue.forText("must not win"))
                check(view.readValue()==composing){"restartInput alone cannot fabricate composition completion, nor can autofill replace a pending Core command"}
                check(input.finishComposingText())
            }
            waitForIdleSync()
            main {
                val view=requireNotNull(editor);check(view.readValue().text=="cancelled"&&view.readValue().composingStart==-1){"Replacement waits for actual finishComposingText"}
                val old=requireNotNull(connection);old.closeConnection();check(!old.commitText("late",1))
                val input=requireNotNull(view.onCreateInputConnection(EditorInfo()));connection=input
                check(input.setSelection(9,9));check(input.beginBatchEdit());check(input.setComposingText("value",1));check(!input.endBatchEdit())
                view.replaceFromCore("",0,0,view.readValue().revision,9,true)
                check(view.readValue().composingStart>=0);input.closeConnection()
            }
            waitForIdleSync()
            main {
                val view=requireNotNull(editor);check(view.readValue().text.isEmpty()&&view.readValue().composingStart==-1){"Real connection retirement completes cancellation"}
                val input=requireNotNull(view.onCreateInputConnection(EditorInfo()));connection=input
                check(input.setComposingText("조합",1));val composing=view.readValue()
                view.autofill(AutofillValue.forText("first autofill"));view.autofill(AutofillValue.forText("latest autofill"))
                check(view.readValue()==composing){"Autofill cannot fabricate composition completion"};check(input.finishComposingText())
            }
            waitForIdleSync()
            main {
                val view=requireNotNull(editor);check(view.readValue().text=="latest autofill"&&view.readValue().composingStart==-1){"The latest autofill waits for actual finishComposingText"}
                val input=requireNotNull(connection);check(input.setSelection(0,view.readValue().text.length));check(input.setComposingText("pending",1))
                view.autofill(AutofillValue.forText("superseded"));check(input.finishComposingText())
                view.replaceFromCore("Core wins",9,9,view.readValue().revision,11,false)
            }
            waitForIdleSync()
            main {
                val view=requireNotNull(editor);check(view.readValue().text=="Core wins"){"A later Core command must retire queued autofill completion"}
                val input=requireNotNull(connection);check(input.setSelection(0,view.readValue().text.length));check(input.setComposingText("timeout",1))
                view.autofill(AutofillValue.forText("must not apply"))
            }
            android.os.SystemClock.sleep(5100);waitForIdleSync()
            main {
                val view=requireNotNull(editor);check(view.readValue().text=="timeout"&&view.readValue().composingStart>=0){"Autofill timeout cannot claim successful completion"}
                val input=requireNotNull(connection);check(input.finishComposingText());check(view.readValue().text=="timeout"){"Late finish cannot resurrect timed-out autofill"}
                check(input.setSelection(0,view.readValue().text.length));check(input.setComposingText("다시",1))
                view.autofill(AutofillValue.forText("closed autofill"));check(view.readValue().composingStart>=0);input.closeConnection()
            }
            waitForIdleSync()
            main {
                val view=requireNotNull(editor);check(view.readValue().text=="closed autofill"&&view.readValue().composingStart==-1){"Actual closeConnection can complete pending autofill"}
                val before=view.readValue();view.autofill(AutofillValue.forText("\uD800"));check(view.readValue()==before){"Invalid autofill cannot mutate the buffer"}
                val retired=requireNotNull(view.onCreateInputConnection(EditorInfo()))
                val input=requireNotNull(view.onCreateInputConnection(EditorInfo()));connection=input
                check(retired.getTextBeforeCursor(100,0).isNullOrEmpty()&&retired.getExtractedText(ExtractedTextRequest(),0)==null){"A replaced connection cannot read the current document"}
                check(!retired.requestCursorUpdates(InputConnection.CURSOR_UPDATE_MONITOR))
                view.isEnabled=false
                check(!input.beginBatchEdit());check(!input.commitText("late",1));check(view.readValue()==before){"A disabled field rejects late IME edits"};view.isEnabled=true
                view.configureEditing(JavaOnlyMap.of("readOnly",true));check(view.onCreateInputConnection(EditorInfo())==null)
                view.configureCoreDocument(JavaOnlyMap.of("value","Core value","selection",JavaOnlyMap.of("anchor",8,"focus",3)))
                view.measure(View.MeasureSpec.makeMeasureSpec(200,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(48,View.MeasureSpec.EXACTLY));view.layout(0,0,200,48)
                view.setBackgroundColor(android.graphics.Color.MAGENTA);view.foreground=android.graphics.drawable.ColorDrawable(android.graphics.Color.CYAN)
                check(!view.isOpaque())
                val bitmap=Bitmap.createBitmap(200,48,Bitmap.Config.ARGB_8888)
                try {
                    val control=View(view.context).apply {setBackgroundColor(android.graphics.Color.MAGENTA);measure(View.MeasureSpec.makeMeasureSpec(200,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(48,View.MeasureSpec.EXACTLY));layout(0,0,200,48)}
                    control.draw(Canvas(bitmap));check(bitmap.getPixel(5,5)!=0){"The Android Canvas must paint an ordinary native View"};bitmap.eraseColor(0)
                    view.draw(Canvas(bitmap));val pixels=IntArray(200*48);bitmap.getPixels(pixels,0,200,0,0,200,48);check(pixels.all {it==0}){"The native input endpoint painted visible pixels"}}finally{bitmap.recycle()}
                view.close();editor=null
                check(input.getTextBeforeCursor(100,0).isNullOrEmpty()&&input.getExtractedText(ExtractedTextRequest(),0)==null){"Retired View input reads must be empty"}
            }
            main {verifyPointerHistory()}
            result.putString("status","PASS-scoped");result.putString("scope","Acknowledged native key ordering after a real 1.2s UI-thread delay and 65 admissions, duplicate/retired/reentrant replies, BaseInputConnection Korean composition/commit, Core selection-only commands preserving actual composing spans, directional selection, code-point deletion, malformed UTF-16 rollback, real finish/close cancellation, retired/disabled-connection rejection, actual finish/close autofill, timeout/late finish, Core supersession, retired reads, readOnly, zero View pixels with native decorations, geometry withdrawal/stale epoch rejection, separate input/semantics lifetimes and one accessibility proxy, and actual MotionEvent history/multitouch/cancel serialization")
            finish(Activity.RESULT_OK,result)
        }catch(error: Throwable){result.putString("status","FAIL");result.putString("error",error.stackTraceToString());finish(Activity.RESULT_CANCELED,result)}
        finally {main {editor?.close()}}
    }

    private fun verifyInputAndSemanticsLifetimes() {
        val context=ThemedReactContext(BridgeReactContext(targetContext),targetContext,"input-lifetime-regression",-1)
        val host=NelyxKeyboardHost(context);val logicalRoot=NelyxSemanticsView(context);val endpoint=NelyxInputConnectionView(context)
        endpoint.id=301;endpoint.importantForAccessibility=View.IMPORTANT_FOR_ACCESSIBILITY_NO
        logicalRoot.importantForAccessibility=View.IMPORTANT_FOR_ACCESSIBILITY_NO
        host.addView(logicalRoot);host.addView(endpoint);host.layout(0,0,240,160);logicalRoot.layout(0,0,240,160);endpoint.layout(0,0,1,1)
        endpoint.initialize(JavaOnlyMap.of("owner",JavaOnlyMap.of("id","input-lifetime","generation",1.0),"text","","anchor",0,"focus",0))
        val input=requireNotNull(endpoint.onCreateInputConnection(EditorInfo()))
        val manager=NelyxSemanticsManager()
        fun proxy(): NelyxSemanticsView {
            val view=NelyxSemanticsView(context);view.importantForAccessibility=View.IMPORTANT_FOR_ACCESSIBILITY_YES;view.layout(20,30,220,78)
            manager.textInput(view,JavaOnlyMap.of("value","한","anchor",1,"focus",1,"readOnly",false,"obscured",false,"multiline",false,"focused",true,"focusable",true,"enabled",true,"target",301))
            return view
        }
        try {
            check(input.setComposingText("한",1));val composing=endpoint.readValue();check(composing.composingStart==0)
            endpoint.configureCoreDocument(JavaOnlyMap.of("value","한","selection",JavaOnlyMap.of("anchor",1,"focus",1)))
            val endpointInfo=AccessibilityNodeInfo.obtain()
            try {endpoint.onInitializeAccessibilityNodeInfo(endpointInfo);check(endpointInfo.text==null&&endpointInfo.className!="android.widget.EditText"){"The input carrier must not publish a second editable accessibility node"}}finally{endpointInfo.recycle()}
            var semantics=proxy();logicalRoot.addView(semantics)
            var info=AccessibilityNodeInfo.obtain()
            try {semantics.onInitializeAccessibilityNodeInfo(info);check(info.className=="android.widget.EditText"&&info.text=="한"&&info.textSelectionStart==1&&info.textSelectionEnd==1&&info.isFocused&&info.isEditable)}finally{info.recycle()}
            logicalRoot.removeView(semantics);semantics=proxy();logicalRoot.addView(semantics)
            check(endpoint.parent===host&&endpoint.readValue()==composing){"Rebuilding the semantics proxy must not replace the live input endpoint"}
            logicalRoot.removeView(semantics)
            check(input.setComposingText("한글",1));check(endpoint.readValue().composingEnd==2){"A clipped semantics subtree must preserve actual InputConnection composition"}
            semantics=proxy();logicalRoot.addView(semantics)
            val children=ArrayList<View>();host.addChildrenForAccessibility(children)
            check(children.size==1&&children.single()===semantics){"Exactly one accessibility proxy must be exposed; the input endpoint must be excluded"}
            manager.textInput(semantics,JavaOnlyMap.of("value","••","anchor",2,"focus",1,"readOnly",true,"obscured",true,"multiline",false,"focused",false,"focusable",true,"enabled",true,"target",301))
            info=AccessibilityNodeInfo.obtain()
            try {semantics.onInitializeAccessibilityNodeInfo(info);check(info.text=="••"&&info.textSelectionStart==2&&info.textSelectionEnd==1&&info.isPassword&&!info.isEditable&&!info.isFocused)}finally{info.recycle()}
            check(input.commitText("한국",1));check(endpoint.readValue().text=="한국"&&endpoint.readValue().composingStart==-1)
            host.removeView(endpoint);endpoint.close();check(!input.commitText("late",1))
            check(!semantics.performAccessibilityAction(AccessibilityNodeInfo.ACTION_FOCUS,null)){"A retired native tag cannot focus another endpoint"}
        } finally {input.closeConnection();endpoint.close();host.removeAllViews();host.close()}
    }

    private fun verifyCoreGeometry(view: NelyxInputConnectionView){
        val cached=NelyxInputConnectionView::class.java.getDeclaredField("geometry").apply {isAccessible=true}
        val state=view.readValue()
        fun rect(x: Double,y: Double,width: Double,height: Double)=JavaOnlyMap.of("x",x,"y",y,"width",width,"height",height)
        fun geometry(epoch: Double)=JavaOnlyMap.of("coordinates","view-logical","owner",JavaOnlyMap.of("id","native-input","generation",1.0),"viewportGeneration",1.0,"layoutEpoch",epoch,"bounds",rect(10.0,20.0,180.0,48.0),"clip",rect(10.0,20.0,100.0,48.0),"caret",rect(30.0,25.0,1.0,30.0),"caretBaseline",JavaOnlyMap.of("x",30.0,"y",49.0))
        fun packet(value: JavaOnlyMap?,revision: Double=state.revision.toDouble())=JavaOnlyMap.of("geometry",value,"text",state.text,"characters",null,"nativeRevision",revision)
        view.configureGeometry(packet(geometry(10.0)));check(cached.get(view)!=null)
        view.configureGeometry(packet(null,state.revision.toDouble()+1));check(cached.get(view)!=null){"A stale native revision cannot withdraw current geometry"}
        view.configureGeometry(packet(null));check(cached.get(view)==null){"Unavailable Core geometry must clear cached IME coordinates"}
        view.configureGeometry(packet(geometry(9.0)));check(cached.get(view)==null){"Withdrawal cannot revive an older Core geometry epoch"}
        view.configureGeometry(packet(geometry(10.0)));check(cached.get(view)!=null){"The current epoch can restore withdrawn geometry"}
        view.configureGeometry(packet(null))
    }
    private fun verifyPointerHistory(){
        val type=Class.forName("com.reactnative.skia.AndroidPointerEvent")
        val constructor=type.getDeclaredConstructor(Integer.TYPE,Integer.TYPE,Integer.TYPE,MotionEvent::class.java,java.lang.Float.TYPE).apply {isAccessible=true}
        val read=type.getDeclaredMethod("getEventData").apply {isAccessible=true}
        val coalesces=type.getDeclaredMethod("canCoalesce").apply {isAccessible=true}
        fun payload(event: MotionEvent): ReadableMap {
            val packet=constructor.newInstance(1,2,42,event,2f);check(coalesces.invoke(packet)==false)
            return read.invoke(packet) as ReadableMap
        }
        val properties=arrayOf(MotionEvent.PointerProperties().apply {id=4;toolType=MotionEvent.TOOL_TYPE_FINGER},MotionEvent.PointerProperties().apply {id=7;toolType=MotionEvent.TOOL_TYPE_FINGER})
        fun points(vertical: Float)=arrayOf(MotionEvent.PointerCoords().apply {x=40f;y=vertical;pressure=1f;size=1f},MotionEvent.PointerCoords().apply {x=80f;y=vertical+20;pressure=1f;size=1f})
        val movement=MotionEvent.obtain(10,20,MotionEvent.ACTION_MOVE,2,properties,points(160f),0,0,1f,1f,0,0,InputDevice.SOURCE_TOUCHSCREEN,0)
        try {
            movement.addBatch(30,points(80f),0)
            val packet=payload(movement);check(packet.getInt("protocol")==1&&packet.getInt("nativeId")==42)
            val samples=requireNotNull(packet.getArray("samples"));check(samples.size()==4)
            for(index in 0..3){val value=requireNotNull(samples.getMap(index));check(value.getString("kind")=="move"&&value.getString("device")=="touch");check(value.getInt("pointer")==if(index%2==0)4 else 7);check(value.getDouble("timestamp")==if(index<2)20.0 else 30.0);check(value.getInt("buttons")==1)}
            check(samples.getMap(0)!!.getDouble("x")==20.0&&samples.getMap(0)!!.getDouble("y")==80.0&&samples.getMap(2)!!.getDouble("y")==40.0)
            movement.action=MotionEvent.ACTION_POINTER_DOWN or (1 shl MotionEvent.ACTION_POINTER_INDEX_SHIFT)
            val down=requireNotNull(payload(movement).getArray("samples"));check(down.size()==1&&down.getMap(0)!!.getString("kind")=="down"&&down.getMap(0)!!.getInt("pointer")==7)
            movement.action=MotionEvent.ACTION_POINTER_UP or (1 shl MotionEvent.ACTION_POINTER_INDEX_SHIFT)
            val up=requireNotNull(payload(movement).getArray("samples"));check(up.size()==1&&up.getMap(0)!!.getString("kind")=="up"&&up.getMap(0)!!.getInt("buttons")==0)
            movement.action=MotionEvent.ACTION_CANCEL
            val cancelled=requireNotNull(payload(movement).getArray("samples"));check(cancelled.size()==2);for(index in 0..1)check(cancelled.getMap(index)!!.getString("kind")=="cancel"&&cancelled.getMap(index)!!.getInt("buttons")==0)
        }finally{movement.recycle()}
    }

}
