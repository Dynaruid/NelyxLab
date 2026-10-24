// SPDX-License-Identifier: BSD-3-Clause
package dev.nelyx.sdk.editing

import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Rect
import android.graphics.RectF
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.Selection
import android.text.SpannableStringBuilder
import android.text.TextUtils
import android.text.InputType
import android.text.method.TextKeyListener
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.view.ViewStructure
import android.view.autofill.AutofillValue
import android.view.inputmethod.BaseInputConnection
import android.view.inputmethod.CursorAnchorInfo
import android.view.inputmethod.EditorBoundsInfo
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.ExtractedText
import android.view.inputmethod.ExtractedTextRequest
import android.view.inputmethod.InputConnection
import android.view.inputmethod.InputMethodManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.PointerEvents
import com.facebook.react.uimanager.ReactPointerEventsView
import com.facebook.react.uimanager.events.Event
import java.lang.ref.WeakReference

private class InputConnectionEvent(surface: Int,tag: Int,private val name: String,private val payload: WritableMap): Event<InputConnectionEvent>(surface,tag) {
    override fun getEventName(): String = name
    override fun canCoalesce(): Boolean = false
    override fun getEventData(): WritableMap = payload
}

internal data class InputConnectionValue(val text: String,val anchor: Int,val focus: Int,val composingStart: Int,val composingEnd: Int,val revision: Long)
private data class InputOwner(val id: String,val generation: Long)
private data class InputGeometry(val viewport: Long,val epoch: Long,val bounds: RectF,val clip: RectF,val caret: RectF,val baselineX: Float,val baselineY: Float,val text: String,val characterStart: Int,val characters: List<RectF>)
private data class InputReplacement(val text: String,val anchor: Int,val focus: Int,val request: Long?,val connection: Long)

/** An OS input buffer and focus endpoint. All visible editing UI belongs to Core/Skia. */
class NelyxInputConnectionView(private val reactContext: ThemedReactContext): View(reactContext),ReactPointerEventsView {
    override val pointerEvents: PointerEvents get()=PointerEvents.NONE
    private val keyboardFocusOrder=NelyxKeyboardFocusOrder()
    private var live=true
    private var initialized=false
    private var owner: InputOwner?=null
    private var buffer=SpannableStringBuilder()
    private var revision=0L
    private var signature: String?=null
    private var queued=false
    private var source="native"
    private var request: Long?=null
    private var rejection: String?=null
    private var submitted: String?=null
    private var pendingAction=false
    private var pendingReplacement: InputReplacement?=null
    private var activeConnection: Connection?=null
    private var retiringConnection: Connection?=null
    private var connectionSequence=0L
    private var batchDepth=0
    private var mutationDepth=0
    private var textLimit=4096
    private var multiline=false
    private var readOnly=false
    private var obscured=false
    private var inputKind=InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
    private var inputAction="done"
    private var actionCode=EditorInfo.IME_ACTION_DONE
    private var geometry: InputGeometry?=null
    private var geometryViewport=-1L
    private var geometryEpoch=-1L
    private var cursorUpdates=0
    private var extractedToken: Int?=null
    private var coreValue=""
    private var coreAnchor=0
    private var coreFocus=0
    private var keyboardHost: WeakReference<NelyxKeyboardHost>?=null
    private val uiHandler=Handler(Looper.getMainLooper())
    private val publishTask=Runnable {queued=false;publish()}
    private val cancellationTimeout=Runnable {
        val pending=pendingReplacement ?: return@Runnable
        pendingReplacement=null;request=pending.request;rejection=if(pending.request==null)null else "composing";source="native"
        if(pending.request==null)Log.w("NelyxInputConnection","Autofill was not applied because composition did not finish")
        updateIme();publish()
    }
    private val cancellationCompletion=Runnable {
        val pending=pendingReplacement ?: return@Runnable
        if(!live||BaseInputConnection.getComposingSpanStart(buffer)>=0)return@Runnable
        pendingReplacement=null;pendingAction=false;uiHandler.removeCallbacks(cancellationTimeout)
        if(pending.request!=null||acceptsSoftInput)applyReplacement(pending.text,pending.anchor,pending.focus,pending.request)else schedule()
        if(isFocused)imm.restartInput(this)
    }
    private val imm: InputMethodManager get()=context.getSystemService(android.content.Context.INPUT_METHOD_SERVICE) as InputMethodManager
    val acceptsSoftInput: Boolean get()=live&&isEnabled&&!readOnly

    init {
        isFocusable=true;isFocusableInTouchMode=true;setWillNotDraw(false)
        if(Build.VERSION.SDK_INT>=26)defaultFocusHighlightEnabled=false
        Selection.setSelection(buffer,0)
    }
    // Use the draw entry even for hardware display-list recording. No native
    // background, foreground, focus or autofill highlight belongs to this endpoint.
    override fun draw(canvas: Canvas) {}
    override fun isOpaque(): Boolean=false
    private fun ui(){check(Looper.myLooper()==Looper.getMainLooper()){"Input connections require their owning UI thread"}}
    private fun valid(text: CharSequence,anchor: Int,focus: Int) {
        require(text.length<=textLimit&&anchor in 0..text.length&&focus in 0..text.length){"Input buffer budget or selection"}
        var at=0
        while(at<text.length){val unit=text[at];require(unit!='\u0000'){"Input buffer contains NUL"};if(Character.isHighSurrogate(unit)){require(at+1<text.length&&Character.isLowSurrogate(text[at+1])){"Input buffer has an unpaired surrogate"};at+=2}else{require(!Character.isLowSurrogate(unit)){"Input buffer has an unpaired surrogate"};at++}}
        validOffset(text,anchor);validOffset(text,focus)
    }
    private fun validOffset(text: CharSequence,index: Int){require(index in 0..text.length);require(index==0||index==text.length||!Character.isHighSurrogate(text[index-1])||!Character.isLowSurrogate(text[index])){"Input offset splits a surrogate"}}
    internal fun readValue(): InputConnectionValue {
        ui();return InputConnectionValue(buffer.toString(),Selection.getSelectionStart(buffer),Selection.getSelectionEnd(buffer),BaseInputConnection.getComposingSpanStart(buffer),BaseInputConnection.getComposingSpanEnd(buffer),revision)
    }
    fun initialize(value: ReadableMap) {
        ui();if(initialized)return
        val document=requireNotNull(value.getMap("owner"));val id=requireNotNull(document.getString("id"));require(id.isNotEmpty()&&id.length<=512)
        val generation=integer(document,"generation");val text=value.getString("text") ?: "";val anchor=value.getInt("anchor");val focus=value.getInt("focus");valid(text,anchor,focus)
        owner=InputOwner(id,generation);buffer=SpannableStringBuilder(text);Selection.setSelection(buffer,anchor,focus);initialized=true;schedule()
    }
    fun setTextLimit(value: Int){require(value in 1..4096);require(buffer.length<=value);textLimit=value}
    fun configureCoreDocument(value: ReadableMap?){val text=value?.getString("value") ?: "";val selection=value?.getMap("selection");val anchor=selection?.getInt("anchor") ?: 0;val focus=selection?.getInt("focus") ?: 0;valid(text,anchor,focus);coreValue=text;coreAnchor=anchor;coreFocus=focus}
    fun configureEditing(value: ReadableMap?) {
        ui()
        fun flag(name: String,fallback: Boolean)=if(value?.hasKey(name)==true&&!value.isNull(name))value.getBoolean(name) else fallback
        multiline=flag("multiline",false);readOnly=flag("readOnly",false);obscured=flag("obscureText",false);require(!obscured||!multiline)
        val keyboard=if(value?.hasKey("keyboardType")==true)value.getString("keyboardType") ?: "text" else "text"
        val capitalization=if(value?.hasKey("capitalization")==true)value.getString("capitalization") ?: "sentences" else "sentences"
        var kind=when(keyboard){"text"->InputType.TYPE_CLASS_TEXT;"number"->InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_SIGNED;"decimal"->InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_SIGNED or InputType.TYPE_NUMBER_FLAG_DECIMAL;"phone"->InputType.TYPE_CLASS_PHONE;"email"->InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS;"url"->InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI;else->throw IllegalArgumentException("Unknown input keyboard")}
        if(kind and InputType.TYPE_MASK_CLASS==InputType.TYPE_CLASS_TEXT){
            kind=kind or when(capitalization){"none"->0;"sentences"->InputType.TYPE_TEXT_FLAG_CAP_SENTENCES;"words"->InputType.TYPE_TEXT_FLAG_CAP_WORDS;"characters"->InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS;else->throw IllegalArgumentException("Unknown input capitalization")}
            if(multiline)kind=kind or InputType.TYPE_TEXT_FLAG_MULTI_LINE
            if(flag("autocorrect",true)&&!obscured)kind=kind or InputType.TYPE_TEXT_FLAG_AUTO_CORRECT
            if(!flag("enableSuggestions",true)||obscured)kind=kind or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
        }
        if(obscured){require(keyboard in listOf("text","number","decimal"));kind=kind or if(kind and InputType.TYPE_MASK_CLASS==InputType.TYPE_CLASS_NUMBER)InputType.TYPE_NUMBER_VARIATION_PASSWORD else InputType.TYPE_TEXT_VARIATION_PASSWORD}
        inputKind=kind
        if(Build.VERSION.SDK_INT>=26){
            val hints=if(value?.hasKey("autofillHints")==true&&!value.isNull("autofillHints"))value.getArray("autofillHints") else null;require(hints==null||hints.size()<=32)
            val mapped=mutableListOf<String>();if(!readOnly&&hints!=null)for(index in 0 until hints.size()){val hint=requireNotNull(hints.getString(index));require(hint.length<=100&&hint.matches(Regex("^[a-zA-Z][a-zA-Z0-9-]*$")));mapped.add(when(hint){"email"->"emailAddress";"name"->"personName";"current-password"->"password";"new-password"->"newPassword";"one-time-code"->"smsOTPCode";"tel"->"phone";"street-address"->"postalAddress";"postal-code"->"postalCode";else->hint})}
            setAutofillHints(*mapped.toTypedArray());importantForAutofill=if(mapped.isEmpty())IMPORTANT_FOR_AUTOFILL_NO else IMPORTANT_FOR_AUTOFILL_YES
        }
        if(Build.VERSION.SDK_INT>=33)isAutoHandwritingEnabled=!readOnly&&!obscured
    }
    fun configureAction(value: String){inputAction=value;actionCode=when(value){"enter"->EditorInfo.IME_ACTION_NONE;"done"->EditorInfo.IME_ACTION_DONE;"go"->EditorInfo.IME_ACTION_GO;"next"->EditorInfo.IME_ACTION_NEXT;"previous"->EditorInfo.IME_ACTION_PREVIOUS;"search"->EditorInfo.IME_ACTION_SEARCH;"send"->EditorInfo.IME_ACTION_SEND;else->throw IllegalArgumentException("Unknown input action")}}
    override fun onCheckIsTextEditor(): Boolean=acceptsSoftInput
    override fun onCreateInputConnection(info: EditorInfo): InputConnection? {
        ui();if(!initialized||!acceptsSoftInput)return null
        val old=activeConnection;if(old!=null&&!old.closed&&BaseInputConnection.getComposingSpanStart(buffer)>=0){check(retiringConnection==null||retiringConnection===old);retiringConnection=old}
        val connection=Connection(++connectionSequence);activeConnection=connection
        info.inputType=inputKind;info.imeOptions=actionCode or EditorInfo.IME_FLAG_NO_FULLSCREEN or EditorInfo.IME_FLAG_NO_EXTRACT_UI
        if(multiline&&inputAction=="enter")info.imeOptions=info.imeOptions or EditorInfo.IME_FLAG_NO_ENTER_ACTION
        if(obscured)info.imeOptions=info.imeOptions or EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING
        info.initialSelStart=Selection.getSelectionStart(buffer);info.initialSelEnd=Selection.getSelectionEnd(buffer);info.initialCapsMode=TextUtils.getCapsMode(buffer,info.initialSelEnd,inputKind)
        if(Build.VERSION.SDK_INT>=30&&!obscured)info.setInitialSurroundingSubText(buffer,0)
        return connection
    }
    private fun copyBuffer(): SpannableStringBuilder {
        val copy=SpannableStringBuilder(buffer.toString());for(span in buffer.getSpans(0,buffer.length,Any::class.java))copy.setSpan(span,buffer.getSpanStart(span),buffer.getSpanEnd(span),buffer.getSpanFlags(span));return copy
    }
    private fun edit(connection: Connection,finishing: Boolean=false,operation: ()->Boolean): Boolean {
        ui();if(!live||connection.closed||!acceptsSoftInput&&!finishing||connection!==activeConnection&&connection!==retiringConnection)return false
        if(retiringConnection!=null&&connection!==retiringConnection||pendingReplacement!=null&&!finishing)return false
        return mutateBuffer(operation)
    }
    private fun mutateBuffer(operation: ()->Boolean): Boolean {
        ui()
        val before=if(mutationDepth==0)copyBuffer() else null;mutationDepth++
        try {
            val result=operation();valid(buffer,Selection.getSelectionStart(buffer),Selection.getSelectionEnd(buffer))
            val start=BaseInputConnection.getComposingSpanStart(buffer);val end=BaseInputConnection.getComposingSpanEnd(buffer)
            require(start==-1&&end==-1||start>=0&&end>=start){"Invalid input composition"}
            if(start>=0){validOffset(buffer,start);validOffset(buffer,end)}
            return result
        }
        catch(error: RuntimeException){if(error !is IllegalArgumentException&&error !is IndexOutOfBoundsException)throw error;if(before!=null)buffer=before;Log.w("NelyxInputConnection","Rejected an invalid IME update",error);return false}
        finally {mutationDepth--;if(mutationDepth==0){if(pendingReplacement!=null&&BaseInputConnection.getComposingSpanStart(buffer)<0)completeCancellation();else{if(pendingAction&&BaseInputConnection.getComposingSpanStart(buffer)<0){pendingAction=false;submitted=inputAction};updateIme();schedule()}}}
    }
    private inner class Connection(val identity: Long): BaseInputConnection(this@NelyxInputConnectionView,true) {
        var closed=false
        private var batches=0
        private val retiredBuffer=SpannableStringBuilder().apply {Selection.setSelection(this,0)}
        private val current: Boolean get()=live&&!closed&&(this===activeConnection||this===retiringConnection)
        override fun getEditable(): Editable=if(current)buffer else retiredBuffer
        override fun getHandler(): Handler=this@NelyxInputConnectionView.handler ?: Handler(Looper.getMainLooper())
        override fun beginBatchEdit(): Boolean {ui();if(!current||!acceptsSoftInput)return false;batches++;batchDepth++;return true}
        override fun endBatchEdit(): Boolean {ui();if(closed||!live)return false;if(batches>0){batches--;batchDepth--};if(batchDepth==0){updateIme();schedule()};return batches>0}
        override fun commitText(text: CharSequence?,cursor: Int): Boolean=edit(this){super.commitText(text,cursor)}
        override fun setComposingText(text: CharSequence?,cursor: Int): Boolean=edit(this){super.setComposingText(text,cursor)}
        override fun setComposingRegion(start: Int,end: Int): Boolean=edit(this){super.setComposingRegion(start,end)}
        override fun finishComposingText(): Boolean=edit(this,true){super.finishComposingText()}
        override fun setSelection(start: Int,end: Int): Boolean=edit(this){super.setSelection(start,end)}
        override fun deleteSurroundingText(before: Int,after: Int): Boolean=edit(this){super.deleteSurroundingText(before,after)}
        override fun deleteSurroundingTextInCodePoints(before: Int,after: Int): Boolean=edit(this){super.deleteSurroundingTextInCodePoints(before,after)}
        override fun getExtractedText(request: ExtractedTextRequest?,flags: Int): ExtractedText? {if(!current)return null;if(request!=null&&flags and InputConnection.GET_EXTRACTED_TEXT_MONITOR!=0)extractedToken=request.token;return extractedText()}
        override fun performEditorAction(action: Int): Boolean {
            if(closed||!isFocused||this!==activeConnection||action!=actionCode&&action!=EditorInfo.IME_NULL)return false
            return performInputAction()
        }
        override fun requestCursorUpdates(mode: Int): Boolean {
            if(!current)return false
            val supported=InputConnection.CURSOR_UPDATE_IMMEDIATE or InputConnection.CURSOR_UPDATE_MONITOR or InputConnection.CURSOR_UPDATE_FILTER_CHARACTER_BOUNDS or InputConnection.CURSOR_UPDATE_FILTER_INSERTION_MARKER or InputConnection.CURSOR_UPDATE_FILTER_EDITOR_BOUNDS
            if(mode and supported.inv()!=0)return false
            cursorUpdates=mode;if(mode!=0){if(!sendCursorInfo())requestBounds()};return true
        }
        override fun requestCursorUpdates(mode: Int,filter: Int): Boolean=requestCursorUpdates(mode or filter)
        override fun closeConnection() {
            ui();if(closed)return
            if(live&&(this===activeConnection||this===retiringConnection))super.closeConnection()
            closed=true;batchDepth-=batches;batches=0;if(activeConnection===this)activeConnection=null
            if(retiringConnection===this)retiringConnection=null
            if(live){if(pendingReplacement!=null&&pendingReplacement?.connection==identity&&BaseInputConnection.getComposingSpanStart(buffer)<0)completeCancellation();else{if(pendingAction&&BaseInputConnection.getComposingSpanStart(buffer)<0){pendingAction=false;submitted=inputAction};updateIme();schedule()}}
        }
    }
    private fun extractedText(): ExtractedText=ExtractedText().apply {text=buffer.toString();startOffset=0;partialStartOffset=-1;partialEndOffset=-1;selectionStart=Selection.getSelectionStart(buffer);selectionEnd=Selection.getSelectionEnd(buffer);flags=if(multiline)0 else ExtractedText.FLAG_SINGLE_LINE}
    private fun updateIme(){if(!live||!isFocused)return;val state=readValue();imm.updateSelection(this,state.anchor,state.focus,state.composingStart,state.composingEnd);extractedToken?.let {imm.updateExtractedText(this,it,extractedText())};if(cursorUpdates!=0&&!sendCursorInfo())requestBounds()}
    private fun schedule(){if(!live||!initialized||queued||batchDepth>0||mutationDepth>0||pendingReplacement!=null)return;queued=true;post(publishTask)}
    private fun emit(name: String,payload: WritableMap){if(!reactContext.hasActiveReactInstance()||id==NO_ID||!isAttachedToWindow)return;UIManagerHelper.getEventDispatcherForReactTag(reactContext,id)?.dispatchEvent(InputConnectionEvent(UIManagerHelper.getSurfaceId(this),id,name,payload))}
    private fun publish(){
        ui();if(!live||!initialized||pendingReplacement!=null||batchDepth>0||!isAttachedToWindow||id==NO_ID||!reactContext.hasActiveReactInstance())return
        val value=readValue();val next="${value.text}\u0000${value.anchor},${value.focus},${value.composingStart},${value.composingEnd},$isFocused"
        if(signature==next&&request==null&&submitted==null)return
        signature=next;check(revision<9007199254740991L);revision++
        val payload=Arguments.createMap().apply {putString("text",value.text);putInt("anchor",value.anchor);putInt("focus",value.focus);putInt("composingStart",value.composingStart);putInt("composingEnd",value.composingEnd);putDouble("revision",revision.toDouble());putString("source",source);putBoolean("focused",isFocused);request?.let {putDouble("request",it.toDouble())};rejection?.let {putString("rejection",it)};submitted?.let {putString("action",it)}}
        source="native";request=null;rejection=null;submitted=null;emit("topNelyxEditing",payload)
    }
    fun replaceFromCore(text: String,anchor: Int,focus: Int,expected: Long,requestId: Long,cancelComposition: Boolean){
        ui();if(!live)return;valid(text,anchor,focus);require(requestId in 1..9007199254740991L)
        if(queued){removeCallbacks(publishTask);queued=false};publish()
        if(expected!=revision){request=requestId;rejection="stale";publish();return}
        val composing=BaseInputConnection.getComposingSpanStart(buffer)>=0
        if(composing&&!cancelComposition){
            if(text==buffer.toString()&&pendingReplacement==null){geometry=null;Selection.setSelection(buffer,anchor,focus);source="programmatic";request=requestId;rejection=null;updateIme();publish();return}
            request=requestId;rejection="composing";publish();return
        }
        if(composing){
            val connection=retiringConnection ?: activeConnection
            if(connection==null){request=requestId;rejection="composing";publish();return}
            queueReplacement(InputReplacement(text,anchor,focus,requestId,connection.identity));return
        }
        clearPendingReplacement();applyReplacement(text,anchor,focus,requestId)
    }
    private fun clearPendingReplacement(){pendingReplacement=null;uiHandler.removeCallbacks(cancellationTimeout);uiHandler.removeCallbacks(cancellationCompletion)}
    private fun queueReplacement(value: InputReplacement){clearPendingReplacement();pendingReplacement=value;pendingAction=false;uiHandler.postDelayed(cancellationTimeout,5000);imm.restartInput(this)}
    private fun applyReplacement(text: String,anchor: Int,focus: Int,requestId: Long?){buffer=SpannableStringBuilder(text);Selection.setSelection(buffer,anchor,focus);source=if(requestId==null)"native" else "programmatic";request=requestId;rejection=null;updateIme();publish()}
    private fun completeCancellation(){
        if(pendingReplacement==null)return
        uiHandler.removeCallbacks(cancellationCompletion);uiHandler.post(cancellationCompletion)
    }
    private fun requestBounds(){if(!live||pendingReplacement!=null)return;publish();emit("topNelyxInputBounds",Arguments.createMap().apply {putInt("start",0);putInt("end",buffer.length);putDouble("revision",revision.toDouble())})}
    fun configureGeometry(packet: ReadableMap){
        ui();if(!live)return;publish();if(integer(packet,"nativeRevision")!=revision)return;val text=packet.getString("text") ?: return;if(text!=buffer.toString())return
        if(packet.isNull("geometry")){
            geometry=null
            if(isFocused&&cursorUpdates!=0){val state=readValue();imm.updateCursorAnchorInfo(this,CursorAnchorInfo.Builder().setMatrix(Matrix()).setSelectionRange(state.anchor,state.focus).build())}
            return
        }
        val value=requireNotNull(packet.getMap("geometry"));val document=requireNotNull(value.getMap("owner"));require(owner==InputOwner(requireNotNull(document.getString("id")),integer(document,"generation"))){"Foreign Core input geometry"}
        val viewport=integer(value,"viewportGeneration");val epoch=integer(value,"layoutEpoch");if(viewport<geometryViewport||viewport==geometryViewport&&epoch<geometryEpoch)return
        require(value.getString("coordinates")=="view-logical");val baseline=requireNotNull(value.getMap("caretBaseline"));val characters=if(packet.hasKey("characters")&&!packet.isNull("characters"))packet.getMap("characters") else null
        val boxes=characters?.getArray("rects");val start=characters?.getInt("rangeStart") ?: 0;require(start>=0&&(boxes?.size() ?: 0)<=4096&&start+(boxes?.size() ?: 0)<=buffer.length)
        if(characters!=null){val characterOwner=requireNotNull(characters.getMap("owner"));require(owner==InputOwner(requireNotNull(characterOwner.getString("id")),integer(characterOwner,"generation"))&&integer(characters,"viewportGeneration")==viewport&&integer(characters,"layoutEpoch")==epoch)}
        geometry=InputGeometry(viewport,epoch,rect(value,"bounds"),rect(value,"clip"),rect(value,"caret"),number(baseline,"x"),number(baseline,"y"),text,start,if(boxes==null)emptyList() else (0 until boxes.size()).map {rect(requireNotNull(boxes.getMap(it)))})
        geometryViewport=viewport;geometryEpoch=epoch
        if(cursorUpdates!=0&&!sendCursorInfo())requestBounds()
    }
    private fun screenMatrix(): Matrix {
        val matrix=Matrix();val coordinateView=host() ?: this
        fun append(view: View){val parent=view.parent as? View;if(parent!=null){append(parent);matrix.preTranslate(-parent.scrollX.toFloat(),-parent.scrollY.toFloat())};matrix.preTranslate(view.left.toFloat(),view.top.toFloat());if(!view.matrix.isIdentity)matrix.preConcat(view.matrix)}
        if(Build.VERSION.SDK_INT>=29)coordinateView.transformMatrixToGlobal(matrix)else append(coordinateView)
        val origin=floatArrayOf(0f,0f);matrix.mapPoints(origin);val screen=IntArray(2);coordinateView.getLocationOnScreen(screen);matrix.postTranslate(screen[0]-origin[0],screen[1]-origin[1])
        val density=resources.displayMetrics.density;matrix.preScale(density,density);return matrix
    }
    private fun sendCursorInfo(): Boolean {
        val value=geometry ?: return false;if(!live||!isFocused||value.text!=buffer.toString())return false
        val state=readValue();val builder=CursorAnchorInfo.Builder().setSelectionRange(state.anchor,state.focus).setMatrix(screenMatrix())
        fun flags(rect: RectF): Int {val visible=RectF.intersects(value.clip,rect);return (if(visible)CursorAnchorInfo.FLAG_HAS_VISIBLE_REGION else 0) or (if(!value.clip.contains(rect))CursorAnchorInfo.FLAG_HAS_INVISIBLE_REGION else 0)}
        builder.setInsertionMarkerLocation(value.baselineX,value.caret.top,value.baselineY,value.caret.bottom,flags(value.caret))
        if(state.composingStart>=0)builder.setComposingText(state.composingStart,buffer.subSequence(state.composingStart,state.composingEnd))
        for((index,box)in value.characters.withIndex())builder.addCharacterBounds(value.characterStart+index,box.left,box.top,box.right,box.bottom,flags(box))
        if(Build.VERSION.SDK_INT>=33)builder.setEditorBoundsInfo(EditorBoundsInfo.Builder().setEditorBounds(value.bounds).setHandwritingBounds(value.clip).build())
        imm.updateCursorAnchorInfo(this,builder.build())
        val filters=InputConnection.CURSOR_UPDATE_FILTER_CHARACTER_BOUNDS or InputConnection.CURSOR_UPDATE_FILTER_INSERTION_MARKER or InputConnection.CURSOR_UPDATE_FILTER_EDITOR_BOUNDS
        val needsCharacters=cursorUpdates and InputConnection.CURSOR_UPDATE_FILTER_CHARACTER_BOUNDS!=0||cursorUpdates and filters==0
        val complete=!needsCharacters||value.characterStart==0&&value.characters.size==buffer.length
        if(complete&&cursorUpdates and InputConnection.CURSOR_UPDATE_MONITOR==0)cursorUpdates=0
        return complete
    }
    override fun onKeyDown(code: Int,event: KeyEvent): Boolean {
        if(!acceptsSoftInput)return super.onKeyDown(code,event)
        if(!initialized||pendingReplacement!=null||retiringConnection!=null)return false
        if((code==KeyEvent.KEYCODE_ENTER||code==KeyEvent.KEYCODE_NUMPAD_ENTER)&&(!multiline||inputAction!="enter"||event.isCtrlPressed||event.isMetaPressed)){
            if(event.repeatCount==0)performInputAction()
            return true
        }
        return mutateBuffer {TextKeyListener.getInstance().onKeyDown(this,buffer,code,event)}||super.onKeyDown(code,event)
    }
    private fun performInputAction(): Boolean {
        if(!acceptsSoftInput||pendingReplacement!=null)return false
        if(BaseInputConnection.getComposingSpanStart(buffer)>=0){pendingAction=true;imm.restartInput(this)}else{submitted=inputAction;schedule()};return true
    }
    override fun onKeyUp(code: Int,event: KeyEvent): Boolean {if(!acceptsSoftInput)return super.onKeyUp(code,event);return TextKeyListener.getInstance().onKeyUp(this,buffer,code,event)||super.onKeyUp(code,event)}
    override fun getAutofillType(): Int=if(acceptsSoftInput)AUTOFILL_TYPE_TEXT else AUTOFILL_TYPE_NONE
    override fun getAutofillValue(): AutofillValue?=if(acceptsSoftInput)AutofillValue.forText(buffer) else null
    override fun autofill(value: AutofillValue){
        ui();if(!acceptsSoftInput||!value.isText)return
        val text=value.textValue?.toString() ?: return
        try{valid(text,text.length,text.length)}catch(error: IllegalArgumentException){Log.w("NelyxInputConnection","Rejected invalid autofill text",error);return}
        if(pendingReplacement?.request!=null){Log.w("NelyxInputConnection","Autofill was not applied while a Core replacement was pending");return}
        if(BaseInputConnection.getComposingSpanStart(buffer)>=0){
            val connection=retiringConnection ?: activeConnection
            if(connection==null){Log.w("NelyxInputConnection","Autofill needs a live composition connection");return}
            queueReplacement(InputReplacement(text,text.length,text.length,null,connection.identity));return
        }
        clearPendingReplacement();pendingAction=false;applyReplacement(text,text.length,text.length,null);if(isFocused)imm.restartInput(this)
    }
    override fun onProvideAutofillStructure(structure: ViewStructure,flags: Int){
        super.onProvideAutofillStructure(structure,flags);structure.setClassName("android.widget.EditText");structure.setInputType(inputKind);structure.setText(coreValue,coreAnchor,coreFocus)
        val value=geometry
        if(value==null){structure.setVisibility(INVISIBLE);return}
        val density=resources.displayMetrics.density;val bounds=value.bounds
        structure.setDimens((bounds.left*density).toInt(),(bounds.top*density).toInt(),0,0,(bounds.width()*density).toInt(),(bounds.height()*density).toInt())
    }
    private fun host(): NelyxKeyboardHost? {var ancestor=parent;while(ancestor!=null){if(ancestor is NelyxKeyboardHost)return ancestor;ancestor=ancestor.parent};return keyboardHost?.get()}
    override fun onAttachedToWindow(){super.onAttachedToWindow();keyboardHost=host()?.let {WeakReference(it)};signature=null;schedule()}
    override fun onLayout(changed: Boolean,left: Int,top: Int,right: Int,bottom: Int){super.onLayout(changed,left,top,right,bottom);if(changed&&cursorUpdates!=0&&!sendCursorInfo())requestBounds()}
    override fun onFocusChanged(focused: Boolean,direction: Int,previous: Rect?){super.onFocusChanged(focused,direction,previous);if(live&&focused&&Build.VERSION.SDK_INT>=26&&!autofillHints.isNullOrEmpty()&&acceptsSoftInput)importantForAutofill=if(host()?.let {NelyxAutofillContext.begin(reactContext.currentActivity,reactContext.reactApplicationContext,it)}==true)IMPORTANT_FOR_AUTOFILL_YES else IMPORTANT_FOR_AUTOFILL_NO;host()?.editorFocusChanged(focused);schedule()}
    override fun onKeyPreIme(keyCode: Int,event: KeyEvent): Boolean {
        if(live&&keyCode==KeyEvent.KEYCODE_BACK&&event.action==KeyEvent.ACTION_UP&&!event.isCanceled)(host()?.keyboardFocusOrder ?: keyboardFocusOrder).dismiss(event.eventTime)
        return super.onKeyPreIme(keyCode,event)
    }
    fun focusInput(inputTimestamp: Double?=null,restore: Boolean=false){
        if(!live||!isEnabled)return
        val show=(host()?.keyboardFocusOrder ?: keyboardFocusOrder).admit(inputTimestamp,restore,android.os.SystemClock.uptimeMillis())
        requestFocus();if(show&&acceptsSoftInput)imm.showSoftInput(this,0)
    }
    fun blurInput(){if(!live)return;if(isFocused)clearFocus();host()?.releaseEditor()}
    fun close(){ui();if(!live)return;val release=isFocused||imm.isActive(this);live=false;removeCallbacks(publishTask);uiHandler.removeCallbacks(cancellationTimeout);uiHandler.removeCallbacks(cancellationCompletion);pendingReplacement=null;activeConnection=null;retiringConnection=null;geometry=null;extractedToken=null;buffer.clearSpans();buffer.clear();Selection.setSelection(buffer,0);coreValue="";coreAnchor=0;coreFocus=0;owner=null;signature=null;request=null;rejection=null;submitted=null;pendingAction=false;clearFocus();if(release)host()?.releaseEditor();keyboardHost=null}
    private fun integer(value: ReadableMap,key: String): Long {val number=value.getDouble(key);require(number.isFinite()&&number>=0&&number<=9007199254740991.0&&number==number.toLong().toDouble());return number.toLong()}
    private fun number(value: ReadableMap,key: String): Float {val number=value.getDouble(key);require(number.isFinite()&&number.toFloat().isFinite());return number.toFloat()}
    private fun rect(value: ReadableMap,key: String): RectF=rect(requireNotNull(value.getMap(key)))
    private fun rect(value: ReadableMap): RectF {val x=number(value,"x");val y=number(value,"y");val width=number(value,"width");val height=number(value,"height");require(width>=0&&height>=0&&(x+width).isFinite()&&(y+height).isFinite());return RectF(x,y,x+width,y+height)}
}
