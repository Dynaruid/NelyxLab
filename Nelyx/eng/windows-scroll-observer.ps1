# SPDX-License-Identifier: BSD-3-Clause
param(
  [Parameter(Mandatory=$true)][int]$TargetProcessId,
  [switch]$Read,
  [switch]$Stop,
  [switch]$NoHook,
  [switch]$Worker,
  [ValidateRange(3,1200)][int]$DurationSeconds=1200
)
$ErrorActionPreference='Stop'
$taskMapName="Local\NelyxScrollObserver.v1.$TargetProcessId"
if($Stop){
  $taskMap=[System.IO.MemoryMappedFiles.MemoryMappedFile]::OpenExisting($taskMapName)
  try{$taskView=$taskMap.CreateViewAccessor(0,64);try{if($taskView.ReadInt64(16) -ne $TargetProcessId){throw 'Observer identity mismatch'};$taskView.Write(48,[long]-1)}finally{$taskView.Dispose()}}finally{$taskMap.Dispose()}
  exit
}
if($Read){
  $taskMap=[System.IO.MemoryMappedFiles.MemoryMappedFile]::OpenExisting($taskMapName)
  $taskView=$null
  try{
    $taskView=$taskMap.CreateViewAccessor(0,0,[System.IO.MemoryMappedFiles.MemoryMappedFileAccess]::Read)
    if($taskView.ReadInt64(0) -ne 1396918348 -or $taskView.ReadInt64(16) -ne $TargetProcessId){throw 'Observer identity mismatch'}
    $taskProcess=Get-Process -Id $TargetProcessId -ErrorAction SilentlyContinue
    if($taskProcess -and $taskProcess.StartTime.ToUniversalTime().Ticks -ne $taskView.ReadInt64(24)){throw 'Observed process identity was reused'}
    $taskLast=$taskView.ReadInt64(8);$taskRows=@()
    for($taskIndex=[Math]::Max(1,$taskLast-511);$taskIndex -le $taskLast;$taskIndex++){
      $taskOffset=64+(($taskIndex-1)%512)*128
      if($taskView.ReadInt64($taskOffset) -ne $taskIndex){continue}
      $taskRow=[PSCustomObject]@{sample=$taskIndex;qpcMs=$taskView.ReadDouble($taskOffset+8);foreground=($taskView.ReadInt64($taskOffset+16) -eq 1);cursorOver=($taskView.ReadInt64($taskOffset+24) -eq 1);focus=$taskView.ReadInt64($taskOffset+32);active=$taskView.ReadInt64($taskOffset+40);capture=$taskView.ReadInt64($taskOffset+48);responseMs=$taskView.ReadDouble($taskOffset+56);osWheelCount=$taskView.ReadInt64($taskOffset+64);osWheelDelta=$taskView.ReadInt64($taskOffset+72);desktopHash=$taskView.ReadInt64($taskOffset+80);cpuMs=$taskView.ReadDouble($taskOffset+88);visible=($taskView.ReadInt64($taskOffset+96) -eq 1);minimized=($taskView.ReadInt64($taskOffset+104) -eq 1);width=$taskView.ReadInt64($taskOffset+112);height=$taskView.ReadInt64($taskOffset+120)}
      if($taskView.ReadInt64($taskOffset) -eq $taskIndex){$taskRows+=$taskRow}
    }
    $taskSeconds=@();$taskPrevious=$null
    foreach($taskGroup in ($taskRows | Group-Object { [Math]::Floor($_.qpcMs/1000) })){
      $taskValues=@($taskGroup.Group);$taskEnd=$taskValues[-1];$taskHashes=@($taskValues|Where-Object {$_.desktopHash -ne 0}|Select-Object -ExpandProperty desktopHash -Unique)
      $taskSeconds+=[PSCustomObject]@{qpcMs=[Math]::Round($taskEnd.qpcMs,2);foreground=$taskEnd.foreground;cursorOver=$taskEnd.cursorOver;focus=$taskEnd.focus;capture=$taskEnd.capture;wheelCount=$taskEnd.osWheelCount;wheelAdded=if($null -ne $taskPrevious){$taskEnd.osWheelCount-$taskPrevious.osWheelCount}else{0};hashes=$taskHashes.Count;uiTimeouts=@($taskValues|Where-Object {$_.responseMs -lt 0}).Count;maxUiMs=[Math]::Round(($taskValues|Measure-Object -Property responseMs -Maximum).Maximum,2);cpuMs=[Math]::Round($taskEnd.cpuMs,2)}
      $taskPrevious=$taskEnd
    }
    $taskHookCounts=$taskView.ReadInt64(56)
    [PSCustomObject]@{schema='nelyx.scroll-observation/v1';pid=$TargetProcessId;workerPid=$taskView.ReadInt64(32);targetExited=($taskView.ReadInt64(40) -eq 1);hookInstalled=($taskView.ReadInt64(48) -eq 1);inputMode=if($taskView.ReadInt64(48) -eq 2){'disabled'}else{'mouse-hook'};hookCallbacks=($taskHookCounts -shr 32);hookErrors=($taskHookCounts -band 0xffffffffL);samples=$taskRows.Count;scope='external UI response, focus, optional OS mouse-wheel observation and sampled own-window desktop hash; no Core or display receipt';seconds=$taskSeconds;latest=if($taskRows.Count){$taskRows[-1]}else{$null}}|ConvertTo-Json -Depth 5 -Compress
  }finally{if($taskView){$taskView.Dispose()};$taskMap.Dispose()}
  exit
}
if(-not $Worker){
  $taskProcess=Get-Process -Id $TargetProcessId -ErrorAction Stop
  if($taskProcess.ProcessName -ne 'NelyxRNHost'){throw 'Observer requires the Nelyx testbed process'}
  $taskShell=New-Object -ComObject Shell.Application
  try{
    $taskLocation=0;$taskRoot=0;$taskHwnd=0
    $taskDesktop=$taskShell.Windows().FindWindowSW([ref]$taskLocation,[ref]$taskRoot,8,[ref]$taskHwnd,1)
    if(-not $taskDesktop.Document.Application){throw 'Desktop Explorer automation unavailable'}
    $taskPwsh=(Get-Process -Id $PID).Path
    $taskArguments='-NoProfile -NonInteractive -WindowStyle Hidden -File "'+$PSCommandPath+'" -Worker -TargetProcessId '+$TargetProcessId+' -DurationSeconds '+$DurationSeconds
    if($NoHook){$taskArguments+=' -NoHook'}
    $taskDesktop.Document.Application.ShellExecute($taskPwsh,$taskArguments,(Split-Path -Parent $PSCommandPath),'open',0)
  }finally{[System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($taskShell)|Out-Null}
  Write-Output "Observer requested: $taskMapName (maximum ${DurationSeconds}s; RAM only)."
  exit
}
Add-Type -TypeDefinition @'
using System;
using System.Diagnostics;
using System.IO.MemoryMappedFiles;
using System.Runtime.InteropServices;
using System.Threading;
public static class NelyxScrollObserver {
  [StructLayout(LayoutKind.Sequential)] struct Point { public int X,Y; }
  [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left,Top,Right,Bottom; }
  [StructLayout(LayoutKind.Sequential)] struct Gui { public int Size,Flags;public IntPtr Active,Focus,Capture,MenuOwner,MoveSize,Caret;public Rect CaretRect; }
  [StructLayout(LayoutKind.Sequential)] struct Message {public IntPtr Window;public uint Id;public UIntPtr WParam;public IntPtr LParam;public uint Time;public Point Point;public uint Private;}
  [StructLayout(LayoutKind.Sequential)] struct Bitmap {public uint Size;public int Width,Height;public ushort Planes,Bits;public uint Compression,ImageSize;public int X,Y;public uint Used,Important;}
  delegate IntPtr Hook(int code,IntPtr message,IntPtr data);
  [DllImport("user32.dll")] static extern IntPtr SetWindowsHookExW(int id,Hook callback,IntPtr module,uint thread);
  [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr hook);
  [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook,int code,IntPtr message,IntPtr data);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern IntPtr GetModuleHandleW(string name);
  [DllImport("user32.dll")] static extern bool PeekMessageW(out Message message,IntPtr window,uint first,uint last,uint remove);
  [DllImport("user32.dll")] static extern bool TranslateMessage(ref Message message);
  [DllImport("user32.dll")] static extern IntPtr DispatchMessageW(ref Message message);
  [DllImport("user32.dll")] static extern uint MsgWaitForMultipleObjectsEx(uint count,IntPtr handles,uint milliseconds,uint mask,uint flags);
  [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr window,uint flags);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(Point point);
  [DllImport("user32.dll")] static extern bool GetCursorPos(out Point point);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint process);
  [DllImport("user32.dll")] static extern bool GetGUIThreadInfo(uint thread,ref Gui gui);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr window);
  [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr window,out Rect rect);
  [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr window,ref Point point);
  [DllImport("user32.dll")] static extern IntPtr SendMessageTimeoutW(IntPtr window,uint msg,IntPtr wp,IntPtr lp,uint flags,uint timeout,out UIntPtr result);
  [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr window);
  [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr window,IntPtr dc);
  [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleDC(IntPtr dc);
  [DllImport("gdi32.dll")] static extern bool DeleteDC(IntPtr dc);
  [DllImport("gdi32.dll")] static extern IntPtr CreateDIBSection(IntPtr dc,ref Bitmap info,uint usage,out IntPtr bits,IntPtr section,uint offset);
  [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr dc,IntPtr value);
  [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr value);
  [DllImport("gdi32.dll")] static extern bool StretchBlt(IntPtr target,int x,int y,int width,int height,IntPtr source,int sx,int sy,int sw,int sh,uint operation);
  [DllImport("gdi32.dll")] static extern bool GdiFlush();
  static IntPtr target;static long wheels,delta,callbacks,errors;
  static IntPtr Wheel(int code,IntPtr message,IntPtr data){++callbacks;try{if(code>=0&&(message.ToInt64()==0x20A||message.ToInt64()==0x20E)){Point point;if(target!=IntPtr.Zero&&GetCursorPos(out point)&&GetAncestor(WindowFromPoint(point),2)==target){++wheels;delta+=(short)(Marshal.ReadInt32(data,8)>>16);}}}catch{++errors;}return CallNextHookEx(IntPtr.Zero,code,message,data);}
  public static void Run(int pid,string name,int seconds,bool noHook){
    SetThreadDpiAwarenessContext(new IntPtr(-4));var process=Process.GetProcessById(pid);var started=process.StartTime.ToUniversalTime().Ticks;
    if(process.ProcessName!="NelyxRNHost")throw new InvalidOperationException("Unexpected observed process");
    using(var map=MemoryMappedFile.CreateNew(name,64+512*128))using(var view=map.CreateViewAccessor()){
      view.Write(0,1396918348L);view.Write(16,(long)pid);view.Write(24,started);view.Write(32,(long)Process.GetCurrentProcess().Id);
      Hook callback=Wheel;IntPtr hook=IntPtr.Zero,screen=IntPtr.Zero,memory=IntPtr.Zero,bitmap=IntPtr.Zero,old=IntPtr.Zero,bits=IntPtr.Zero;var pixels=new byte[32*64*4];
      try{
        Message initial;PeekMessageW(out initial,IntPtr.Zero,0,0,0);if(!noHook)hook=SetWindowsHookExW(14,callback,GetModuleHandleW(null),0);view.Write(48,noHook?2L:hook!=IntPtr.Zero?1L:0L);
        screen=GetDC(IntPtr.Zero);memory=CreateCompatibleDC(screen);var info=new Bitmap{Size=(uint)Marshal.SizeOf<Bitmap>(),Width=32,Height=-64,Planes=1,Bits=32};bitmap=CreateDIBSection(screen,ref info,0,out bits,IntPtr.Zero,0);if(bitmap!=IntPtr.Zero)old=SelectObject(memory,bitmap);
        long sample=0;double next=0;var clock=Stopwatch.StartNew();
        while(clock.Elapsed.TotalSeconds<seconds){
          if(view.ReadInt64(48)<0)return;
          Message message;while(PeekMessageW(out message,IntPtr.Zero,0,0,1)){TranslateMessage(ref message);DispatchMessageW(ref message);}
          if(clock.Elapsed.TotalMilliseconds>=next){
            next=clock.Elapsed.TotalMilliseconds+200;process.Refresh();if(process.HasExited){view.Write(40,1L);break;}
            target=process.MainWindowHandle;if(target!=IntPtr.Zero){
              uint owner;var thread=GetWindowThreadProcessId(target,out owner);var gui=new Gui{Size=Marshal.SizeOf<Gui>()};GetGUIThreadInfo(thread,ref gui);
              Point cursor;GetCursorPos(out cursor);bool foreground=GetAncestor(GetForegroundWindow(),2)==target,over=GetAncestor(WindowFromPoint(cursor),2)==target;
              bool visible=IsWindowVisible(target),minimized=IsIconic(target);Rect rect;GetClientRect(target,out rect);var point=new Point();ClientToScreen(target,ref point);int width=rect.Right-rect.Left,height=rect.Bottom-rect.Top;long hash=0;
              if(foreground&&visible&&!minimized&&width>64&&height>128&&bits!=IntPtr.Zero){
                var center=new Point{X=point.X+width/2,Y=point.Y+height/2};
                if(GetAncestor(WindowFromPoint(center),2)==target&&StretchBlt(memory,0,0,32,64,screen,point.X+width/5,point.Y+height/5,width*3/5,height*3/5,0x00CC0020)){
                  GdiFlush();Marshal.Copy(bits,pixels,0,pixels.Length);ulong value=14695981039346656037UL;unchecked{foreach(byte b in pixels)value=(value^b)*1099511628211UL;}hash=(long)value;
                }
              }
              var before=Stopwatch.GetTimestamp();UIntPtr result;bool responded=SendMessageTimeoutW(target,0,IntPtr.Zero,IntPtr.Zero,3,40,out result)!=IntPtr.Zero;var elapsed=(Stopwatch.GetTimestamp()-before)*1000.0/Stopwatch.Frequency;
              double cpu=-1;try{cpu=process.TotalProcessorTime.TotalMilliseconds;}catch{}
              ++sample;long offset=64+((sample-1)%512)*128;view.Write(offset,0L);view.Write(offset+8,Stopwatch.GetTimestamp()*1000.0/Stopwatch.Frequency);view.Write(offset+16,foreground?1L:0L);view.Write(offset+24,over?1L:0L);view.Write(offset+32,gui.Focus.ToInt64());view.Write(offset+40,gui.Active.ToInt64());view.Write(offset+48,gui.Capture.ToInt64());view.Write(offset+56,responded?elapsed:-1.0);view.Write(offset+64,wheels);view.Write(offset+72,delta);view.Write(offset+80,hash);view.Write(offset+88,cpu);view.Write(offset+96,visible?1L:0L);view.Write(offset+104,minimized?1L:0L);view.Write(offset+112,(long)width);view.Write(offset+120,(long)height);Thread.MemoryBarrier();view.Write(offset,sample);view.Write(8,sample);view.Write(56,(callbacks<<32)|(errors&0xffffffffL));
            }
          }
          MsgWaitForMultipleObjectsEx(0,IntPtr.Zero,20,0x04FF,4);
        }
        if(hook!=IntPtr.Zero){UnhookWindowsHookEx(hook);hook=IntPtr.Zero;}view.Write(48,0L);target=IntPtr.Zero;
        if(process.HasExited){view.Write(40,1L);Thread.Sleep(Math.Min(120000,Math.Max(0,seconds*1000-(int)clock.ElapsedMilliseconds)));}
      }finally{
        target=IntPtr.Zero;if(hook!=IntPtr.Zero)UnhookWindowsHookEx(hook);GC.KeepAlive(callback);if(old!=IntPtr.Zero)SelectObject(memory,old);if(bitmap!=IntPtr.Zero)DeleteObject(bitmap);if(memory!=IntPtr.Zero)DeleteDC(memory);if(screen!=IntPtr.Zero)ReleaseDC(IntPtr.Zero,screen);process.Dispose();
      }
    }
  }
}
'@
[NelyxScrollObserver]::Run($TargetProcessId,$taskMapName,$DurationSeconds,[bool]$NoHook)
