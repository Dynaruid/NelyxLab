// SPDX-License-Identifier: BSD-3-Clause
package dev.nelyx.engine;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.widget.TextView;
import org.json.JSONObject;
import java.io.File;

/** Recovery and development replace a drained generation; application State resets. */
public final class MainActivity extends Activity {
    HostView host;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private File directory;
    private boolean emulator,resumed,destroyed,retiring,restart;
    private int recoveries,operation;
    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        try{directory=BundleInstaller.install(this);emulator=getIntent().getBooleanExtra("nelyxEmulator",false);open();}
        catch(Exception error){fail("Android startup failed",error);}
    }
    private void message(String text){TextView view=new TextView(this);view.setText(text);view.setPadding(32,64,32,32);setContentView(view);}
    private void fail(String stage,Throwable error){android.util.Log.e("NelyxV2",stage,error);message("Nelyx 앱을 시작할 수 없습니다.");}
    private void open(){
        if(destroyed)return;
        restart=false;retiring=false;HostView next=new HostView(this,directory.getPath(),emulator);host=next;
        next.onFailure(value->recover(next,value));setContentView(next);if(resumed)next.resume();
    }
    static boolean drained(JSONObject value){return value.optBoolean("closed")&&value.optInt("status",-1)==0&&value.optLong("memoryTotal",-1)==0&&value.optLong("reservedBytes",-1)==0&&value.optBoolean("workersJoined")&&value.optBoolean("appDisposed");}
    private void recover(HostView previous,JSONObject failure){
        if(destroyed||retiring||host!=previous)return;
        if(!failure.optBoolean("recoverable")||recoveries>=2){previous.close();fail("Android recovery unavailable",new IllegalStateException("host "+previous.host+": "+failure.optString("error","GPU recovery retry limit exceeded")));return;}
        recoveries++;retiring=true;message("화면을 복구하는 중입니다…");previous.close();
        retire(previous,++operation,value->{
            if(!drained(value)||!value.optBoolean("recoverable")){fail("Android recovery drain failed",new IllegalStateException(value.toString()));return;}
            android.util.Log.i("NelyxV2","V2_ANDROID_RECOVERED {\"previousHost\":"+previous.host+",\"attempt\":"+recoveries+",\"stateReset\":true}");
            restart=true;if(resumed)try{open();}catch(Exception error){fail("Android recovery startup failed",error);}
        });
    }
    private void retire(HostView previous,int serial,java.util.function.Consumer<JSONObject> complete){
        long deadline=SystemClock.uptimeMillis()+15000;
        handler.post(new Runnable(){@Override public void run(){
            if(destroyed||serial!=operation)return;
            try{JSONObject value=new JSONObject(NativeHost.snapshot(previous.host));
                if(value.optBoolean("closed")){complete.accept(value);return;}
                if(SystemClock.uptimeMillis()>=deadline){fail("Android generation drain timeout",new IllegalStateException("host "+previous.host+": "+value.optString("error")));return;}
                handler.postDelayed(this,16);
            }catch(Exception error){fail("Android generation drain failed",error);}
        }});
    }
    @Override protected void onNewIntent(Intent intent){
        super.onNewIntent(intent);setIntent(intent);
        if(!"close".equals(intent.getStringExtra("nelyxControl")))return;
        String ticket=intent.getStringExtra("nelyxTicket");long expected=intent.getLongExtra("nelyxHost",0);
        if((getApplicationInfo().flags&ApplicationInfo.FLAG_DEBUGGABLE)==0||ticket==null||!ticket.matches("[0-9a-f-]{36}")||host==null||expected!=host.host){android.util.Log.e("NelyxV2","Android development control rejected");return;}
        HostView previous=host;retiring=true;restart=false;previous.close();message("개발 세션을 정리하는 중입니다…");
        retire(previous,++operation,value->{
            if(!drained(value)||value.optBoolean("failed")&&!value.optBoolean("recoverable")){fail("Android development drain failed",new IllegalStateException(value.toString()));return;}
            android.util.Log.i("NelyxV2","V2_ANDROID_CONTROL {\"ticket\":\""+ticket+"\",\"host\":"+expected+",\"closed\":"+value+"}");finishAndRemoveTask();
        });
    }
    @Override protected void onResume(){super.onResume();resumed=true;if(restart){try{open();}catch(Exception error){fail("Android recovery startup failed",error);}}else if(host!=null&&!retiring)host.resume();}
    @Override protected void onPause(){resumed=false;if(host!=null)host.pause();super.onPause();}
    @Override protected void onDestroy(){destroyed=true;++operation;if(host!=null){host.close();host=null;}super.onDestroy();}
}
