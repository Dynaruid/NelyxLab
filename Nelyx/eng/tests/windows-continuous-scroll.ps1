param([Parameter(Mandatory=$true)][string]$Executable,[ValidateSet('list','material','cupertino','mixed')][string]$Page='list',[ValidateRange(1,120)][int]$WheelDelta=15,[ValidateRange(20,2000)][int]$WheelPacketsPerLeg=80,[ValidateRange(3000,20000)][int]$InputDurationMs=3000,[ValidateRange(0,2147483647)][int]$TargetProcessId=0,[switch]$MouseMotion,[switch]$WindowTransitions,[switch]$Maximized,[switch]$FocusEditor,[switch]$CadenceOnly,[switch]$CaptionActivation,[ValidateRange(0.1,0.9)][double]$InputXFraction=(2.0/3.0),[switch]$BothColumns,[switch]$Unprimed,[ValidateRange(0,100000)][double]$RangeExtent=0,[ValidateRange(1500,4000)][int]$RangeLegDurationMs=4000,[switch]$ExistingPage,[switch]$ReturnToGallery,[switch]$PrepareOnly,[ValidateRange(0,256)][double]$RangeExtraExtent=0,[switch]$FullRange,[switch]$RangeDiagnostics)
$ErrorActionPreference = 'Stop'
if($RangeExtent -gt 0 -and ($Unprimed -or $InputDurationMs % $RangeLegDurationMs -ne 0)){throw 'Full-range input requires priming and complete fixed-duration legs'}
if($PrepareOnly -and $TargetProcessId -eq 0){throw 'PrepareOnly requires an explicitly owned existing process'}
if($FullRange -and ($Page -ne 'material' -or -not $CadenceOnly -or $RangeExtent -gt 0 -or $Unprimed)){throw 'FullRange requires Material, CadenceOnly, and the opt-in complete Gallery protocol'}
if($RangeDiagnostics -and -not $FullRange){throw 'RangeDiagnostics requires FullRange'}
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
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr window,IntPtr after,int x,int y,int width,int height,uint flags);
  [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")] static extern IntPtr GetWindowLongPtr(IntPtr window,int index);
  public static bool IsTopmost(IntPtr window) { return (GetWindowLongPtr(window,-20).ToInt64()&8)!=0; }
  [DllImport("user32.dll")] static extern IntPtr SendMessageTimeoutW(IntPtr window,uint message,IntPtr wp,IntPtr lp,uint flags,uint timeout,out UIntPtr result);
  [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(Point point);
  [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr window,uint flags);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr window);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint process);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr window,int command);
  [DllImport("user32.dll")] static extern bool SystemParametersInfoW(uint action,uint param,out uint value,uint flags);
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
  public sealed class InputWindow { public long SampleEvery,Retained,NativeWheelPositive,NativeWheelNegative,CoreWheelPositive,CoreWheelNegative,CoreWithoutWheelMapping; public double EarliestQpcMs,NativeWheelDelta,CoreWheelDelta; }
  public sealed class Gap { public double BeginMs,EndMs,PixelBeginQpcMs,PixelEndQpcMs,NativeBeginMs,NativeEndMs,FirstFrame,LastFrame; public long SurfaceUpdates,View,Surface; public int OtherRegionChanges; public InputWindow Input; }
  public sealed class Result { public int Packets,PrimingPackets,ChangesDuringInput,ChangesAfterInput,PhysicalWidth,PhysicalHeight,Dpi; public long SurfaceUpdates; public double PrimingDurationMs,MaximumGapMs,MaximumAllRegionsGapMs,MaximumSurfaceGapMs,FirstChangeMs,LastChangeMs,NativeBeginMs,NativeEndMs,SurfaceDurationMs,SurfaceFPS; public List<double> Changes=new List<double>(); public List<Gap> Gaps=new List<Gap>(); }
  struct TraceRow { public long Stage,Input,Surface; public double Qpc,A,B; }
  static InputWindow ReadInputWindow(IntPtr window,double begin,double end,long surface) {
    uint pid;GetWindowThreadProcessId(window,out pid);
    using(var map=MemoryMappedFile.OpenExisting("Local\\NelyxInputTrace.v1."+pid))
    using(var view=map.CreateViewAccessor(0,0,MemoryMappedFileAccess.Read)) {
      if(view.ReadInt64(0)!=0x4e4c585452414345L||view.ReadInt64(8)!=1||view.ReadInt64(16)!=pid||view.ReadInt64(32)!=64||view.ReadInt64(40)!=8192)throw new Exception("Gap input recorder identity changed");
      var result=new InputWindow { SampleEvery=view.ReadInt64(48),EarliestQpcMs=double.PositiveInfinity };
      long stored=view.ReadInt64(56);var rows=new List<TraceRow>();var wheel=new Dictionary<long,double>();
      for(long sequence=Math.Max(1,stored-8191);sequence<=stored;sequence++) {
        long offset=2176+((sequence-1)%8192)*64;if(view.ReadInt64(offset)!=sequence)continue;
        var row=new TraceRow { Qpc=view.ReadDouble(offset+8),Stage=view.ReadInt64(offset+16),Surface=view.ReadInt64(offset+32),Input=view.ReadInt64(offset+40),A=view.ReadDouble(offset+48),B=view.ReadDouble(offset+56) };
        if(view.ReadInt64(offset)!=sequence||row.Surface!=surface)continue;
        result.EarliestQpcMs=Math.Min(result.EarliestQpcMs,row.Qpc);result.Retained++;
        if(row.Stage==7&&row.A==0)wheel[row.Input]=row.B;
        if(row.Qpc>=begin&&row.Qpc<=end)rows.Add(row);
      }
      foreach(var row in rows) {
        if(row.Stage==7&&row.A==0){result.NativeWheelDelta+=row.B;if(row.B>0)result.NativeWheelPositive++;else if(row.B<0)result.NativeWheelNegative++;}
        if(row.Stage==15){double delta;if(wheel.TryGetValue(row.Input,out delta)){result.CoreWheelDelta+=delta;if(delta>0)result.CoreWheelPositive++;else if(delta<0)result.CoreWheelNegative++;}else result.CoreWithoutWheelMapping++;}
      }
      if(double.IsPositiveInfinity(result.EarliestQpcMs))result.EarliestQpcMs=0;
      return result;
    }
  }
  sealed class SurfaceCount { public long Count,View,Surface; public double At,Qpc,Frame; }
  static SurfaceCount ReadSurfaceCount(IntPtr window) {
    uint pid;GetWindowThreadProcessId(window,out pid);
    using(var map=MemoryMappedFile.OpenExisting("Local\\NelyxInputTrace.v1."+pid))
    using(var view=map.CreateViewAccessor(0,0,MemoryMappedFileAccess.Read)) {
      if(view.ReadInt64(0)!=0x4e4c585452414345L||view.ReadInt64(8)!=1||view.ReadInt64(16)!=pid||view.ReadInt64(32)!=64||view.ReadInt64(40)!=8192||view.ReadInt64(72)!=1)throw new Exception("Surface counter owner/protocol changed");
      const long offset=128+27*64;
      for(int attempt=0;attempt<20;attempt++) {
        long count=view.ReadInt64(offset);
        if(count>0) {
          var result=new SurfaceCount { Count=count,View=view.ReadInt64(offset+24),Surface=view.ReadInt64(offset+32),Qpc=view.ReadDouble(offset+8),Frame=view.ReadDouble(offset+48) };
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
    if(!SetWindowPos(window,new IntPtr(-1),0,0,0,0,0x1|0x2|0x10|0x40))return false;
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
  public static double WheelPixelsPerUnit() {
    uint units;if(!SystemParametersInfoW(0x68,0,out units,0)||units==0||units>120)throw new Exception("Full range requires finite wheel line units");
    return units*16.0/120.0;
  }
  static void Target(IntPtr window,double fraction) {
    Rect rect;Point origin=new Point();if(!GetClientRect(window,out rect)||!ClientToScreen(window,ref origin))throw new Exception("Range client unavailable");
    SetCursorPos(origin.X+(int)(rect.Right*fraction),origin.Y+rect.Bottom*2/3);RequireInput(window);
  }
  public static int WheelLogical(IntPtr window,double fraction,double pixels) {
    Target(window,fraction);int total=checked((int)Math.Round(pixels/WheelPixelsPerUnit())),sent=0;
    while(sent!=total){RequireInput(window);int delta=Math.Sign(total-sent)*Math.Min(120,Math.Abs(total-sent));var input=new[]{new Input {Type=0,Mouse=new Mouse {Data=unchecked((uint)-delta),Flags=0x800}}};
      if(SendInput(1,input,Marshal.SizeOf<Input>())!=1)throw new Exception("Partial range warmup input");sent+=delta;Thread.Sleep(4);}
    return sent;
  }
  public sealed class SurfacePoint { public double Qpc,Frame;public long Count; }
  public sealed class Sweep {
    public double NativeBeginMs,NativeEndMs,TravelMs,InputMs,SurfaceFPS,PhysicalWidth,PhysicalHeight,Dpi;
    public int Packets,MaxPacket,WheelUnits;public long SurfaceUpdates,MissedSurfaceObservations;
    public List<SurfacePoint> Surfaces=new List<SurfacePoint>();
  }
  public static Sweep SweepDown(IntPtr window,double fraction,double distance,double viewport) {
    if(Double.IsNaN(distance)||Double.IsInfinity(distance)||distance<=0||Double.IsNaN(viewport)||Double.IsInfinity(viewport)||viewport<=0)throw new Exception("Invalid full range distance");
    Target(window,fraction);var result=new Sweep();Rect rect;GetClientRect(window,out rect);result.PhysicalWidth=rect.Right;result.PhysicalHeight=rect.Bottom;result.Dpi=GetDpiForWindow(window);
    int total=checked((int)Math.Ceiling(distance/WheelPixelsPerUnit())),sent=0;
    double travel=Math.Ceiling(distance/viewport*1000.0),duration=travel+500;
    if(duration>1100000)throw new Exception("Full range exceeds the 20 minute owner budget");
    var begin=ReadSurfaceCount(window);var previous=begin;var clock=Stopwatch.StartNew();result.NativeBeginMs=Stopwatch.GetTimestamp()*1000.0/Stopwatch.Frequency;
    while(clock.Elapsed.TotalMilliseconds<duration){
      RequireInput(window);Rect current;GetClientRect(window,out current);if(current.Right!=rect.Right||current.Bottom!=rect.Bottom||GetDpiForWindow(window)!=result.Dpi)throw new Exception("Full range DPI/client changed");
      int desired=(int)Math.Floor(Math.Min(1,clock.Elapsed.TotalMilliseconds/travel)*total);
      while(sent<desired&&clock.Elapsed.TotalMilliseconds<duration){int delta=Math.Min(120,desired-sent);RequireInput(window);
        var input=new[]{new Input {Type=0,Mouse=new Mouse {Data=unchecked((uint)-delta),Flags=0x800}}};
        if(SendInput(1,input,Marshal.SizeOf<Input>())!=1)throw new Exception("Partial timed full range input");
        sent+=delta;result.Packets++;result.MaxPacket=Math.Max(result.MaxPacket,delta);
      }
      Thread.Sleep(1);
    }
    result.NativeEndMs=Stopwatch.GetTimestamp()*1000.0/Stopwatch.Frequency;
    previous=ReadSurfaceCount(window);if(previous.View!=begin.View||previous.Surface!=begin.Surface)throw new Exception("Full range surface owner changed");
    result.InputMs=result.NativeEndMs-result.NativeBeginMs;result.TravelMs=travel;result.WheelUnits=sent;
    result.SurfaceUpdates=previous.Count-begin.Count;result.SurfaceFPS=result.SurfaceUpdates*1000.0/result.InputMs;
    if(sent!=total)throw new Exception("Timed full range did not deliver its original schedule");return result;
  }
  public static Result Run(IntPtr window,int direction,int magnitude,int packetsPerLeg,int durationMs,int intervalMs,bool motion,bool capture,double inputXFraction,bool prime,double rangeExtent,int rangeLegMs) {
    Rect rect; Point origin=new Point();
    if(GetForegroundWindow()!=window||!GetClientRect(window,out rect)||!ClientToScreen(window,ref origin))throw new Exception("Own foreground client unavailable");
    var target=new Point { X=origin.X+(int)((rect.Right-rect.Left)*inputXFraction),Y=origin.Y+(rect.Bottom-rect.Top)*2/3 };
    SetCursorPos(target.X,target.Y);if(GetAncestor(WindowFromPoint(target),2)!=window)throw new Exception("Owned scroll target is occluded");
    // Establish the opposite leg using real OS wheel input. Starting an up-leg
    // at the top otherwise measures a deliberate clamp until the packet-defined
    // reversal, which can exceed a second when the sender is scheduled slowly.
    // Keep the measured 80-packet reversals and the 350ms pixel limit unchanged.
    int primingPackets=0;double primingDurationMs=0;
    int rangeWheel=0;
    if(rangeExtent>0){uint units;if(!SystemParametersInfoW(0x68,0,out units,0)||units==0||units>120)throw new Exception("Full-range fixture requires finite line wheel units");rangeWheel=checked((int)Math.Ceiling(rangeExtent*120.0/(units*16.0)));if(rangeWheel>29880)throw new Exception("Full-range extent exceeds one bounded OS wheel priming packet");}
    if(prime){var priming=Stopwatch.StartNew();double next=0;var input=new Input[1];if(rangeWheel>0){RequireInput(window);input[0]=new Input { Type=0,Mouse=new Mouse { Data=unchecked((uint)(-direction*(rangeWheel+120))),Flags=0x800 } };if(SendInput(1,input,Marshal.SizeOf<Input>())!=1)throw new Exception("Full-range endpoint priming failed");primingPackets=1;Thread.Sleep(600);}else while(primingPackets<packetsPerLeg){RequireInput(window);if(priming.Elapsed.TotalMilliseconds>=next){input[0]=new Input { Type=0,Mouse=new Mouse { Data=unchecked((uint)(-direction*magnitude)),Flags=0x800 } };if(SendInput(1,input,Marshal.SizeOf<Input>())!=1)throw new Exception("OS wheel priming failed");primingPackets++;next=priming.Elapsed.TotalMilliseconds+intervalMs;}Thread.Sleep(1);}primingDurationMs=priming.Elapsed.TotalMilliseconds;}
    int width=Math.Min(320,rect.Right-40),height=Math.Min(360,rect.Bottom-240);
    if(width<100||height<100)throw new Exception("Own list pixels unavailable");
    int sampleX=Math.Max(20,Math.Min(rect.Right-width-20,target.X-origin.X-width/2)),sampleY=Math.Max(180,Math.Min(rect.Bottom-height-20,target.Y-origin.Y-height/2));
    IntPtr screen=capture?GetDC(IntPtr.Zero):IntPtr.Zero,memory=capture?CreateCompatibleDC(screen):IntPtr.Zero,pixels=IntPtr.Zero;
    var info=new BitmapInfo { Size=(uint)Marshal.SizeOf<BitmapInfo>(),Width=width,Height=-height,Planes=1,Bits=32 };
    IntPtr bitmap=capture?CreateDIBSection(screen,ref info,0,out pixels,IntPtr.Zero,0):IntPtr.Zero,previous=capture?SelectObject(memory,bitmap):IntPtr.Zero;
    var buffer=new int[capture?width*height:0]; var result=new Result { PrimingPackets=primingPackets,PrimingDurationMs=primingDurationMs,PhysicalWidth=rect.Right-rect.Left,PhysicalHeight=rect.Bottom-rect.Top,Dpi=(int)GetDpiForWindow(window) }; var clock=Stopwatch.StartNew();
    Thread sender=null; Exception failure=null; int packets=0; bool stop=false;
    // Three independent regions distinguish a static selected card from a
    // stopped surface. This extra sampling belongs only to visual diagnostics.
    Func<int,int,ulong> hash=(x,y)=>{if(!capture)return 0UL;if(!BitBlt(memory,0,0,width,height,screen,origin.X+x,origin.Y+y,0x40cc0020))throw new Exception("Desktop pixel copy failed");Marshal.Copy(pixels,buffer,0,buffer.Length);ulong value=14695981039346656037UL;for(int i=0;i<buffer.Length;i+=3)value=unchecked((value^(uint)(buffer[i]&0xffffff))*1099511628211UL);return value;};
    try {
      int otherX=Math.Max(20,Math.Min(rect.Right-width-20,(rect.Right-width)/4)),otherY=180;
      ulong last=hash(sampleX,sampleY),lastOther=hash(otherX,sampleY),lastTop=hash(otherX,otherY);var surfaceBegin=ReadSurfaceCount(window);SurfaceCount surfaceEnd=null;clock.Restart();result.NativeBeginMs=Stopwatch.GetTimestamp()*1000.0/Stopwatch.Frequency;
      sender=new Thread(()=>{var dpi=SetThreadDpiAwarenessContext(new IntPtr(-4));try {
        var input=new Input[1];double next=0;int leg=0,position=0;
        Action<int> inject=delta=>{if(delta==0)return;RequireInput(window);if(motion)SetCursorPos(target.X+(packets%2)*2,target.Y);input[0]=new Input { Type=0,Mouse=new Mouse { Data=unchecked((uint)delta),Flags=0x800 } };if(SendInput(1,input,Marshal.SizeOf<Input>())!=1)throw new Exception("OS wheel injection failed");Interlocked.Increment(ref packets);};
        while(!Volatile.Read(ref stop)&&clock.Elapsed.TotalMilliseconds<durationMs){RequireInput(window);if(clock.Elapsed.TotalMilliseconds>=next){
          if(rangeWheel>0){double elapsed=clock.Elapsed.TotalMilliseconds;int current=(int)(elapsed/rangeLegMs);while(leg<current){int end=(leg%2==0?rangeWheel:0);inject(direction*(end-position));position=end;leg++;}int progress=(int)Math.Round(Math.Min(1,(elapsed-current*rangeLegMs)/rangeLegMs)*rangeWheel);int desired=current%2==0?progress:rangeWheel-progress;inject(direction*(desired-position));position=desired;}
          else inject(direction*magnitude*((packets/packetsPerLeg)%2==0?1:-1));
          next=clock.Elapsed.TotalMilliseconds+intervalMs;}Thread.Sleep(1);}
        if(rangeWheel>0&&!Volatile.Read(ref stop)){int end=(durationMs/rangeLegMs)%2==0?0:rangeWheel;inject(direction*(end-position));}
      }catch(Exception error){failure=error;}finally{if(dpi!=IntPtr.Zero)SetThreadDpiAwarenessContext(dpi);}});
      sender.Start(); double lastChange=0,lastAnyChange=0,lastSurfaceChange=0;int otherChanges=0;var gapBegin=surfaceBegin;var surfacePrevious=surfaceBegin;
      while(clock.Elapsed.TotalMilliseconds<durationMs+1200){
        if(surfaceEnd==null&&clock.Elapsed.TotalMilliseconds>=durationMs){result.NativeEndMs=Stopwatch.GetTimestamp()*1000.0/Stopwatch.Frequency;surfaceEnd=ReadSurfaceCount(window);}
        ulong current=hash(sampleX,sampleY),other=hash(otherX,sampleY),top=hash(otherX,otherY);double now=clock.Elapsed.TotalMilliseconds;
        if(capture&&now<durationMs){
          var surfaceCurrent=ReadSurfaceCount(window);
          if(surfaceCurrent.View!=surfaceBegin.View||surfaceCurrent.Surface!=surfaceBegin.Surface)throw new Exception("Visual sample surface generation changed");
          if(surfaceCurrent.Count!=surfacePrevious.Count){result.MaximumSurfaceGapMs=Math.Max(result.MaximumSurfaceGapMs,now-lastSurfaceChange);lastSurfaceChange=now;surfacePrevious=surfaceCurrent;}
          if(other!=lastOther||top!=lastTop)otherChanges++;
          if(current!=last||other!=lastOther||top!=lastTop){result.MaximumAllRegionsGapMs=Math.Max(result.MaximumAllRegionsGapMs,now-lastAnyChange);lastAnyChange=now;}
          // Pixel sampling has its own QPC interval. A latest surface timestamp
          // can predate it (for example during unmeasured priming at a clamp).
          // Keep counter/frame brackets separate and exclude priming from input.
          if(current!=last){if(now-lastChange>=250&&result.Gaps.Count<32)result.Gaps.Add(new Gap { BeginMs=lastChange,EndMs=now,PixelBeginQpcMs=result.NativeBeginMs+lastChange,PixelEndQpcMs=result.NativeBeginMs+now,NativeBeginMs=gapBegin.Qpc,NativeEndMs=surfaceCurrent.Qpc,FirstFrame=gapBegin.Frame,LastFrame=surfaceCurrent.Frame,SurfaceUpdates=surfaceCurrent.Count-gapBegin.Count,View=surfaceCurrent.View,Surface=surfaceCurrent.Surface,OtherRegionChanges=otherChanges,Input=ReadInputWindow(window,result.NativeBeginMs+lastChange,result.NativeBeginMs+now,surfaceCurrent.Surface) });gapBegin=surfaceCurrent;otherChanges=0;}
        }
        lastOther=other;lastTop=top;
        if(current!=last){result.Changes.Add(now);if(result.Changes.Count==1)result.FirstChangeMs=now;result.MaximumGapMs=Math.Max(result.MaximumGapMs,now-lastChange);lastChange=now;result.LastChangeMs=now;if(now<durationMs)result.ChangesDuringInput++;else result.ChangesAfterInput++;last=current;}Thread.Sleep(16);
      }
      if(surfaceEnd==null||surfaceBegin.View!=surfaceEnd.View||surfaceBegin.Surface!=surfaceEnd.Surface||surfaceEnd.Count<=surfaceBegin.Count)throw new Exception("Surface counter generation changed or no native surface updated during motion");
      result.SurfaceUpdates=surfaceEnd.Count-surfaceBegin.Count;result.SurfaceDurationMs=surfaceEnd.At-surfaceBegin.At;result.SurfaceFPS=result.SurfaceUpdates*1000.0/result.SurfaceDurationMs;
      if(capture){result.MaximumGapMs=Math.Max(result.MaximumGapMs,durationMs-Math.Min(lastChange,durationMs));result.MaximumAllRegionsGapMs=Math.Max(result.MaximumAllRegionsGapMs,durationMs-Math.Min(lastAnyChange,durationMs));result.MaximumSurfaceGapMs=Math.Max(result.MaximumSurfaceGapMs,durationMs-Math.Min(lastSurfaceChange,durationMs));}
      sender.Join();if(failure!=null)throw failure;result.Packets=Volatile.Read(ref packets);return result;
    } finally { Volatile.Write(ref stop,true);if(sender!=null)sender.Join();if(capture){SelectObject(memory,previous);DeleteObject(bitmap);DeleteDC(memory);ReleaseDC(IntPtr.Zero,screen);} }
  }
}
'@
$application=$null; $originalPointer=New-Object NelyxContinuousScroll+Point; [NelyxContinuousScroll]::GetCursorPos([ref]$originalPointer)|Out-Null
$ownsApplication=$TargetProcessId -eq 0
$checks=@(); $drained=$false;$previousDpi=[NelyxContinuousScroll]::SetThreadDpiAwarenessContext([IntPtr](-4));$window=[IntPtr]::Zero;$lastInjectedPointer=$null;$topmostCaptured=$false;$wasTopmost=$false
try {
  [NelyxContinuousScroll]::timeBeginPeriod(1)|Out-Null
  $start=[Diagnostics.ProcessStartInfo]::new($Executable)
  $start.WorkingDirectory=Split-Path -LiteralPath $Executable
  $start.UseShellExecute=$false; $start.RedirectStandardOutput=$true; $start.RedirectStandardError=$true
  if($CadenceOnly){$start.EnvironmentVariables.Remove('NELYX_TRACKPAD_DIAGNOSTICS');$start.EnvironmentVariables.Remove('NELYX_WINDOWS_FRAME_DIAGNOSTICS')}else{$start.EnvironmentVariables['NELYX_TRACKPAD_DIAGNOSTICS']='1';$start.EnvironmentVariables['NELYX_WINDOWS_FRAME_DIAGNOSTICS']='1'}
  if($RangeDiagnostics){$start.EnvironmentVariables['NELYX_WINDOWS_FRAME_DIAGNOSTICS']='1'}
  $start.EnvironmentVariables['NELYX_WINDOWS_INPUT_TRACE']='1'
  if($ownsApplication){$application=[Diagnostics.Process]::Start($start);$stdout=$application.StandardOutput.ReadToEndAsync();$stderr=$application.StandardError.ReadToEndAsync()}else{
    $application=[Diagnostics.Process]::GetProcessById($TargetProcessId)
    if($application.MainModule.FileName -ne (Resolve-Path -LiteralPath $Executable).Path){throw 'Attached process executable identity mismatch'}
  }
  $deadline=[DateTime]::UtcNow.AddSeconds(25)
  do { if($application.HasExited){throw 'App exited during startup'};$application.Refresh();$window=$application.MainWindowHandle;if($window -eq [IntPtr]::Zero){Start-Sleep -Milliseconds 50} } while($window -eq [IntPtr]::Zero -and [DateTime]::UtcNow -lt $deadline)
  if($window -eq [IntPtr]::Zero){throw 'Visible app window unavailable'}
  $wasTopmost=[NelyxContinuousScroll]::IsTopmost($window);$topmostCaptured=$true
  if($CaptionActivation){$clicked=[NelyxContinuousScroll]::Activate($window);Write-Output ('CONTINUOUS_ACTIVATION '+(@{page=$Page;attempt='probe';ownedCaptionClicked=$clicked}|ConvertTo-Json -Compress));if(-not $clicked){throw 'Owned caption activation probe failed'};Start-Sleep -Milliseconds 150}
  for($attempt=0;$attempt -lt 3;$attempt++){[NelyxContinuousScroll]::SetForegroundWindow($window)|Out-Null;Start-Sleep -Milliseconds 150;if([NelyxContinuousScroll]::GetForegroundWindow() -eq $window){break};$clicked=[NelyxContinuousScroll]::Activate($window);Write-Output ('CONTINUOUS_ACTIVATION '+(@{page=$Page;attempt=$attempt;ownedCaptionClicked=$clicked}|ConvertTo-Json -Compress));Start-Sleep -Milliseconds 150}
  if([NelyxContinuousScroll]::GetForegroundWindow() -ne $window){throw 'Own foreground unavailable'}
  if($WindowTransitions){foreach($command in @(3,9,3,6,9)){[NelyxContinuousScroll]::ShowWindow($window,$command)|Out-Null;Start-Sleep -Milliseconds 400}}
  if($Maximized){[NelyxContinuousScroll]::ShowWindow($window,3)|Out-Null;Start-Sleep -Milliseconds 400}
  function Find-Action([string]$id){
    $condition=[Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::AutomationIdProperty,$id)
    $root=[Windows.Automation.AutomationElement]::FromHandle($window)
    return $root.FindFirst([Windows.Automation.TreeScope]::Descendants,$condition)
  }
  if($ExistingPage -and ($Page -ne 'mixed' -or $null -eq (Find-Action 'mixed-scroll-back'))){throw 'ExistingPage requires the actual mixed page'}
  foreach($id in $(if($ExistingPage){@()}elseif($Page -eq 'list'){@('show-list-view','list-view-last')}elseif($Page -eq 'cupertino'){@('show-cupertino')}elseif($Page -eq 'mixed'){@('show-mixed-scroll')}else{@()})){
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
  if($BothColumns -and $Page -ne 'material'){throw 'Both columns requires Material Gallery'}
  if($PrepareOnly){Write-Output ('CONTINUOUS_PREPARED '+(@{nativeMs=[Diagnostics.Stopwatch]::GetTimestamp()*1000.0/[Diagnostics.Stopwatch]::Frequency}|ConvertTo-Json -Compress));return}
  $fractions=if($BothColumns){@(0.4,(2.0/3.0))}else{@($InputXFraction)}
  $fullRangeResult=$null
  if($FullRange){. (Join-Path $PSScriptRoot 'windows-gallery-range.ps1');$fullRangeResult=Invoke-GalleryFullRange;$checks=$fullRangeResult.checks}else{
  foreach($fraction in $fractions){
  foreach($direction in $(if($Page -eq 'list'){@(1,-1)}else{@(-1,1)})){
    if([NelyxContinuousScroll]::GetForegroundWindow() -ne $window){[NelyxContinuousScroll]::SetForegroundWindow($window)|Out-Null;Start-Sleep -Milliseconds 150}
    $observation=[NelyxContinuousScroll]::Run($window,$direction,$WheelDelta,$WheelPacketsPerLeg,$InputDurationMs,4,$MouseMotion.IsPresent,(-not $CadenceOnly.IsPresent),$fraction,(-not $Unprimed.IsPresent),$(if($RangeExtent -gt 0){$RangeExtent+$RangeExtraExtent}else{0}),$RangeLegDurationMs)
    $checks+=@{direction=$direction;wheelDelta=$WheelDelta;wheelPacketsPerLeg=$WheelPacketsPerLeg;nativeBeginMs=$observation.NativeBeginMs;nativeEndMs=$observation.NativeEndMs;packets=$observation.Packets;changesDuringInput=$observation.ChangesDuringInput;changesAfterInput=$observation.ChangesAfterInput;firstChangeMs=$observation.FirstChangeMs;maximumGapMs=$observation.MaximumGapMs;physicalWidth=$observation.PhysicalWidth;physicalHeight=$observation.PhysicalHeight;dpi=$observation.Dpi;surfaceUpdates=$observation.SurfaceUpdates;surfaceDurationMs=$observation.SurfaceDurationMs;surfaceFPS=$observation.SurfaceFPS;surfaceScope=$(if($ownsApplication){'native surface-updated counter during OS wheel; source probes disabled; scanout unobserved'}else{'native surface-updated counter in existing owner; source probes may be enabled; scanout unobserved'});rangeScope='packet-defined reversals; full-page endpoints require separate verification'}
    $checks[-1].inputXFraction=$fraction
    if($RangeExtent -gt 0){$checks[-1].rangeExtent=$RangeExtent;$checks[-1].rangeExtraExtent=$RangeExtraExtent;$checks[-1].rangeLegDurationMs=$RangeLegDurationMs;$checks[-1].rangeLegsPerDirection=$InputDurationMs/$RangeLegDurationMs;$checks[-1].rangeScope='elapsed-time OS wheel sweep of supplied current logical extent plus explicit endpoint allowance; includes clamp waits; no UIA/JS reads pace timed input; actual endpoints require independent offset verification'}
    $checks[-1].primingPackets=$observation.PrimingPackets;$checks[-1].primingDurationMs=$observation.PrimingDurationMs;$checks[-1].inputPrecondition=if($Unprimed){'unprimed historical reproduction; endpoint clamp may be included'}else{'opposite OS wheel leg before each measured direction; packet reversals and pixel threshold unchanged'}
    if($RangeExtent -gt 0){$checks[-1].Remove('wheelDelta');$checks[-1].Remove('wheelPacketsPerLeg');$checks[-1].inputPrecondition='OS wheel endpoint clamp and 600ms settling outside timing; elapsed-time sweep uses the supplied logical extent'}
    if(-not $CadenceOnly){$checks[-1].maximumAllRegionsGapMs=$observation.MaximumAllRegionsGapMs;$checks[-1].maximumSurfaceGapMs=$observation.MaximumSurfaceGapMs;$checks[-1].primaryGaps=$observation.Gaps;$checks[-1].visualScope='three desktop regions and current-process surface count/frame sampled together; surface progress is not scanout'}
    if($observation.MaximumGapMs -gt 350){Write-Output ('STALLED_CHANGES '+($observation.Changes|ConvertTo-Json -Compress))}
  }
  }
  }
  $lastInjectedPointer=New-Object NelyxContinuousScroll+Point;[NelyxContinuousScroll]::GetCursorPos([ref]$lastInjectedPointer)|Out-Null
  if($ReturnToGallery){if($Page -ne 'mixed'){throw 'ReturnToGallery requires mixed page'};$back=Find-Action 'mixed-scroll-back';if($null -eq $back){throw 'Mixed back action missing'};([Windows.Automation.InvokePattern]$back.GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern)).Invoke();Start-Sleep -Milliseconds 500}
  if(-not $ownsApplication){Write-Output ('CONTINUOUS_SCROLL '+(@{page=$Page;checks=$checks;galleryWarmup=$fullRangeResult.warmup;qualification='attached-diagnostic-only';scope='existing owner may enable source probes; native surface observations are not a normal-product FPS qualification'}|ConvertTo-Json -Depth 16 -Compress));return}
  if($FullRange){[NelyxContinuousScroll]::PostMessageW($window,0x10,[IntPtr]::Zero,[IntPtr]::Zero)|Out-Null}else{[NelyxContinuousScroll]::CloseAfterInput($window)};$closing=[Diagnostics.Stopwatch]::StartNew()
  while([NelyxContinuousScroll]::IsWindowVisible($window) -and $closing.ElapsedMilliseconds -lt 15000){Start-Sleep -Milliseconds 5};$hiddenMs=$closing.Elapsed.TotalMilliseconds
  while([NelyxContinuousScroll]::IsWindow($window) -and $closing.ElapsedMilliseconds -lt 15000){Start-Sleep -Milliseconds 5};$windowCloseMs=$closing.Elapsed.TotalMilliseconds
  if(-not $application.WaitForExit([Math]::Max(1,15000-[int]$closing.ElapsedMilliseconds))){throw 'Close did not complete within 15 seconds'}
  $closeMs=$closing.Elapsed.TotalMilliseconds;$output=$stdout.GetAwaiter().GetResult()+$stderr.GetAwaiter().GetResult()
  $drained=$output.Contains('closed views=0 consumers=0 gpuDrained=1 inputRetired=1')
  if($output.Contains('"type":"rnw-frame-probe')){throw 'Source-instrumented package requires attached diagnostic scope; rebuild the ordinary App before product qualification'}
  $geometryActivationLines=@($output -split "`n" | Where-Object {$_ -match 'NELYX_INPUT_GEOMETRY_STATUS |NELYX_RETAINED_GEOMETRY_NATIVE '})
  $receipt=@{page=$Page;checks=$checks;desktopPixels=if($CadenceOnly){'unobserved'}else{'sampled'};closeMs=$closeMs;hiddenMs=$hiddenMs;windowCloseMs=$windowCloseMs;exitCode=$application.ExitCode;drained=if($CadenceOnly){'unobserved'}else{$drained};scope='actual package native surface counter during continuous OS wheel; desktop sampling is optional; scanout unobserved'}
  $receipt.nativeInputGeometryEvidence=$geometryActivationLines
  $receipt.backingEvidence=@($output -split "`n" | Where-Object {$_ -match 'NELYX_INPUT_GEOMETRY_STATUS |NELYX_WIN32_BACKING_USAGE |NELYX_WIN32_BACKING_BINS '})
$receipt.nativeServiceEvidence=@($output -split "`n" | Where-Object {$_ -match 'NELYX_INPUT_GEOMETRY_STATUS |NELYX_RETAINED_GEOMETRY_NATIVE |NELYX_NATIVE_SERVICE_USAGE |NELYX_NATIVE_SERVICE_BINS |NELYX_NATIVE_ENGINE_USAGE |NELYX_NATIVE_ENGINE_BINS |NELYX_NATIVE_SCROLL_USAGE |NELYX_NATIVE_SCROLL_BINS |NELYX_SCROLL_HOST_USAGE |NELYX_SCROLL_HOST_BINS '})
  $receipt.galleryWarmup=$fullRangeResult.warmup
  Write-Output ('CONTINUOUS_SCROLL '+($receipt|ConvertTo-Json -Depth 16 -Compress))
  Write-Output ($output -split "`n" | Where-Object {$_ -match 'NELYX_WINDOWS_FRAME|close-|closed |APP_STOP|ERROR|failed|resize-timeout'})
  if($application.ExitCode -ne 0 -or (-not $CadenceOnly -and -not $drained)){throw 'Native close/drain failed'}
  if($output -match 'REACT_ERROR|close-failed|resize-failed'){throw 'Native interaction or close reported an error'}
  if(-not $CadenceOnly -and @($checks|Where-Object {$_.changesDuringInput -lt 10 -or $_.maximumGapMs -gt 350}).Count){throw 'Desktop rendering stalled during continuous OS input'}
  if($hiddenMs -gt 350){throw 'Native window remained visible after close'}
} catch {
  if($null -ne $application){
    $alive=-not $application.HasExited
    Write-Output ('CONTINUOUS_FAILURE '+(@{alive=$alive;exitCode=$(if($alive){$null}else{$application.ExitCode});foreground=[NelyxContinuousScroll]::GetForegroundWindow() -eq $window;visible=[NelyxContinuousScroll]::IsWindowVisible($window);message=$_.Exception.Message}|ConvertTo-Json -Compress))
  }
  throw
} finally {
  if($topmostCaptured -and [NelyxContinuousScroll]::IsWindow($window)){$after=if($wasTopmost){[IntPtr](-1)}else{[IntPtr](-2)};[void][NelyxContinuousScroll]::SetWindowPos($window,$after,0,0,0,0,0x13)}
  if($null -ne $application){if($ownsApplication -and -not $application.HasExited){$application.CloseMainWindow()|Out-Null;if(-not $application.WaitForExit(15000)){$application.Kill();$application.WaitForExit()}};$application.Dispose()}
  [NelyxContinuousScroll]::timeEndPeriod(1)|Out-Null
  $currentPointer=New-Object NelyxContinuousScroll+Point;[NelyxContinuousScroll]::GetCursorPos([ref]$currentPointer)|Out-Null
  $restorePointer=$null -ne $lastInjectedPointer -and $currentPointer.X -eq $lastInjectedPointer.X -and $currentPointer.Y -eq $lastInjectedPointer.Y
  if($previousDpi -ne [IntPtr]::Zero){[NelyxContinuousScroll]::SetThreadDpiAwarenessContext($previousDpi)|Out-Null}
  if($restorePointer){[NelyxContinuousScroll]::SetCursorPos($originalPointer.X,$originalPointer.Y)|Out-Null}
}
