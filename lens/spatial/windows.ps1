# Window map for HUMBLE's spatial context (spec section 17, layer 1). Read-only: lists visible top-level windows
# and monitors in physical pixels (per-monitor DPI aware) and prints JSON. No pixels are captured here.
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;

public static class HumbleWin {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags; }
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  public delegate bool MonitorProc(IntPtr m, IntPtr dc, ref RECT r, IntPtr l);

  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr v);
  [DllImport("user32.dll")] static extern bool EnumDisplayMonitors(IntPtr dc, IntPtr clip, MonitorProc cb, IntPtr l);
  [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr m, ref MONITORINFO mi);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int attr, out RECT r, int size);
  [DllImport("dwmapi.dll", EntryPoint = "DwmGetWindowAttribute")] static extern int DwmGetInt(IntPtr h, int attr, out int v, int size);

  public static void Aware() { try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch { } }

  static string Esc(string s) {
    var b = new StringBuilder();
    foreach (var c in s) {
      if (c == '"' || c == '\\') { b.Append('\\').Append(c); }
      else if (c < 0x20) { b.Append("\\u").Append(((int)c).ToString("x4")); }
      else b.Append(c);
    }
    return b.ToString();
  }

  public static string Monitors() {
    var parts = new List<string>();
    EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, (IntPtr m, IntPtr dc, ref RECT r, IntPtr l) => {
      var mi = new MONITORINFO(); mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
      GetMonitorInfo(m, ref mi);
      var x = mi.rcMonitor;
      parts.Add(String.Format("{{\"x\":{0},\"y\":{1},\"width\":{2},\"height\":{3},\"primary\":{4}}}",
        x.L, x.T, x.R - x.L, x.B - x.T, (mi.dwFlags & 1) == 1 ? "true" : "false"));
      return true;
    }, IntPtr.Zero);
    return "[" + String.Join(",", parts) + "]";
  }

  public static string Windows() {
    var parts = new List<string>();
    var fg = GetForegroundWindow();
    int z = 0;
    var names = new Dictionary<uint, string>();
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h) || IsIconic(h) || GetWindow(h, 4) != IntPtr.Zero) return true; // hidden, minimised, owned popups
      int cloaked; if (DwmGetInt(h, 14, out cloaked, 4) == 0 && cloaked != 0) return true; // other virtual desktops, suspended UWP
      var t = new StringBuilder(512); GetWindowText(h, t, 512);
      if (t.Length == 0) return true;
      var c = new StringBuilder(256); GetClassName(h, c, 256);
      RECT r; if (DwmGetWindowAttribute(h, 9, out r, Marshal.SizeOf(typeof(RECT))) != 0) return true;
      if (r.R - r.L < 40 || r.B - r.T < 40) return true;
      uint pid; GetWindowThreadProcessId(h, out pid);
      string app;
      if (!names.TryGetValue(pid, out app)) {
        try { app = Process.GetProcessById((int)pid).ProcessName; } catch { app = ""; }
        names[pid] = app;
      }
      parts.Add(String.Format("{{\"hwnd\":{0},\"pid\":{1},\"app\":\"{2}\",\"cls\":\"{3}\",\"title\":\"{4}\",\"x\":{5},\"y\":{6},\"width\":{7},\"height\":{8},\"z\":{9},\"focused\":{10}}}",
        h.ToInt64(), pid, Esc(app), Esc(c.ToString()), Esc(t.ToString()), r.L, r.T, r.R - r.L, r.B - r.T, z++, h == fg ? "true" : "false"));
      return true;
    }, IntPtr.Zero);
    return "[" + String.Join(",", parts) + "]";
  }
}
'@
[HumbleWin]::Aware()
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::Out.Write('{"monitors":' + [HumbleWin]::Monitors() + ',"windows":' + [HumbleWin]::Windows() + '}')
