param([Parameter(Mandatory=$true)][string]$Executable,[ValidateSet('list','material','cupertino')][string]$Page='list',[ValidateRange(1,120)][int]$WheelDelta=15,[switch]$MouseMotion,[switch]$WindowTransitions,[switch]$CaptionActivation)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes
Add-Type @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
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
  public sealed class Result { public int Packets,ChangesDuringInput,ChangesAfterInput; public double MaximumGapMs,FirstChangeMs,LastChangeMs,NativeBeginMs; public List<double> Changes=new List<double>(); }
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
  public static Result Run(IntPtr window,int direction,int magnitude,int durationMs,int intervalMs,bool motion) {
    Rect rect; Point origin=new Point();
    if(GetForegroundWindow()!=window||!GetClientRect(window,out rect)||!ClientToScreen(window,ref origin))throw new Exception("Own foreground client unavailable");
    var target=new Point { X=origin.X+(rect.Right-rect.Left)*2/3,Y=origin.Y+(rect.Bottom-rect.Top)*2/3 };
    SetCursorPos(target.X,target.Y);if(GetAncestor(WindowFromPoint(target),2)!=window)throw new Exception("Owned scroll target is occluded");
    int width=Math.Min(320,rect.Right-40),height=Math.Min(360,rect.Bottom-240);
    if(width<100||height<100)throw new Exception("Own list pixels unavailable");
    IntPtr screen=GetDC(IntPtr.Zero),memory=CreateCompatibleDC(screen),pixels;
    var info=new BitmapInfo { Size=(uint)Marshal.SizeOf<BitmapInfo>(),Width=width,Height=-height,Planes=1,Bits=32 };
    IntPtr bitmap=CreateDIBSection(screen,ref info,0,out pixels,IntPtr.Zero,0),previous=SelectObject(memory,bitmap);
    var buffer=new int[width*height]; var result=new Result(); var clock=Stopwatch.StartNew();
    Thread sender=null; Exception failure=null; int packets=0; bool stop=false;
    Func<ulong> hash=()=>{if(!BitBlt(memory,0,0,width,height,screen,origin.X+20,origin.Y+180,0x40cc0020))throw new Exception("Desktop pixel copy failed");Marshal.Copy(pixels,buffer,0,buffer.Length);ulong value=14695981039346656037UL;for(int i=0;i<buffer.Length;i+=3)value=unchecked((value^(uint)(buffer[i]&0xffffff))*1099511628211UL);return value;};
    try {
      ulong last=hash();clock.Restart();result.NativeBeginMs=Stopwatch.GetTimestamp()*1000.0/Stopwatch.Frequency;
      sender=new Thread(()=>{var dpi=SetThreadDpiAwarenessContext(new IntPtr(-4));try { var input=new Input[1];double next=0;while(!Volatile.Read(ref stop)&&clock.Elapsed.TotalMilliseconds<durationMs){RequireInput(window);if(clock.Elapsed.TotalMilliseconds>=next){if(motion)SetCursorPos(origin.X+rect.Right*2/3+(packets%2)*2,origin.Y+rect.Bottom*2/3);input[0]=new Input { Type=0,Mouse=new Mouse { Data=unchecked((uint)(direction*magnitude*((packets/80)%2==0?1:-1))),Flags=0x800 } };if(SendInput(1,input,Marshal.SizeOf<Input>())!=1)throw new Exception("OS wheel injection failed");Interlocked.Increment(ref packets);next=clock.Elapsed.TotalMilliseconds+intervalMs;}Thread.Sleep(1);} }catch(Exception error){failure=error;}finally{if(dpi!=IntPtr.Zero)SetThreadDpiAwarenessContext(dpi);}});
      sender.Start(); double lastChange=0;
      while(clock.Elapsed.TotalMilliseconds<durationMs+1200){ulong current=hash();double now=clock.Elapsed.TotalMilliseconds;if(current!=last){result.Changes.Add(now);if(result.Changes.Count==1)result.FirstChangeMs=now;result.MaximumGapMs=Math.Max(result.MaximumGapMs,now-lastChange);lastChange=now;result.LastChangeMs=now;if(now<durationMs)result.ChangesDuringInput++;else result.ChangesAfterInput++;last=current;}Thread.Sleep(16);}
      result.MaximumGapMs=Math.Max(result.MaximumGapMs,durationMs-Math.Min(lastChange,durationMs));
      sender.Join();if(failure!=null)throw failure;result.Packets=Volatile.Read(ref packets);return result;
    } finally { Volatile.Write(ref stop,true);if(sender!=null)sender.Join();SelectObject(memory,previous);DeleteObject(bitmap);DeleteDC(memory);ReleaseDC(IntPtr.Zero,screen); }
  }
}
'@
$application=$null; $originalPointer=New-Object NelyxContinuousScroll+Point; [NelyxContinuousScroll]::GetCursorPos([ref]$originalPointer)|Out-Null
$checks=@(); $drained=$false;$previousDpi=[NelyxContinuousScroll]::SetThreadDpiAwarenessContext([IntPtr](-4));$window=[IntPtr]::Zero;$lastInjectedPointer=$null
try {
  [NelyxContinuousScroll]::timeBeginPeriod(1)|Out-Null
  $start=[Diagnostics.ProcessStartInfo]::new($Executable)
  $start.WorkingDirectory=Split-Path -LiteralPath $Executable
  $start.UseShellExecute=$false; $start.RedirectStandardOutput=$true; $start.RedirectStandardError=$true
  $start.EnvironmentVariables['NELYX_TRACKPAD_DIAGNOSTICS']='1'
  $start.EnvironmentVariables['NELYX_WINDOWS_FRAME_DIAGNOSTICS']='1'
  $application=[Diagnostics.Process]::Start($start)
  $stdout=$application.StandardOutput.ReadToEndAsync(); $stderr=$application.StandardError.ReadToEndAsync()
  $deadline=[DateTime]::UtcNow.AddSeconds(25)
  do { if($application.HasExited){throw 'App exited during startup'};$application.Refresh();$window=$application.MainWindowHandle;if($window -eq [IntPtr]::Zero){Start-Sleep -Milliseconds 50} } while($window -eq [IntPtr]::Zero -and [DateTime]::UtcNow -lt $deadline)
  if($window -eq [IntPtr]::Zero){throw 'Visible app window unavailable'}
  if($CaptionActivation){$clicked=[NelyxContinuousScroll]::Activate($window);Write-Output ('CONTINUOUS_ACTIVATION '+(@{page=$Page;attempt='probe';ownedCaptionClicked=$clicked}|ConvertTo-Json -Compress));if(-not $clicked){throw 'Owned caption activation probe failed'};Start-Sleep -Milliseconds 150}
  for($attempt=0;$attempt -lt 3;$attempt++){[NelyxContinuousScroll]::SetForegroundWindow($window)|Out-Null;Start-Sleep -Milliseconds 150;if([NelyxContinuousScroll]::GetForegroundWindow() -eq $window){break};$clicked=[NelyxContinuousScroll]::Activate($window);Write-Output ('CONTINUOUS_ACTIVATION '+(@{page=$Page;attempt=$attempt;ownedCaptionClicked=$clicked}|ConvertTo-Json -Compress));Start-Sleep -Milliseconds 150}
  if([NelyxContinuousScroll]::GetForegroundWindow() -ne $window){throw 'Own foreground unavailable'}
  if($WindowTransitions){foreach($command in @(3,9)){[NelyxContinuousScroll]::ShowWindow($window,$command)|Out-Null;Start-Sleep -Milliseconds 400}}
  function Find-Action([string]$id){
    $condition=[Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::AutomationIdProperty,$id)
    $root=[Windows.Automation.AutomationElement]::FromHandle($window)
    return $root.FindFirst([Windows.Automation.TreeScope]::Descendants,$condition)
  }
  foreach($id in $(if($Page -eq 'list'){@('show-list-view','list-view-last')}elseif($Page -eq 'cupertino'){@('show-cupertino')}else{@()})){
    $deadline=[DateTime]::UtcNow.AddSeconds(15);$action=$null
    do{$action=Find-Action $id;if($null -eq $action){Start-Sleep -Milliseconds 50}}while($null -eq $action -and [DateTime]::UtcNow -lt $deadline)
    if($null -eq $action){throw "Missing action $id"}
    ([Windows.Automation.InvokePattern]$action.GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern)).Invoke();Start-Sleep -Milliseconds 500
  }
  foreach($direction in $(if($Page -eq 'list'){@(1,-1)}else{@(-1,1)})){
    $observation=[NelyxContinuousScroll]::Run($window,$direction,$WheelDelta,3000,4,$MouseMotion.IsPresent)
    $checks+=@{direction=$direction;nativeBeginMs=$observation.NativeBeginMs;packets=$observation.Packets;changesDuringInput=$observation.ChangesDuringInput;changesAfterInput=$observation.ChangesAfterInput;firstChangeMs=$observation.FirstChangeMs;maximumGapMs=$observation.MaximumGapMs}
    if($observation.MaximumGapMs -gt 350){Write-Output ('STALLED_CHANGES '+($observation.Changes|ConvertTo-Json -Compress))}
  }
  $lastInjectedPointer=New-Object NelyxContinuousScroll+Point;[NelyxContinuousScroll]::GetCursorPos([ref]$lastInjectedPointer)|Out-Null
  [NelyxContinuousScroll]::CloseAfterInput($window);$closing=[Diagnostics.Stopwatch]::StartNew()
  while([NelyxContinuousScroll]::IsWindowVisible($window) -and $closing.ElapsedMilliseconds -lt 15000){Start-Sleep -Milliseconds 5};$hiddenMs=$closing.Elapsed.TotalMilliseconds
  while([NelyxContinuousScroll]::IsWindow($window) -and $closing.ElapsedMilliseconds -lt 15000){Start-Sleep -Milliseconds 5};$windowCloseMs=$closing.Elapsed.TotalMilliseconds
  if(-not $application.WaitForExit([Math]::Max(1,15000-[int]$closing.ElapsedMilliseconds))){throw 'Close did not complete within 15 seconds'}
  $closeMs=$closing.Elapsed.TotalMilliseconds;$output=$stdout.GetAwaiter().GetResult()+$stderr.GetAwaiter().GetResult()
  $drained=$output.Contains('closed views=0 consumers=0 gpuDrained=1 inputRetired=1')
  $receipt=@{page=$Page;checks=$checks;closeMs=$closeMs;hiddenMs=$hiddenMs;windowCloseMs=$windowCloseMs;exitCode=$application.ExitCode;drained=$drained;scope='actual package desktop pixels during continuous OS wheel'}
  Write-Output ('CONTINUOUS_SCROLL '+($receipt|ConvertTo-Json -Depth 6 -Compress))
  Write-Output ($output -split "`n" | Where-Object {$_ -match 'NELYX_WINDOWS_FRAME|close-|closed |APP_STOP|ERROR|failed|resize-timeout'})
  if($application.ExitCode -ne 0 -or -not $drained){throw 'Native close/drain failed'}
  if($output -match 'REACT_ERROR|close-failed|resize-failed'){throw 'Native interaction or close reported an error'}
  if(@($checks|Where-Object {$_.changesDuringInput -lt 10 -or $_.maximumGapMs -gt 350}).Count){throw 'Desktop rendering stalled during continuous OS input'}
  if($hiddenMs -gt 350){throw 'Native window remained visible after close'}
} finally {
  if($null -ne $application){if(-not $application.HasExited){$application.CloseMainWindow()|Out-Null;if(-not $application.WaitForExit(15000)){$application.Kill();$application.WaitForExit()}};$application.Dispose()}
  [NelyxContinuousScroll]::timeEndPeriod(1)|Out-Null
  $currentPointer=New-Object NelyxContinuousScroll+Point;[NelyxContinuousScroll]::GetCursorPos([ref]$currentPointer)|Out-Null
  $restorePointer=$null -ne $lastInjectedPointer -and $currentPointer.X -eq $lastInjectedPointer.X -and $currentPointer.Y -eq $lastInjectedPointer.Y
  if($previousDpi -ne [IntPtr]::Zero){[NelyxContinuousScroll]::SetThreadDpiAwarenessContext($previousDpi)|Out-Null}
  if($restorePointer){[NelyxContinuousScroll]::SetCursorPos($originalPointer.X,$originalPointer.Y)|Out-Null}
}
