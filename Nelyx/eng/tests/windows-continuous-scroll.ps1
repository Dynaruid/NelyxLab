param([Parameter(Mandatory=$true)][string]$Executable,[ValidateSet('list','material','cupertino','mixed')][string]$Page='list',[ValidateRange(1,120)][int]$WheelDelta=15,[ValidateRange(20,2000)][int]$WheelPacketsPerLeg=80,[ValidateRange(3000,20000)][int]$InputDurationMs=3000,[ValidateRange(0,2147483647)][int]$TargetProcessId=0,[switch]$MouseMotion,[switch]$WindowTransitions,[switch]$Maximized,[switch]$FocusEditor,[switch]$CadenceOnly,[switch]$CaptionActivation,[ValidateRange(0.1,0.9)][double]$InputXFraction=(2.0/3.0))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes
Add-Type @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO.MemoryMappedFiles;
using System.Runtime.InteropServices;
using System.Threading;
public static class NelyxContinuousScroll {
  [StructLayout(LayoutKind.Sequential)] public struct Point { public int X,Y; }
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
  [StructLayout(LayoutKind.Sequential)] struct Mouse { public int X,Y; public uint Data,Flags,Time; public UIntPtr Extra; }
  [StructLayout(LayoutKind.Explicit)] struct Input { [FieldOffset(0)] public uint Type; [FieldOffset(8)] public Mouse Mouse; }
  [StructLayout(LayoutKind.Sequential)] struct BitmapInfo { public uint Size; public int Width,Height; public ushort Planes,Bits; public uint Compression,ImageSize; public int X,Y; public uint Used,Important; }
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out Point point);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr window,ref Point point);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr window,out Rect rect);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window,out Rect rect);
  [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr window);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr window,IntPtr after,int x,int y,int width,int height,uint flags);
  [DllImport("user32.dll")] static extern IntPtr SendMessageTimeoutW(IntPtr window,uint message,IntPtr wp,IntPtr lp,uint flags,uint timeout,out UIntPtr result);
  [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(Point point);
  [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr window,uint flags);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr window);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint process);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr window,int command);
  [DllImport("user32.dll")] public static extern bool PostMessageW(IntPtr window,uint message,IntPtr wp,IntPtr lp);
  [DllImport("winmm.dll")] public static extern uint timeBeginPeriod(uint period);
  [DllImport("winmm.dll")] public static extern uint timeEndPeriod(uint period);
  [DllImport("user32.dll")] static extern uint SendInput(uint count,Input[] inputs,int size);
  [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr window);
  [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr window,IntPtr dc);
  [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleDC(IntPtr dc);
  [DllImport("gdi32.dll")] static extern IntPtr CreateDIBSection(IntPtr dc,ref BitmapInfo info,uint usage,out IntPtr pixels,IntPtr section,uint offset);
  [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr dc,IntPtr item);
  [DllImport("gdi32.dll")] static extern bool BitBlt(IntPtr dc,int x,int y,int width,int height,IntPtr source,int sx,int sy,uint operation);
  [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr item);
  [DllImport("gdi32.dll")] static extern bool DeleteDC(IntPtr dc);
  public sealed class Result { public int Packets,ChangesDuringInput,ChangesAfterInput,PhysicalWidth,PhysicalHeight,Dpi; public long SurfaceUpdates; public double MaximumGapMs,FirstChangeMs,LastChangeMs,NativeBeginMs,SurfaceDurationMs,SurfaceFPS; public List<double> Changes=new List<double>(); }
  sealed class SurfaceCount { public long Count,View,Surface; public double At; }
  static SurfaceCount ReadSurfaceCount(IntPtr window) {
    uint pid;GetWindowThreadProcessId(window,out pid);
    using(var map=MemoryMappedFile.OpenExisting("Local\\NelyxInputTrace.v1."+pid))
    using(var view=map.CreateViewAccessor(0,0,MemoryMappedFileAccess.Read)) {
      if(view.ReadInt64(0)!=0x4e4c585452414345L||view.ReadInt64(8)!=1||view.ReadInt64(16)!=pid||view.ReadInt64(32)!=64||view.ReadInt64(40)!=8192||view.ReadInt64(72)!=1)throw new Exception("Surface counter owner/protocol changed");
      const long offset=128+27*64;
      for(int attempt=0;attempt<20;attempt++) {
        long count=view.ReadInt64(offset);
        if(count>0) {
          var result=new SurfaceCount { Count=count,View=view.ReadInt64(offset+24),Surface=view.ReadInt64(offset+32) };
          result.At=Stopwatch.GetTimestamp()*1000.0/Stopwatch.Frequency;
          if(view.ReadInt64(offset+16)==27&&view.ReadInt64(offset)==count)return result;
        }
        Thread.Sleep(1);
      }
      throw new Exception("Native surface counter unavailable");
    }
  }
  static void RequireInput(IntPtr window) {
    Point point;if(GetForegroundWindow()!=window||!GetCursorPos(out point)||GetAncestor(WindowFromPoint(point),2)!=window)throw new Exception("Input left the owned foreground window");
    if(GetAsyncKeyState(1)<0||GetAsyncKeyState(2)<0||GetAsyncKeyState(4)<0)throw new Exception("Release physical mouse buttons during the input test");
  }
  public static bool Activate(IntPtr window) {
    if(GetAsyncKeyState(1)<0||GetAsyncKeyState(2)<0||GetAsyncKeyState(4)<0)throw new Exception("Caption activation requires released physical mouse buttons");
    // Raise only this test's already discovered app window without activating
    // another surface. A fixed top-center point can fall in the DWM shadow or
    // stay behind the previously foreground application.
    if(!SetWindowPos(window,IntPtr.Zero,0,0,0,0,0x1|0x2|0x10|0x40))return false;
    Rect rect;if(!GetWindowRect(window,out rect))throw new Exception("Own caption unavailable");
    double scale=Math.Max(96u,GetDpiForWindow(window))/96.0;Point point=new Point();bool found=false;
    foreach(int offset in new[]{200,80,320})for(int y=8;y<=56&&!found;y+=4){
      var candidate=new Point { X=rect.Left+Math.Min((rect.Right-rect.Left)/3,(int)Math.Round(offset*scale)),Y=rect.Top+(int)Math.Round(y*scale) };
      UIntPtr hit;var packed=new IntPtr(unchecked((int)((uint)(ushort)candidate.X|((uint)(ushort)candidate.Y<<16))));
      if(GetAncestor(WindowFromPoint(candidate),2)==window&&SendMessageTimeoutW(window,0x84,IntPtr.Zero,packed,2,1000,out hit)!=IntPtr.Zero&&hit.ToUInt64()==2){point=candidate;found=true;break;}
    }
    if(!found)return false;
    SetCursorPos(point.X,point.Y);
    if(GetAncestor(WindowFromPoint(point),2)!=window)return false;
    var inputs=new[]{new Input { Type=0,Mouse=new Mouse { Flags=2 } },new Input { Type=0,Mouse=new Mouse { Flags=4 } }};
    if(SendInput(2,inputs,Marshal.SizeOf<Input>())!=2)throw new Exception("OS caption activation failed");
    return true;
  }
  public static void CloseAfterInput(IntPtr window) {
    var clock=Stopwatch.StartNew();double next=0;
    var input=new[]{new Input { Type=0,Mouse=new Mouse { Data=unchecked((uint)-15),Flags=0x800 } }};
    while(clock.Elapsed.TotalMilliseconds<1500){RequireInput(window);if(clock.Elapsed.TotalMilliseconds>=next){if(SendInput(1,input,Marshal.SizeOf<Input>())!=1)throw new Exception("OS close workload injection failed");next=clock.Elapsed.TotalMilliseconds+4;}Thread.Sleep(1);}
    PostMessageW(window,0x10,IntPtr.Zero,IntPtr.Zero);
  }
  public static Result Run(IntPtr window,int direction,int magnitude,int packetsPerLeg,int durationMs,int intervalMs,bool motion,bool capture,double inputXFraction) {
    Rect rect; Point origin=new Point();
    if(GetForegroundWindow()!=window||!GetClientRect(window,out rect)||!ClientToScreen(window,ref origin))throw new Exception("Own foreground client unavailable");
    var target=new Point { X=origin.X+(int)((rect.Right-rect.Left)*inputXFraction),Y=origin.Y+(rect.Bottom-rect.Top)*2/3 };
    SetCursorPos(target.X,target.Y);if(GetAncestor(WindowFromPoint(target),2)!=window)throw new Exception("Owned scroll target is occluded");
    int width=Math.Min(320,rect.Right-40),height=Math.Min(360,rect.Bottom-240);
    if(width<100||height<100)throw new Exception("Own list pixels unavailable");
    int sampleX=Math.Max(20,Math.Min(rect.Right-width-20,target.X-origin.X-width/2)),sampleY=Math.Max(180,Math.Min(rect.Bottom-height-20,target.Y-origin.Y-height/2));
    IntPtr screen=capture?GetDC(IntPtr.Zero):IntPtr.Zero,memory=capture?CreateCompatibleDC(screen):IntPtr.Zero,pixels=IntPtr.Zero;
    var info=new BitmapInfo { Size=(uint)Marshal.SizeOf<BitmapInfo>(),Width=width,Height=-height,Planes=1,Bits=32 };
    IntPtr bitmap=capture?CreateDIBSection(screen,ref info,0,out pixels,IntPtr.Zero,0):IntPtr.Zero,previous=capture?SelectObject(memory,bitmap):IntPtr.Zero;
    var buffer=new int[capture?width*height:0]; var result=new Result { PhysicalWidth=rect.Right-rect.Left,PhysicalHeight=rect.Bottom-rect.Top,Dpi=(int)GetDpiForWindow(window) }; var clock=Stopwatch.StartNew();
    Thread sender=null; Exception failure=null; int packets=0; bool stop=false;
    Func<ulong> hash=()=>{if(!capture)return 0UL;if(!BitBlt(memory,0,0,width,height,screen,origin.X+sampleX,origin.Y+sampleY,0x40cc0020))throw new Exception("Desktop pixel copy failed");Marshal.Copy(pixels,buffer,0,buffer.Length);ulong value=14695981039346656037UL;for(int i=0;i<buffer.Length;i+=3)value=unchecked((value^(uint)(buffer[i]&0xffffff))*1099511628211UL);return value;};
    try {
      ulong last=hash();var surfaceBegin=ReadSurfaceCount(window);SurfaceCount surfaceEnd=null;clock.Restart();result.NativeBeginMs=Stopwatch.GetTimestamp()*1000.0/Stopwatch.Frequency;
      sender=new Thread(()=>{var dpi=SetThreadDpiAwarenessContext(new IntPtr(-4));try { var input=new Input[1];double next=0;while(!Volatile.Read(ref stop)&&clock.Elapsed.TotalMilliseconds<durationMs){RequireInput(window);if(clock.Elapsed.TotalMilliseconds>=next){if(motion)SetCursorPos(target.X+(packets%2)*2,target.Y);input[0]=new Input { Type=0,Mouse=new Mouse { Data=unchecked((uint)(direction*magnitude*((packets/packetsPerLeg)%2==0?1:-1))),Flags=0x800 } };if(SendInput(1,input,Marshal.SizeOf<Input>())!=1)throw new Exception("OS wheel injection failed");Interlocked.Increment(ref packets);next=clock.Elapsed.TotalMilliseconds+intervalMs;}Thread.Sleep(1);} }catch(Exception error){failure=error;}finally{if(dpi!=IntPtr.Zero)SetThreadDpiAwarenessContext(dpi);}});
      sender.Start(); double lastChange=0;
      while(clock.Elapsed.TotalMilliseconds<durationMs+1200){if(surfaceEnd==null&&clock.Elapsed.TotalMilliseconds>=durationMs)surfaceEnd=ReadSurfaceCount(window);ulong current=hash();double now=clock.Elapsed.TotalMilliseconds;if(current!=last){result.Changes.Add(now);if(result.Changes.Count==1)result.FirstChangeMs=now;result.MaximumGapMs=Math.Max(result.MaximumGapMs,now-lastChange);lastChange=now;result.LastChangeMs=now;if(now<durationMs)result.ChangesDuringInput++;else result.ChangesAfterInput++;last=current;}Thread.Sleep(16);}
      if(surfaceEnd==null||surfaceBegin.View!=surfaceEnd.View||surfaceBegin.Surface!=surfaceEnd.Surface||surfaceEnd.Count<=surfaceBegin.Count)throw new Exception("Surface counter generation changed or no native surface updated during motion");
      result.SurfaceUpdates=surfaceEnd.Count-surfaceBegin.Count;result.SurfaceDurationMs=surfaceEnd.At-surfaceBegin.At;result.SurfaceFPS=result.SurfaceUpdates*1000.0/result.SurfaceDurationMs;
      if(capture)result.MaximumGapMs=Math.Max(result.MaximumGapMs,durationMs-Math.Min(lastChange,durationMs));
      sender.Join();if(failure!=null)throw failure;result.Packets=Volatile.Read(ref packets);return result;
    } finally { Volatile.Write(ref stop,true);if(sender!=null)sender.Join();if(capture){SelectObject(memory,previous);DeleteObject(bitmap);DeleteDC(memory);ReleaseDC(IntPtr.Zero,screen);} }
  }
}
'@
$application=$null; $originalPointer=New-Object NelyxContinuousScroll+Point; [NelyxContinuousScroll]::GetCursorPos([ref]$originalPointer)|Out-Null
$ownsApplication=$TargetProcessId -eq 0
$checks=@(); $drained=$false;$previousDpi=[NelyxContinuousScroll]::SetThreadDpiAwarenessContext([IntPtr](-4));$window=[IntPtr]::Zero;$lastInjectedPointer=$null
try {
  [NelyxContinuousScroll]::timeBeginPeriod(1)|Out-Null
  $start=[Diagnostics.ProcessStartInfo]::new($Executable)
  $start.WorkingDirectory=Split-Path -LiteralPath $Executable
  $start.UseShellExecute=$false; $start.RedirectStandardOutput=$true; $start.RedirectStandardError=$true
  if($CadenceOnly){$start.EnvironmentVariables.Remove('NELYX_TRACKPAD_DIAGNOSTICS');$start.EnvironmentVariables.Remove('NELYX_WINDOWS_FRAME_DIAGNOSTICS')}else{$start.EnvironmentVariables['NELYX_TRACKPAD_DIAGNOSTICS']='1';$start.EnvironmentVariables['NELYX_WINDOWS_FRAME_DIAGNOSTICS']='1'}
  $start.EnvironmentVariables['NELYX_WINDOWS_INPUT_TRACE']='1'
  if($ownsApplication){$application=[Diagnostics.Process]::Start($start);$stdout=$application.StandardOutput.ReadToEndAsync();$stderr=$application.StandardError.ReadToEndAsync()}else{
    $application=[Diagnostics.Process]::GetProcessById($TargetProcessId)
    if($application.MainModule.FileName -ne (Resolve-Path -LiteralPath $Executable).Path){throw 'Attached process executable identity mismatch'}
  }
  $deadline=[DateTime]::UtcNow.AddSeconds(25)
  do { if($application.HasExited){throw 'App exited during startup'};$application.Refresh();$window=$application.MainWindowHandle;if($window -eq [IntPtr]::Zero){Start-Sleep -Milliseconds 50} } while($window -eq [IntPtr]::Zero -and [DateTime]::UtcNow -lt $deadline)
  if($window -eq [IntPtr]::Zero){throw 'Visible app window unavailable'}
  if($CaptionActivation){$clicked=[NelyxContinuousScroll]::Activate($window);Write-Output ('CONTINUOUS_ACTIVATION '+(@{page=$Page;attempt='probe';ownedCaptionClicked=$clicked}|ConvertTo-Json -Compress));if(-not $clicked){throw 'Owned caption activation probe failed'};Start-Sleep -Milliseconds 150}
  for($attempt=0;$attempt -lt 3;$attempt++){[NelyxContinuousScroll]::SetForegroundWindow($window)|Out-Null;Start-Sleep -Milliseconds 150;if([NelyxContinuousScroll]::GetForegroundWindow() -eq $window){break};$clicked=[NelyxContinuousScroll]::Activate($window);Write-Output ('CONTINUOUS_ACTIVATION '+(@{page=$Page;attempt=$attempt;ownedCaptionClicked=$clicked}|ConvertTo-Json -Compress));Start-Sleep -Milliseconds 150}
  if([NelyxContinuousScroll]::GetForegroundWindow() -ne $window){throw 'Own foreground unavailable'}
  if($WindowTransitions){foreach($command in @(3,9)){[NelyxContinuousScroll]::ShowWindow($window,$command)|Out-Null;Start-Sleep -Milliseconds 400}}
  if($Maximized){[NelyxContinuousScroll]::ShowWindow($window,3)|Out-Null;Start-Sleep -Milliseconds 400}
  function Find-Action([string]$id){
    $condition=[Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::AutomationIdProperty,$id)
    $root=[Windows.Automation.AutomationElement]::FromHandle($window)
    return $root.FindFirst([Windows.Automation.TreeScope]::Descendants,$condition)
  }
  foreach($id in $(if($Page -eq 'list'){@('show-list-view','list-view-last')}elseif($Page -eq 'cupertino'){@('show-cupertino')}elseif($Page -eq 'mixed'){@('show-mixed-scroll')}else{@()})){
    $deadline=[DateTime]::UtcNow.AddSeconds(15);$action=$null
    do{$action=Find-Action $id;if($null -eq $action){Start-Sleep -Milliseconds 50}}while($null -eq $action -and [DateTime]::UtcNow -lt $deadline)
    if($null -eq $action){throw "Missing action $id"}
    ([Windows.Automation.InvokePattern]$action.GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern)).Invoke();Start-Sleep -Milliseconds 500
  }
  if($FocusEditor){
    if($Page -ne 'mixed'){throw 'Editor focus requires the mixed page'}
    $deadline=[DateTime]::UtcNow.AddSeconds(15);$editor=$null
    do{$editor=Find-Action 'mixed-scroll-field-0';if($null -eq $editor){Start-Sleep -Milliseconds 50}}while($null -eq $editor -and [DateTime]::UtcNow -lt $deadline)
    if($null -eq $editor){throw 'Missing first mixed editor'}
    $editor.SetFocus();Start-Sleep -Milliseconds 500
    if(-not $editor.Current.HasKeyboardFocus){throw 'Mixed editor did not acquire native focus'}
  }
  foreach($direction in $(if($Page -eq 'list'){@(1,-1)}else{@(-1,1)})){
    $observation=[NelyxContinuousScroll]::Run($window,$direction,$WheelDelta,$WheelPacketsPerLeg,$InputDurationMs,4,$MouseMotion.IsPresent,(-not $CadenceOnly.IsPresent),$InputXFraction)
    $checks+=@{direction=$direction;wheelDelta=$WheelDelta;wheelPacketsPerLeg=$WheelPacketsPerLeg;nativeBeginMs=$observation.NativeBeginMs;packets=$observation.Packets;changesDuringInput=$observation.ChangesDuringInput;changesAfterInput=$observation.ChangesAfterInput;firstChangeMs=$observation.FirstChangeMs;maximumGapMs=$observation.MaximumGapMs;physicalWidth=$observation.PhysicalWidth;physicalHeight=$observation.PhysicalHeight;dpi=$observation.Dpi;surfaceUpdates=$observation.SurfaceUpdates;surfaceDurationMs=$observation.SurfaceDurationMs;surfaceFPS=$observation.SurfaceFPS;surfaceScope=$(if($ownsApplication){'native surface-updated counter during OS wheel; source probes disabled; scanout unobserved'}else{'native surface-updated counter in existing owner; source probes may be enabled; scanout unobserved'});rangeScope='packet-defined reversals; full-page endpoints require separate verification'}
    $checks[-1].inputXFraction=$InputXFraction
    if($observation.MaximumGapMs -gt 350){Write-Output ('STALLED_CHANGES '+($observation.Changes|ConvertTo-Json -Compress))}
  }
  $lastInjectedPointer=New-Object NelyxContinuousScroll+Point;[NelyxContinuousScroll]::GetCursorPos([ref]$lastInjectedPointer)|Out-Null
  if(-not $ownsApplication){Write-Output ('CONTINUOUS_SCROLL '+(@{page=$Page;checks=$checks;qualification='attached-diagnostic-only';scope='existing owner may enable source probes; native surface observations are not a normal-product FPS qualification'}|ConvertTo-Json -Depth 6 -Compress));return}
  [NelyxContinuousScroll]::CloseAfterInput($window);$closing=[Diagnostics.Stopwatch]::StartNew()
  while([NelyxContinuousScroll]::IsWindowVisible($window) -and $closing.ElapsedMilliseconds -lt 15000){Start-Sleep -Milliseconds 5};$hiddenMs=$closing.Elapsed.TotalMilliseconds
  while([NelyxContinuousScroll]::IsWindow($window) -and $closing.ElapsedMilliseconds -lt 15000){Start-Sleep -Milliseconds 5};$windowCloseMs=$closing.Elapsed.TotalMilliseconds
  if(-not $application.WaitForExit([Math]::Max(1,15000-[int]$closing.ElapsedMilliseconds))){throw 'Close did not complete within 15 seconds'}
  $closeMs=$closing.Elapsed.TotalMilliseconds;$output=$stdout.GetAwaiter().GetResult()+$stderr.GetAwaiter().GetResult()
  $drained=$output.Contains('closed views=0 consumers=0 gpuDrained=1 inputRetired=1')
  $receipt=@{page=$Page;checks=$checks;desktopPixels=if($CadenceOnly){'unobserved'}else{'sampled'};closeMs=$closeMs;hiddenMs=$hiddenMs;windowCloseMs=$windowCloseMs;exitCode=$application.ExitCode;drained=if($CadenceOnly){'unobserved'}else{$drained};scope='actual package native surface counter during continuous OS wheel; desktop sampling is optional; scanout unobserved'}
  Write-Output ('CONTINUOUS_SCROLL '+($receipt|ConvertTo-Json -Depth 6 -Compress))
  Write-Output ($output -split "`n" | Where-Object {$_ -match 'NELYX_WINDOWS_FRAME|close-|closed |APP_STOP|ERROR|failed|resize-timeout'})
  if($application.ExitCode -ne 0 -or (-not $CadenceOnly -and -not $drained)){throw 'Native close/drain failed'}
  if($output -match 'REACT_ERROR|close-failed|resize-failed'){throw 'Native interaction or close reported an error'}
  if(-not $CadenceOnly -and @($checks|Where-Object {$_.changesDuringInput -lt 10 -or $_.maximumGapMs -gt 350}).Count){throw 'Desktop rendering stalled during continuous OS input'}
  if($hiddenMs -gt 350){throw 'Native window remained visible after close'}
} finally {
  if($null -ne $application){if($ownsApplication -and -not $application.HasExited){$application.CloseMainWindow()|Out-Null;if(-not $application.WaitForExit(15000)){$application.Kill();$application.WaitForExit()}};$application.Dispose()}
  [NelyxContinuousScroll]::timeEndPeriod(1)|Out-Null
  $currentPointer=New-Object NelyxContinuousScroll+Point;[NelyxContinuousScroll]::GetCursorPos([ref]$currentPointer)|Out-Null
  $restorePointer=$null -ne $lastInjectedPointer -and $currentPointer.X -eq $lastInjectedPointer.X -and $currentPointer.Y -eq $lastInjectedPointer.Y
  if($previousDpi -ne [IntPtr]::Zero){[NelyxContinuousScroll]::SetThreadDpiAwarenessContext($previousDpi)|Out-Null}
  if($restorePointer){[NelyxContinuousScroll]::SetCursorPos($originalPointer.X,$originalPointer.Y)|Out-Null}
}
