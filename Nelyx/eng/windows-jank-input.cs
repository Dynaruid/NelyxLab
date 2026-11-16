using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using Microsoft.Win32.SafeHandles;

public static class FastCalendarInput {
 [StructLayout(LayoutKind.Sequential)] public struct Point { public int X,Y; }
 [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
 [StructLayout(LayoutKind.Sequential)] public struct PointerInfo {
  public uint Type,Id,Frame,Flags; public IntPtr Device,Window;
  public Point Pixel,Himetric,PixelRaw,HimetricRaw; public uint Time,History;
  public int InputData; public uint KeyStates; public ulong PerformanceCount; public int ButtonChange;
 }
 [StructLayout(LayoutKind.Sequential)] public struct TouchInfo {
  public PointerInfo Pointer; public uint Flags,Mask; public Rect Contact,ContactRaw; public uint Orientation,Pressure;
 }
 [StructLayout(LayoutKind.Sequential)] public struct Mouse { public int X,Y; public uint Data,Flags,Time; public UIntPtr Extra; }
 [StructLayout(LayoutKind.Sequential)] public struct Keyboard { public ushort Key,Scan; public uint Flags,Time; public UIntPtr Extra; }
 [StructLayout(LayoutKind.Explicit)] public struct Payload { [FieldOffset(0)] public Mouse Mouse; [FieldOffset(0)] public Keyboard Keyboard; }
 [StructLayout(LayoutKind.Sequential)] public struct Input { public uint Type; public Payload Payload; }
 [DllImport("user32.dll",SetLastError=true)] public static extern bool InitializeTouchInjection(uint count,uint feedback);
 [DllImport("user32.dll",SetLastError=true)] public static extern bool InjectTouchInput(uint count,[In]TouchInfo[] contacts);
 [DllImport("user32.dll",SetLastError=true)] public static extern uint SendInput(uint count,[In]Input[] inputs,int size);
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr w,out Rect r);
 [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr w,ref Point p);
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);
 [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr w);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr w);
 [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr w);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr w,int command);
 [DllImport("user32.dll",SetLastError=true)] public static extern bool SetWindowPos(IntPtr w,IntPtr after,int x,int y,int width,int height,uint flags);
 [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a,uint b,bool attach);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr w,out uint pid);
 [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
 [DllImport("user32.dll",SetLastError=true)] public static extern bool PostMessage(IntPtr w,uint message,IntPtr a,IntPtr b);
 [DllImport("winmm.dll")] public static extern uint timeBeginPeriod(uint period);
 [DllImport("winmm.dll")] public static extern uint timeEndPeriod(uint period);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern SafeWaitHandle CreateWaitableTimerEx(IntPtr attributes,string name,uint flags,uint access);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetWaitableTimer(SafeWaitHandle timer,ref long dueTime,int period,IntPtr completion,IntPtr argument,bool resume);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(SafeWaitHandle handle,uint milliseconds);

 public sealed class Timing {
  public readonly string WaitStrategy="high-resolution-waitable-timer+QPC";
  public double Hz,PeriodMs,EffectiveHz,MaxLatenessMs,MaxIntervalErrorMs;
  public int Injected;
  public bool CadenceValid;
  public double[] ScheduledMs,ActualInjectionMs,ApiDurationMs,IntervalsMs,AttemptQpcMs;
 }
 public sealed class SwipeFrame {
  public double At; public int X,Y,Gesture; public uint Flags;
 }
 public sealed class SwipeResult {
  public Timing Timing;
  public int MovesPerGesture;
  public double ScheduledMoveMs;
  public double[] DurationMs,StartCadenceMs;
 }
 static readonly int InputSize=Marshal.SizeOf(typeof(Input));
 const uint Down=0x10006,Update=0x20006,Up=0x40000;

 public static double[] Deadlines(int count,double hz) {
  if(count<1||count>4096||double.IsNaN(hz)||double.IsInfinity(hz)||hz<1||hz>240)
   throw new ArgumentException("Invalid bounded input schedule");
  var result=new double[count];
  for(int i=0;i<count;i++)result[i]=i*1000.0/hz;
  return result;
 }
 static void WaitUntil(Stopwatch clock,double deadline,SafeWaitHandle timer) {
  for(;;) {
   double remaining=deadline-clock.Elapsed.TotalMilliseconds;
   if(remaining<=0)return;
   // A hidden PowerShell process cannot rely on the Sleep timer resolution.
   // Arm a one-shot high-resolution timer, then finish against the QPC deadline.
   // The absolute schedule and late-run rejection remain independent of waits.
   if(remaining>2) {
    long dueTime=-(long)((remaining-1)*10000);
    if(!SetWaitableTimer(timer,ref dueTime,0,IntPtr.Zero,IntPtr.Zero,false))
     throw new Exception("Input wait timer could not arm: "+Marshal.GetLastWin32Error());
    uint waited=WaitForSingleObject(timer,(uint)Math.Ceiling(remaining)+1000);
    if(waited!=0)throw new Exception("Input wait timer failed: "+waited+" / "+Marshal.GetLastWin32Error());
   }
   else Thread.SpinWait(64);
  }
 }
 public static Timing Replay(double[] deadlines,double hz,Action<int> send) {
  if(deadlines==null||send==null)throw new ArgumentNullException();
  Deadlines(deadlines.Length,hz);
  for(int i=0;i<deadlines.Length;i++)
   if(double.IsNaN(deadlines[i])||double.IsInfinity(deadlines[i])||deadlines[i]<0||
      deadlines[i]>180000||(i>0&&deadlines[i]<=deadlines[i-1]))
    throw new ArgumentException("Input deadlines must increase within 3 minutes");
  var result=new Timing {
   Hz=hz,PeriodMs=1000.0/hz,ScheduledMs=(double[])deadlines.Clone(),
   ActualInjectionMs=new double[deadlines.Length],ApiDurationMs=new double[deadlines.Length],AttemptQpcMs=new double[deadlines.Length]
  };
  var intervals=new double[Math.Max(0,deadlines.Length-1)];int intervalCount=0;
  // CREATE_WAITABLE_TIMER_HIGH_RESOLUTION; only SYNCHRONIZE|TIMER_MODIFY_STATE.
  // SafeWaitHandle releases the unnamed timer on success and every failure path.
  using(var timer=CreateWaitableTimerEx(IntPtr.Zero,null,2,0x00100002)) {
   if(timer.IsInvalid)throw new Exception("High resolution input timer unavailable: "+Marshal.GetLastWin32Error());
   if(timeBeginPeriod(1)!=0)throw new Exception("Input timer resolution request failed");
   try {
   // Exercise the blocking and spin paths before the measured schedule.
   var clock=Stopwatch.StartNew();WaitUntil(clock,3,timer);clock.Restart();
   for(int i=0;i<deadlines.Length;i++) {
    WaitUntil(clock,deadlines[i],timer);
    double actual=clock.Elapsed.TotalMilliseconds,lateness=actual-deadlines[i];
    // A late sender must invalidate the run, never burst to catch up or drop input.
    if(lateness>result.PeriodMs/4)
     throw new Exception("Input deadline missed at sample "+i+": "+lateness.ToString("F3")+"ms");
    result.ActualInjectionMs[i]=actual;
    result.AttemptQpcMs[i]=Stopwatch.GetTimestamp()*1000.0/Stopwatch.Frequency;
    send(i);
    result.ApiDurationMs[i]=clock.Elapsed.TotalMilliseconds-actual;
    result.Injected++;
    result.MaxLatenessMs=Math.Max(result.MaxLatenessMs,lateness);
    if(i>0&&Math.Abs(deadlines[i]-deadlines[i-1]-result.PeriodMs)<0.001) {
     double interval=actual-result.ActualInjectionMs[i-1];
     intervals[intervalCount++]=interval;
     result.MaxIntervalErrorMs=Math.Max(result.MaxIntervalErrorMs,Math.Abs(interval-result.PeriodMs));
    }
   }
   } finally {timeEndPeriod(1);}
  }
  Array.Resize(ref intervals,intervalCount);result.IntervalsMs=intervals;
  double total=0;foreach(double interval in intervals)total+=interval;
  result.EffectiveHz=total>0?intervalCount*1000.0/total:0;
  result.CadenceValid=result.Injected==deadlines.Length&&result.MaxIntervalErrorMs<=result.PeriodMs/4;
  if(!result.CadenceValid)throw new Exception("Input cadence exceeded its 25 percent jitter limit");
  return result;
 }
 public static void Click(int x,int y) {
  SetCursorPos(x,y);var input=new Input();input.Payload.Mouse.Extra=(UIntPtr)0x4e53534c;
  input.Payload.Mouse.Flags=2;
  if(SendInput(1,new[]{input},InputSize)!=1)throw new Exception("Mouse down rejected");
  try {Thread.Sleep(35);}
  finally {input.Payload.Mouse.Flags=4;if(SendInput(1,new[]{input},InputSize)!=1)throw new Exception("Mouse up rejected");}
 }
 public static void Key(ushort key,ushort scan,uint flags) {
  var input=new Input();input.Type=1;input.Payload.Keyboard.Key=key;input.Payload.Keyboard.Scan=scan;input.Payload.Keyboard.Flags=flags;
  if(SendInput(1,new[]{input},InputSize)!=1)throw new Exception("Keyboard input rejected");
 }
 public static void TypeText(string text) {
  try {Key(0x11,0,0);Key(0x41,0,0);}
  finally {Key(0x41,0,2);Key(0x11,0,2);}
  foreach(char value in text){try{Key(0,value,4);}finally{Key(0,value,6);}}
 }
 public static Timing Wheels(IntPtr window,int count,int delta,double hz) {
  if(delta==0||Math.Abs((long)delta)>120)throw new ArgumentException("Invalid wheel delta");
  var input=new Input[1];input[0].Payload.Mouse.Data=unchecked((uint)delta);input[0].Payload.Mouse.Flags=0x800;
  // Reuse the marshalled packet; do not allocate a packet/array for every frame.
  return Replay(Deadlines(count,hz),hz,i=> {
   if(GetForegroundWindow()!=window)throw new Exception("Owned window lost foreground");
   if(SendInput(1,input,InputSize)!=1)throw new Exception("Wheel input rejected");
  });
 }
 public static SwipeFrame[] SwipeFrames(int count,int moveMs,int gapMs,double hz,int from,int to,int y) {
  Deadlines(1,hz);
  if(count<1||count>24||moveMs<5||moveMs>1000||gapMs<1||gapMs>1000||from==to)
   throw new ArgumentException("Invalid bounded swipe plan");
  // MoveMs previously described one of eight relative sleeps. Keep its nominal
  // gesture speed, rounding the duration to a whole number of 60 Hz frames.
  int steps=Math.Max(1,(int)Math.Round(moveMs*8*hz/1000.0));
  if(count*(steps+2)>4096)throw new ArgumentException("Swipe sample budget exceeded");
  double period=1000.0/hz,duration=steps*period,start=0;
  var frames=new SwipeFrame[count*(steps+2)];int index=0;
  for(int gesture=0;gesture<count;gesture++) {
   frames[index++]=new SwipeFrame{At=start,X=from,Y=y,Gesture=gesture,Flags=Down};
   for(int step=1;step<=steps;step++)
    frames[index++]=new SwipeFrame{At=start+step*period,X=(int)Math.Round(from+(to-from)*step/(double)steps),Y=y,Gesture=gesture,Flags=Update};
   // Touch-up repeats the final update position; it is a terminal, not a motion sample.
   frames[index++]=new SwipeFrame{At=start+duration+1,X=to,Y=y,Gesture=gesture,Flags=Up};
   start+=duration+1+gapMs;
  }
  return frames;
 }
 static TouchInfo Contact(int x,int y,uint flags) {
  var p=new TouchInfo();p.Pointer.Type=2;p.Pointer.Id=0;p.Pointer.Flags=flags;
  p.Pointer.Pixel.X=x;p.Pointer.Pixel.Y=y;p.Mask=7;p.Orientation=90;p.Pressure=512;
  p.Contact.Left=x-2;p.Contact.Right=x+2;p.Contact.Top=y-2;p.Contact.Bottom=y+2;
  return p;
 }
 public static SwipeResult Swipes(IntPtr window,int count,int moveMs,int gapMs,double hz,int from,int to,int y) {
  Rect rect;var origin=new Point();
  if(!GetClientRect(window,out rect)||!ClientToScreen(window,ref origin))throw new Exception("Swipe client geometry unavailable");
  foreach(int x in new[]{from,to})if(x<origin.X||x>=origin.X+rect.Right||y<origin.Y||y>=origin.Y+rect.Bottom)throw new Exception("Swipe outside owned client");
  var frames=SwipeFrames(count,moveMs,gapMs,hz,from,to,y);
  var deadlines=new double[frames.Length];var packets=new TouchInfo[frames.Length];
  for(int i=0;i<frames.Length;i++){deadlines[i]=frames[i].At;packets[i]=Contact(frames[i].X,frames[i].Y,frames[i].Flags);}
  var contact=new TouchInfo[1];bool pressed=false;int last=-1;
  var result=new SwipeResult{MovesPerGesture=frames.Length/count-2,DurationMs=new double[count],StartCadenceMs=new double[Math.Max(0,count-1)]};
  result.ScheduledMoveMs=result.MovesPerGesture*1000.0/hz;
  try {
   result.Timing=Replay(deadlines,hz,i=> {
    if(GetForegroundWindow()!=window)throw new Exception("Owned window lost foreground");
    contact[0]=packets[i];
    if(!InjectTouchInput(1,contact))throw new Exception("InjectTouchInput flags="+frames[i].Flags+" error="+Marshal.GetLastWin32Error());
    last=i;pressed=frames[i].Flags!=Up;
   });
   int stride=result.MovesPerGesture+2;
   for(int gesture=0;gesture<count;gesture++) {
    int start=gesture*stride;
    result.DurationMs[gesture]=result.Timing.ActualInjectionMs[start+stride-1]-result.Timing.ActualInjectionMs[start];
    if(gesture>0)result.StartCadenceMs[gesture-1]=result.Timing.ActualInjectionMs[start]-result.Timing.ActualInjectionMs[start-stride];
   }
   return result;
  } finally {
   if(pressed) {
    Thread.Sleep(1);contact[0]=Contact(frames[last].X,frames[last].Y,Up);
    if(!InjectTouchInput(1,contact))throw new Exception("Touch cleanup rejected error="+Marshal.GetLastWin32Error());
   }
  }
 }
}
