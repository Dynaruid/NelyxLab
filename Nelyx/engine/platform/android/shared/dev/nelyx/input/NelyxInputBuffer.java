// SPDX-License-Identifier: BSD-3-Clause
package dev.nelyx.input;

import android.content.Context;
import android.content.ClipboardManager;
import android.content.ClipData;
import android.graphics.Matrix;
import android.graphics.RectF;
import android.os.Looper;
import android.text.Editable;
import android.text.Selection;
import android.text.SpannableStringBuilder;
import android.view.KeyEvent;
import android.view.KeyCharacterMap;
import android.view.View;
import android.view.inputmethod.BaseInputConnection;
import android.view.inputmethod.CursorAnchorInfo;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.ExtractedText;
import android.view.inputmethod.ExtractedTextRequest;
import android.view.inputmethod.InputConnection;
import android.view.inputmethod.InputMethodManager;
import android.text.InputType;
import android.icu.text.BreakIterator;
import java.util.Locale;

/** OS mirror only. A sink must return the canonical C++ ACK for every edit. */
public final class NelyxInputBuffer {
    public static final class Value {
        public final String text;
        public final int anchor, focus, composingStart, composingEnd, flags;
        public final long owner, session, revision, publication, metrics;
        public final RectF caret;
        public final float baseline;
        public Value(long owner, long session, long revision, long publication, long metrics, String text, int anchor, int focus, int start, int end, int flags, RectF caret, float baseline) {
            NelyxInputRules.validate(text, anchor, focus, 4096);
            if (!(start == -1 && end == -1) && !(start >= 0 && end >= start && NelyxInputRules.boundary(text, start) && NelyxInputRules.boundary(text, end))) throw new IllegalArgumentException("Invalid composing range");
            this.owner=owner; this.session=session; this.revision=revision; this.publication=publication; this.metrics=metrics; this.text=text; this.anchor=anchor; this.focus=focus; composingStart=start; composingEnd=end; this.flags=flags; this.caret=caret; this.baseline=baseline;
        }
    }
    public interface Sink { Value edit(Value observed, String text, int anchor, int focus, int start, int end); boolean action(Value observed); }
    private final View view;
    private final Sink sink;
    private final InputMethodManager imm;
    private final SpannableStringBuilder buffer = new SpannableStringBuilder();
    private Value core;
    private Connection active;
    private long generation;
    private boolean closed;
    private int cursorMode, extractedToken=-1, deadKey, mutationDepth;
    public NelyxInputBuffer(View view, Sink sink) {
        this.view=view; this.sink=sink; imm=(InputMethodManager)view.getContext().getSystemService(Context.INPUT_METHOD_SERVICE);
        Selection.setSelection(buffer,0);
    }
    private void ui(){if(Looper.myLooper()!=Looper.getMainLooper())throw new IllegalStateException("Input mirror requires its UI owner");}
    public Value value(){ui();return core;}
    public boolean editable(){return !closed && core!=null && (core.flags & 9)==0;}
    public void adopt(Value value) {
        ui(); if(closed)return;
        Value old=core;
        boolean identity = old==null || value==null || old.owner!=value.owner || old.session!=value.session;
        boolean changed = identity || old.revision!=value.revision;
        if(value!=null && old!=null && !identity && value.revision<old.revision)return;
        boolean restart=changed&&active!=null&&(active.batches>0 || old!=null&&old.composingStart>=0&&value!=null&&(value.composingStart<0||!old.text.equals(value.text)));
        if(restart){active.closed=true;active=null;generation++;}
        core=value;
        if(changed) restore();
        if(identity){generation++;if(active!=null)active.closed=true;active=null;cursorMode=0;extractedToken=-1;deadKey=0;if(view.hasFocus())imm.restartInput(view);}
        else if(restart&&view.hasFocus())imm.restartInput(view);
        updateIme();
    }
    private void restore(){
        buffer.clearSpans();buffer.replace(0,buffer.length(),core==null?"":core.text);
        if(core!=null && core.composingStart>=0){
            SpannableStringBuilder composing=new SpannableStringBuilder(core.text.substring(core.composingStart,core.composingEnd));
            BaseInputConnection.setComposingSpans(composing);
            buffer.replace(core.composingStart,core.composingEnd,composing);
        }
        Selection.setSelection(buffer,core==null?0:core.anchor,core==null?0:core.focus);
    }
    public InputConnection connect(EditorInfo info){
        ui();if(!editable())return null;
        if(active!=null)active.closed=true;
        active=new Connection(++generation);
        info.inputType=InputType.TYPE_CLASS_TEXT | ((core.flags&4)!=0?InputType.TYPE_TEXT_VARIATION_PASSWORD:(core.flags&2)!=0?InputType.TYPE_TEXT_FLAG_MULTI_LINE:0);
        info.imeOptions=EditorInfo.IME_FLAG_NO_FULLSCREEN|EditorInfo.IME_FLAG_NO_EXTRACT_UI|EditorInfo.IME_ACTION_DONE;
        if((core.flags&4)!=0)info.imeOptions|=EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING;
        info.initialSelStart=core.anchor;info.initialSelEnd=core.focus;
        return active;
    }
    private boolean submit(){
        if(!editable())return false;
        try {
            int a=Selection.getSelectionStart(buffer),f=Selection.getSelectionEnd(buffer),s=BaseInputConnection.getComposingSpanStart(buffer),e=BaseInputConnection.getComposingSpanEnd(buffer);
            NelyxInputRules.validate(buffer,a,f,4096);
            if(s>=0 && (!NelyxInputRules.boundary(buffer,s)||!NelyxInputRules.boundary(buffer,e)))throw new IllegalArgumentException("Composing boundary");
            Value result=sink.edit(core,buffer.toString(),a,f,s,e);
            if(result==null){restore();updateIme();return false;}
            core=result;restore();updateIme();return true;
        }catch(IllegalArgumentException error){restore();updateIme();return false;}
    }
    private ExtractedText extracted(){ExtractedText value=new ExtractedText();value.text=buffer.toString();value.startOffset=0;value.partialStartOffset=-1;value.partialEndOffset=-1;value.selectionStart=Selection.getSelectionStart(buffer);value.selectionEnd=Selection.getSelectionEnd(buffer);return value;}
    private void updateIme(){
        if(closed||core==null||!view.hasFocus())return;
        imm.updateSelection(view,Selection.getSelectionStart(buffer),Selection.getSelectionEnd(buffer),BaseInputConnection.getComposingSpanStart(buffer),BaseInputConnection.getComposingSpanEnd(buffer));
        if(extractedToken>=0)imm.updateExtractedText(view,extractedToken,extracted());
        if(cursorMode!=0 && core.caret!=null && active!=null && active.batches==0){
            Matrix matrix=new Matrix();int[] origin=new int[2];view.getLocationOnScreen(origin);matrix.setScale(view.getResources().getDisplayMetrics().density,view.getResources().getDisplayMetrics().density);matrix.postTranslate(origin[0],origin[1]);
            CursorAnchorInfo.Builder b=new CursorAnchorInfo.Builder().setMatrix(matrix).setSelectionRange(core.anchor,core.focus);
            RectF r=core.caret;b.setInsertionMarkerLocation(r.left,r.top,core.baseline,r.bottom,CursorAnchorInfo.FLAG_HAS_VISIBLE_REGION);
            if(core.composingStart>=0)b.setComposingText(core.composingStart,core.text.substring(core.composingStart,core.composingEnd));
            imm.updateCursorAnchorInfo(view,b.build());
        }
    }
    public boolean key(KeyEvent event){
        ui();if(!editable())return false;
        if(event.getAction()==KeyEvent.ACTION_UP)return true;
        if(event.getAction()!=KeyEvent.ACTION_DOWN)return false;
        int key=event.getKeyCode(),a=Selection.getSelectionStart(buffer),f=Selection.getSelectionEnd(buffer),lo=Math.min(a,f),hi=Math.max(a,f);
        if(event.isCtrlPressed()){
            int action=key==KeyEvent.KEYCODE_A?android.R.id.selectAll:key==KeyEvent.KEYCODE_C?android.R.id.copy:key==KeyEvent.KEYCODE_X?android.R.id.cut:key==KeyEvent.KEYCODE_V?android.R.id.paste:0;
            if(action!=0)return contextAction(action);
        }
        if(key==KeyEvent.KEYCODE_ENTER){if((core.flags&2)==0)return sink.action(core);BaseInputConnection.removeComposingSpans(buffer);buffer.replace(lo,hi,"\n");Selection.setSelection(buffer,lo+1);return submit();}
        if(key==KeyEvent.KEYCODE_DEL||key==KeyEvent.KEYCODE_FORWARD_DEL||key==KeyEvent.KEYCODE_DPAD_LEFT||key==KeyEvent.KEYCODE_DPAD_RIGHT){
            BreakIterator breaks=BreakIterator.getCharacterInstance(Locale.ROOT);breaks.setText(buffer.toString());
            boolean back=key==KeyEvent.KEYCODE_DEL||key==KeyEvent.KEYCODE_DPAD_LEFT;
            if(key==KeyEvent.KEYCODE_DEL||key==KeyEvent.KEYCODE_FORWARD_DEL){if(lo==hi){if(back)lo=Math.max(0,breaks.preceding(lo));else {hi=breaks.following(hi);if(hi==BreakIterator.DONE)hi=buffer.length();}}BaseInputConnection.removeComposingSpans(buffer);buffer.delete(lo,hi);Selection.setSelection(buffer,lo);}
            else {int next=back?breaks.preceding(f):breaks.following(f);if(next==BreakIterator.DONE)next=back?0:buffer.length();Selection.setSelection(buffer,event.isShiftPressed()?a:next,next);}
            return submit();
        }
        if(event.isCtrlPressed()||event.isAltPressed()||event.isMetaPressed())return false;
        int code=event.getUnicodeChar();if(code==0)return false;
        if((code&KeyCharacterMap.COMBINING_ACCENT)!=0){deadKey=code&KeyCharacterMap.COMBINING_ACCENT_MASK;return true;}
        String text;
        if(deadKey!=0){int combined=KeyCharacterMap.getDeadChar(deadKey,code);text=combined!=0?new String(Character.toChars(combined)):new String(Character.toChars(deadKey))+new String(Character.toChars(code));deadKey=0;}
        else text=new String(Character.toChars(code));
        BaseInputConnection.removeComposingSpans(buffer);buffer.replace(lo,hi,text);Selection.setSelection(buffer,lo+text.length());return submit();
    }
    private boolean contextAction(int action){
        if(!editable())return false;int a=Selection.getSelectionStart(buffer),f=Selection.getSelectionEnd(buffer),lo=Math.min(a,f),hi=Math.max(a,f);
        if(action==android.R.id.selectAll){Selection.setSelection(buffer,0,buffer.length());return submit();}
        ClipboardManager clipboard=(ClipboardManager)view.getContext().getSystemService(Context.CLIPBOARD_SERVICE);
        if(action==android.R.id.copy||action==android.R.id.cut){if((core.flags&4)!=0||lo==hi)return false;clipboard.setPrimaryClip(ClipData.newPlainText("",buffer.subSequence(lo,hi)));if(action==android.R.id.copy)return true;BaseInputConnection.removeComposingSpans(buffer);buffer.delete(lo,hi);Selection.setSelection(buffer,lo);return submit();}
        if(action==android.R.id.paste){ClipData data=clipboard.getPrimaryClip();if(data==null||data.getItemCount()<1)return false;CharSequence text=data.getItemAt(0).coerceToText(view.getContext());if(text==null||text.length()>4096)return false;BaseInputConnection.removeComposingSpans(buffer);buffer.replace(lo,hi,text);Selection.setSelection(buffer,lo+text.length());return submit();}return false;
    }
    public void close(){ui();if(closed)return;closed=true;generation++;if(active!=null)active.closed=true;active=null;core=null;buffer.clearSpans();buffer.clear();cursorMode=0;extractedToken=-1;if(view.hasFocus())imm.hideSoftInputFromWindow(view.getWindowToken(),0);}
    private interface Mutation { boolean run(); }
    private final class Connection extends BaseInputConnection {
        final long identity;int batches;boolean closed;
        Connection(long identity){super(view,true);this.identity=identity;}
        private boolean current(){ui();return !closed&&!NelyxInputBuffer.this.closed&&active==this&&identity==generation&&editable();}
        private boolean change(Mutation mutation){if(!current())return false;boolean result;mutationDepth++;try{result=mutation.run();if(!result)return false;NelyxInputRules.validate(buffer,Selection.getSelectionStart(buffer),Selection.getSelectionEnd(buffer),4096);}catch(IllegalArgumentException error){restore();return false;}finally{mutationDepth--;}return batches>0||mutationDepth>0||submit();}
        @Override public Editable getEditable(){return current()?buffer:null;}
        @Override public boolean beginBatchEdit(){if(!current()||batches>=32)return false;batches++;return true;}
        @Override public boolean endBatchEdit(){if(!current()||batches==0)return false;batches--;if(batches==0&&mutationDepth==0)return submit();return true;}
        @Override public boolean commitText(CharSequence text,int cursor){return text!=null&&change(()->super.commitText(text,cursor));}
        @Override public boolean setComposingText(CharSequence text,int cursor){return text!=null&&change(()->super.setComposingText(text,cursor));}
        @Override public boolean setComposingRegion(int start,int end){return change(()->super.setComposingRegion(start,end));}
        @Override public boolean finishComposingText(){return change(()->super.finishComposingText());}
        @Override public boolean setSelection(int start,int end){if(!NelyxInputRules.boundary(buffer,start)||!NelyxInputRules.boundary(buffer,end))return false;return change(()->super.setSelection(start,end));}
        @Override public boolean deleteSurroundingText(int before,int after){return before>=0&&after>=0&&change(()->super.deleteSurroundingText(before,after));}
        @Override public boolean deleteSurroundingTextInCodePoints(int before,int after){return before>=0&&after>=0&&change(()->super.deleteSurroundingTextInCodePoints(before,after));}
        @Override public boolean sendKeyEvent(KeyEvent event){return current()&&key(event);}
        @Override public boolean performContextMenuAction(int action){return current()&&contextAction(action);}
        @Override public boolean performEditorAction(int action){return current()&&sink.action(core);}
        @Override public boolean requestCursorUpdates(int mode){if(!current()||(mode&~3)!=0)return false;cursorMode=mode;updateIme();return true;}
        @Override public ExtractedText getExtractedText(ExtractedTextRequest request,int flags){if(!current())return null;if(request!=null&&(flags&InputConnection.GET_EXTRACTED_TEXT_MONITOR)!=0)extractedToken=request.token;return extracted();}
        @Override public void closeConnection(){ui();if(!current())return;batches=0;finishComposingText();closed=true;active=null;generation++;}
    }
}
