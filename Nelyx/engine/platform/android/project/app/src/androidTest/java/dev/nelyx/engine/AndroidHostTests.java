// SPDX-License-Identifier: BSD-3-Clause
package dev.nelyx.engine;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.os.Bundle;
import android.os.SystemClock;
import android.graphics.Rect;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.concurrent.Callable;
import java.util.concurrent.atomic.AtomicReference;

/** Actual Android InputConnection/provider/Activity APIs against the installed C++ app. */
public final class AndroidHostTests extends Instrumentation {
    private int checks;
    private MainActivity activity;
    private HostView view;
    private long deadline;
    private boolean original;
    @Override public void onCreate(Bundle args){super.onCreate(args);original=args!=null&&"original".equals(args.getString("mode"));start();}
    private void check(boolean condition,String message){checks++;if(!condition)throw new AssertionError(message);if(SystemClock.uptimeMillis()>deadline)throw new AssertionError("20-minute Android test timeout");}
    private <T> T ui(Callable<T> task){AtomicReference<T> result=new AtomicReference<>();AtomicReference<Throwable> error=new AtomicReference<>();runOnMainSync(()->{try{result.set(task.call());}catch(Throwable failure){error.set(failure);}});if(error.get()!=null)throw new AssertionError("Android UI operation failed",error.get());return result.get();}
    private JSONObject state(){return ui(()->{view.readState(true);return new JSONObject(view.state.toString());});}
    private void waitUntil(Callable<Boolean> condition,String name)throws Exception{long end=SystemClock.uptimeMillis()+30000;while(SystemClock.uptimeMillis()<end){if(condition.call())return;SystemClock.sleep(30);}throw new AssertionError("Timed out: "+name+"; "+state());}
    private AccessibilityNodeInfo find(String label){AccessibilityNodeInfo root=getUiAutomation().getRootInActiveWindow();if(root==null)return null;ArrayList<AccessibilityNodeInfo> queue=new ArrayList<>();queue.add(root);for(int i=0;i<queue.size()&&i<512;i++){AccessibilityNodeInfo node=queue.get(i);if(label.contentEquals(node.getContentDescription()==null?"":node.getContentDescription())||label.contentEquals(node.getText()==null?"":node.getText()))return node;for(int child=0;child<node.getChildCount();child++){AccessibilityNodeInfo next=node.getChild(child);if(next!=null)queue.add(next);}}return null;}
    private void launch(){Intent intent=new Intent(getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK).putExtra("nelyxEmulator",true);activity=(MainActivity)startActivitySync(intent);view=activity.host;if(view==null)throw new AssertionError("Standalone Activity has no host");}
    private void ready()throws Exception{waitUntil(()->{JSONObject s=state();if(s.optBoolean("failed"))throw new AssertionError(s.optString("error"));return s.optBoolean("ready")&&!s.optBoolean("failed")&&s.optLong("frames")>0&&s.optLong("nativeCommands")>0&&s.optLong("nativeCommands")==s.optLong("sdkCommands");},"native/SDK execution and visible frame");}
    private void focusEditor()throws Exception{String label=original?"Original 한글":"Message";waitUntil(()->find(label)!=null,"virtual editor");check(find(label).performAction(AccessibilityNodeInfo.ACTION_FOCUS),"virtual node focuses the Core editor");waitUntil(()->state().optJSONObject("editor")!=null,"canonical editor mirror");ui(()->{view.requestFocus();return null;});}
    private String text(){return ui(()->view.input.value().text);}
    private void replace(InputConnection connection,String value){ui(()->{check(connection.setSelection(0,view.input.value().text.length()),"select all");check(connection.commitText(value,1),"commit replacement");return null;});}
    private void click(String label)throws Exception{click(label,false);}
    private void click(String label,boolean paddedEdge)throws Exception{waitUntil(()->find(label)!=null,"node "+label);Rect r=new Rect();find(label).getBoundsInScreen(r);long at=SystemClock.uptimeMillis();float y=paddedEdge?r.top+1:r.exactCenterY();MotionEvent down=MotionEvent.obtain(at,at,MotionEvent.ACTION_DOWN,r.exactCenterX(),y,0);MotionEvent up=MotionEvent.obtain(at,at+40,MotionEvent.ACTION_UP,r.exactCenterX(),y,0);try{sendPointerSync(down);sendPointerSync(up);}finally{down.recycle();up.recycle();}}
    private void closed(long owner)throws Exception{long end=SystemClock.uptimeMillis()+15000;JSONObject result=null;while(SystemClock.uptimeMillis()<end){result=new JSONObject(NativeHost.snapshot(owner));if(result.optBoolean("closed"))break;SystemClock.sleep(30);}check(result!=null&&result.optBoolean("closed"),"host disposal completed");check(result.getInt("status")==0&&result.getLong("memoryTotal")==0&&result.getLong("reservedBytes")==0&&result.getBoolean("workersJoined")&&!result.getBoolean("failed"),"owners drained without retained native/GPU/packet memory: "+result);}
    @Override public void onStart(){
        Bundle result=new Bundle();deadline=SystemClock.uptimeMillis()+1200000;
        try{
            launch();ready();JSONObject first=state();HashSet<Long> owners=new HashSet<>();for(String field:new String[]{"uiThread","appThread","contentThread","renderThread"})owners.add(first.getLong(field));check(owners.size()==4&&!owners.contains(0L),"four independent native owners");check(first.getBoolean("executionObserved")&&first.getLong("rejectedFallbacks")==0&&first.getLong("layoutWork")>0&&first.getLong("paragraphs")>0,"C++ work and zero TS fallback");
            click("Material 0",original);waitUntil(()->find("Material 1")!=null,"Material TypeScript State callback");
            click("Cupertino 0");waitUntil(()->find("Cupertino 1")!=null,"Cupertino TypeScript State callback");
            check(find("Enable feature").performAction(AccessibilityNodeInfo.ACTION_CLICK),"virtual switch action");waitUntil(()->find("Enable feature").isChecked(),"controlled switch accepted");
            check(find("Keep disabled").performAction(AccessibilityNodeInfo.ACTION_CLICK),"controlled refusal callback");SystemClock.sleep(250);check(!find("Keep disabled").isChecked(),"refused state remains canonical");
            if(original){
                waitUntil(()->find("Opacity 0.40")!=null,"original TypeScript AnimationController driven by the native frame clock");
                focusEditor();InputConnection originalInput=ui(()->view.onCreateInputConnection(new EditorInfo()));check(originalInput!=null,"original TextField creates the real OS connection");
                replace(originalInput,"refuse");waitUntil(()->text().equals("accepted"),"original onChanged correction ACK");
                replace(originalInput,"A😀한");waitUntil(()->text().equals("A😀한"),"original controller receives Core text");
                ui(()->{check(originalInput.setComposingRegion(3,4),"original composition starts");check(originalInput.setComposingText("글",1),"original composition updates");check(originalInput.finishComposingText(),"original composition ends");return null;});
                check(text().equals("A😀글"),"original UTF-16 composing controller");
                ui(()->{((android.view.inputmethod.InputMethodManager)getTargetContext().getSystemService(android.content.Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(view.getWindowToken(),0);return null;});
                check(find("Reset editor").performAction(AccessibilityNodeInfo.ACTION_CLICK),"original reset controller action");waitUntil(()->find("reset 한글")!=null,"original programmatic controller replacement");
                check(find("reset 한글").performAction(AccessibilityNodeInfo.ACTION_FOCUS),"refocus the programmatically replaced original editor");waitUntil(()->state().optJSONObject("editor")!=null&&text().equals("reset 한글"),"original replacement mirror");
                long lostOriginal=view.host;check(ui(()->NativeHost.forceLoss(lostOriginal)),"original App real Dawn device loss");
                waitUntil(()->ui(()->activity.host!=null&&activity.host.host!=lostOriginal),"original App automatic generation replacement");view=ui(()->activity.host);ready();
                JSONObject retiredOriginal=new JSONObject(NativeHost.snapshot(lostOriginal));check(MainActivity.drained(retiredOriginal)&&retiredOriginal.optBoolean("recoverable"),"original editor/font/State owners drained after loss");
                check(find("Material 0")!=null,"original State resets after recovery");
                long owner=view.host;ui(()->{activity.finish();return null;});closed(owner);
                result.putString("status","PASS");result.putInt("checks",checks);result.putLong("nativeCommands",first.getLong("nativeCommands"));result.putString("scope","Original TypeScript Material/Cupertino themes with explicit InkRipple, State, controlled callbacks, AnimationController, TextField IME/controller/focus, real Dawn loss/recovery and native owner drain; full API/catalog and physical/performance acceptance remain separate");finish(Activity.RESULT_OK,result);return;
            }
            focusEditor();waitUntil(()->!state().getJSONObject("editor").isNull("caret"),"published Skia caret geometry");InputConnection connection=ui(()->view.onCreateInputConnection(new EditorInfo()));check(connection!=null,"actual Android InputConnection created");ui(()->{check(connection.requestCursorUpdates(InputConnection.CURSOR_UPDATE_IMMEDIATE),"OS cursor anchor update");return null;});String initial=text();
            ui(()->{check(connection.beginBatchEdit()&&connection.beginBatchEdit(),"nested batch begins");check(connection.setSelection(0,view.input.value().text.length()),"batch select all");check(connection.commitText("A😀한",1),"UTF-16 batch commit");check(view.input.value().text.equals(initial),"Core unchanged before batch ACK");check(connection.endBatchEdit(),"nested batch end");check(view.input.value().text.equals(initial),"inner batch does not publish");check(connection.endBatchEdit(),"outer batch ACK");return null;});check(text().equals("A😀한"),"C++ committed mixed Unicode text");
            replace(connection,"A😀B");ui(()->{check(!connection.setSelection(2,2),"selection cannot split surrogate");check(connection.setSelection(3,3),"selection before B");check(!connection.deleteSurroundingText(1,0),"UTF-16 deletion cannot split surrogate");return null;});check(text().equals("A😀B"),"rejected delete restores Core mirror");
            ui(()->{check(connection.setSelection(4,4),"end selection");check(connection.deleteSurroundingTextInCodePoints(2,0),"code-point delete");return null;});check(text().equals("A"),"two code points differ from two UTF-16 units");
            replace(connection,"abcd");ui(()->{check(connection.setComposingRegion(1,3),"composing region");check(connection.setComposingText("한",1),"Hangul composing text");return null;});check(text().equals("a한d")&&state().getJSONObject("editor").getInt("composingStart")==1,"canonical composition mirror");ui(()->{check(connection.commitText("글",1),"finish Hangul commit");return null;});check(text().equals("a글d")&&state().getJSONObject("editor").getInt("composingStart")==-1,"composition committed in C++");
            replace(connection,"Aé");ui(()->{check(connection.sendKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN,KeyEvent.KEYCODE_DEL)),"hardware grapheme backspace");return null;});check(text().equals("A"),"hardware deletion removes one grapheme");
            ui(()->{check(connection.setSelection(0,1),"select for cursor test");check(connection.commitText("XYZ",0),"newCursorPosition zero");return null;});check(text().equals("XYZ")&&state().getJSONObject("editor").getInt("focus")==0,"Android newCursorPosition uses insertion origin");
            waitUntil(()->!state().getJSONObject("editor").isNull("caret"),"latest edit geometry before touch");click("Message");waitUntil(()->state().getJSONObject("editor").getInt("focus")==3,"real touch uses the published Skia hit position");check(text().equals("XYZ"),"touch selection preserves canonical text");
            ui(()->{((android.view.inputmethod.InputMethodManager)getTargetContext().getSystemService(android.content.Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(view.getWindowToken(),0);return null;});
            waitUntil(()->find("Password")!=null,"editor bounds after keyboard resize");
            InputConnection fresh=ui(()->view.onCreateInputConnection(new EditorInfo()));ui(()->{check(!connection.commitText("stale",1)&&!connection.finishComposingText(),"old connection rejected after reconnect");check(fresh.setComposingText("가",1),"new connection composition");fresh.closeConnection();return null;});check(state().getJSONObject("editor").getInt("composingStart")==-1,"close finishes composition without stale callback");
            AccessibilityNodeInfo password=find("Password");check(password!=null&&password.isPassword()&&(password.getText()==null||password.getText().length()==0),"virtual password does not expose private text");
            long previous=view.host;ActivityMonitor monitor=addMonitor(MainActivity.class.getName(),null,false);ui(()->{activity.recreate();return null;});MainActivity recreated=(MainActivity)waitForMonitorWithTimeout(monitor,30000);removeMonitor(monitor);check(recreated!=null,"Activity recreation delivered");activity=recreated;view=recreated.host;ready();closed(previous);check(view.host!=previous,"new Activity has a new native generation");check(!NativeHost.edit(previous,1,1,1,1,"late",0,0,-1,-1),"late JNI edit cannot enter new generation");
            focusEditor();InputConnection lostInput=ui(()->view.onCreateInputConnection(new EditorInfo()));long lost=view.host;
            check(ui(()->NativeHost.forceLoss(lost)),"real Dawn device loss admitted on emulator Render owner");
            waitUntil(()->ui(()->activity.host!=null&&activity.host.host!=lost),"automatic new host generation after GPU loss");view=ui(()->activity.host);ready();
            JSONObject lossClose=new JSONObject(NativeHost.snapshot(lost));check(MainActivity.drained(lossClose)&&lossClose.optBoolean("recoverable")&&lossClose.optBoolean("failed"),"lost GPU owner drained before restart: "+lossClose);
            check(!NativeHost.key(lost,13,0,true,false),"lost generation rejects late key");ui(()->{check(!lostInput.commitText("late",1),"lost input connection retired");return null;});
            click("Material 0");waitUntil(()->find("Material 1")!=null,"recovered host receives actual input with reset State");
            long finalOwner=view.host;ui(()->{activity.finish();return null;});closed(finalOwner);
            result.putString("status","PASS");result.putInt("checks",checks);result.putLong("nativeCommands",first.getLong("nativeCommands"));result.putString("scope","Android emulator: native owners/rendering, C++/SDK counters, Material/Cupertino callbacks, nested batch, Hangul composition, UTF-16/code-point/grapheme editing, stale connections, virtual accessibility, password and Activity drain; physical input/performance/scanout not verified");finish(Activity.RESULT_OK,result);
        }catch(Throwable error){android.util.Log.e("NelyxV2","Android host instrumentation failed",error);result.putString("status","FAIL");result.putString("error",error.toString());result.putInt("checks",checks);if(activity!=null)try{runOnMainSync(()->activity.finish());}catch(Throwable ignored){}finish(Activity.RESULT_CANCELED,result);}
    }
}
