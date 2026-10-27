using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using DPUruNet;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Runtime.InteropServices;

static class Program
{
    [STAThread]
    static int Main(string[] args)
    {
        Application.EnableVisualStyles();

        if (args.Length > 0 && args[0] == "--check")
        {
            try { Console.WriteLine("READERS:" + ReaderCollection.GetReaders().Count); }
            catch (Exception ex) { Console.WriteLine("ERROR:" + ex.Message); }
            return 0;
        }
        if (args.Length > 0 && args[0] == "--capture")
        {
            Application.Run(new CaptureWorkerForm());
            return 0;
        }
        Application.Run(new BridgeForm());
        return 0;
    }
}

class FmdOutcome { public string B64; public string Error; }

// ===== Worker: one capture, then exit. Same pattern as the working captest. =====
class CaptureWorkerForm : Form
{
    ReaderCollection readers;
    Reader reader;
    readonly Reader.CaptureCallback handler;
    readonly Label label = new Label { Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleCenter };
    readonly System.Windows.Forms.Timer deadline = new System.Windows.Forms.Timer { Interval = 25000 };
    volatile bool finished;

    // Window Focus Win32 APIs
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    void BringToFrontHard()
    {
        const byte VK_MENU = 0x12;          // the ALT key
        const uint KEYEVENTF_KEYUP = 0x2;
        keybd_event(VK_MENU, 0, 0, UIntPtr.Zero);              // a keypress lets us take focus
        keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);

        WindowState = FormWindowState.Normal;
        TopMost = true;
        Show();
        Activate();
        BringToFront();
        SetForegroundWindow(Handle);
    }

    public CaptureWorkerForm()
    {
        Text = "Scanner ready";
        Width = 300;
        Height = 110;
        StartPosition = FormStartPosition.Manual;
        var area = Screen.PrimaryScreen.WorkingArea;
        Location = new Point(area.Right - Width - 16, area.Bottom - Height - 16);
        Controls.Add(label);
        handler = new Reader.CaptureCallback(OnCaptured);
        
        // Force window to front on start
        Shown += (s, e) => { BringToFrontHard(); Start(); };     
        deadline.Tick += (s, e) => Finish("ERROR:TIMEOUT_NO_FINGER");
    }

    void Start()
    {
        try
        {
            // Change A: Watch stdin for cancellation
            var cancelWatcher = new Thread(() =>
            {
                try
                {
                    string line;
                    while ((line = Console.In.ReadLine()) != null)
                        if (line == "CANCEL") { Finish("ERROR:CANCELLED"); break; }
                }
                catch { }
            }) { IsBackground = true };
            cancelWatcher.Start();

            readers = ReaderCollection.GetReaders();
            if (readers.Count == 0) { Finish("ERROR:DEVICE_NOT_FOUND"); return; }
            reader = readers[0];

            var open = reader.Open(Constants.CapturePriority.DP_PRIORITY_EXCLUSIVE);
            if (open != Constants.ResultCode.DP_SUCCESS) { Finish("ERROR:OPEN_FAILED_" + open); return; }
            reader.On_Captured += handler;

            reader.GetStatus();
            if (reader.Status.Status == Constants.ReaderStatuses.DP_STATUS_NEED_CALIBRATION)
                reader.Calibrate();

            var rc = reader.CaptureAsync(
                Constants.Formats.Fid.ANSI,
                Constants.CaptureProcessing.DP_IMG_PROC_DEFAULT,
                reader.Capabilities.Resolutions[0]);
            if (rc != Constants.ResultCode.DP_SUCCESS) { Finish("ERROR:CAPTURE_START_FAILED_" + rc); return; }

            label.Text = "Place your finger now";
            deadline.Start();
            Console.WriteLine("READY");
            Console.Out.Flush();
        }
        catch (Exception ex) { Finish("ERROR:EXCEPTION_" + ex.Message.Replace('\r', ' ').Replace('\n', ' ')); }
    }

    void OnCaptured(CaptureResult r)
    {
        if (r.Quality == Constants.CaptureQuality.DP_QUALITY_CANCELED) return;
        if (r.ResultCode != Constants.ResultCode.DP_SUCCESS) { Finish("ERROR:" + r.ResultCode); return; }
        if (r.Data == null || r.Quality != Constants.CaptureQuality.DP_QUALITY_GOOD)
        { Finish("ERROR:POOR_QUALITY_" + r.Quality); return; }

        var fmd = FeatureExtraction.CreateFmdFromFid(r.Data, Constants.Formats.Fmd.ANSI);
        if (fmd.ResultCode != Constants.ResultCode.DP_SUCCESS) { Finish("ERROR:" + fmd.ResultCode); return; }

        Finish("RESULT:" + Convert.ToBase64String(Encoding.UTF8.GetBytes(Fmd.SerializeXml(fmd.Data))));
    }

    void Finish(string line)
    {
        if (finished) return;
        finished = true;
        Console.WriteLine(line);
        Console.Out.Flush();
        if (IsHandleCreated)
        {
            if (InvokeRequired) BeginInvoke(new Action(Close)); else Close();
        }
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        deadline.Stop();
        try
        {
            if (reader != null)
            {
                reader.On_Captured -= handler;
                reader.CancelCapture();
                reader.Dispose();
            }
        }
        catch { }
        base.OnFormClosing(e);
    }
}

// ===== Bridge: HTTP server + matching. Never touches the reader itself. =====
class BridgeForm : Form
{
    const string Prefix = "http://127.0.0.1:8765/";
    static readonly string Secret =
        Environment.GetEnvironmentVariable("BRIDGE_SECRET") ?? "super-secret-bridge-key";

    readonly SemaphoreSlim gate = new SemaphoreSlim(1, 1);
    HttpListener listener;
    readonly Label statusLabel = new Label { Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleCenter };

    // Change B: Cancellation fields
    int cancelGeneration;
    Process currentWorker;
    readonly object workerLock = new object();

    public BridgeForm()
    {
        Text = "Fingerprint Bridge";
        Width = 420;
        Height = 140;
        Controls.Add(statusLabel);
        statusLabel.Text = "Starting...";
        Shown += (s, e) => StartHttp();
    }

    static void Log(string m) { Console.WriteLine(DateTime.Now.ToString("HH:mm:ss") + "  " + m); }

    void SetStatus(string text)
    {
        if (IsHandleCreated && !IsDisposed) BeginInvoke(new Action(() => statusLabel.Text = text));
    }

    // ---------- scanner access via short-lived worker processes ----------
    async Task<bool> CheckDevice()
    {
        try
        {
            var psi = new ProcessStartInfo(Application.ExecutablePath, "--check")
            { UseShellExecute = false, RedirectStandardOutput = true, CreateNoWindow = true };
            using (var p = Process.Start(psi))
            {
                string output = await Task.Run(() =>
                {
                    var o = p.StandardOutput.ReadToEnd();
                    p.WaitForExit(5000);
                    return o;
                });
                return output.Contains("READERS:") && !output.Contains("READERS:0");
            }
        }
        catch { return false; }
    }

    // Change C: Updated CaptureToFmd with cancellation support
    async Task<FmdOutcome> CaptureToFmd(int timeoutMs)
    {
        int gen = Volatile.Read(ref cancelGeneration);
        await gate.WaitAsync();   // one capture at a time
        try
        {
            if (Volatile.Read(ref cancelGeneration) != gen)
                return new FmdOutcome { Error = "CANCELLED" };

            string result = null, error = null;
            var psi = new ProcessStartInfo(Application.ExecutablePath, "--capture")
            {
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardInput = true,
                CreateNoWindow = true
            };

            using (var p = Process.Start(psi))
            {
                lock (workerLock) currentWorker = p;
                try
                {
                    var reading = Task.Run(() =>
                    {
                        string line;
                        while ((line = p.StandardOutput.ReadLine()) != null)
                        {
                            if (line == "READY") { Log("Place finger now..."); SetStatus(">>> PLACE FINGER NOW <<<"); }
                            else if (line.StartsWith("RESULT:")) { result = line.Substring(7); Log("Captured OK"); }
                            else if (line.StartsWith("ERROR:")) { error = line.Substring(6); Log("Worker error: " + error); }
                        }
                    });

                    bool exited = await Task.Run(() => p.WaitForExit(timeoutMs));
                    if (!exited) { try { p.Kill(); } catch { } error = "WORKER_TIMEOUT"; }
                    await Task.WhenAny(reading, Task.Delay(2000));
                }
                finally
                {
                    lock (workerLock) currentWorker = null;
                }
            }

            SetStatus("Bridge running on 8765");
            if (result != null) return new FmdOutcome { B64 = result };
            if (Volatile.Read(ref cancelGeneration) != gen) return new FmdOutcome { Error = "CANCELLED" };
            return new FmdOutcome { Error = error ?? "NO_RESULT" };
        }
        finally { gate.Release(); }
    }

    // Change D: CancelCurrentScan
    void CancelCurrentScan()
    {
        Interlocked.Increment(ref cancelGeneration);
        Process p;
        lock (workerLock) p = currentWorker;
        if (p == null) return;

        try { p.StandardInput.WriteLine("CANCEL"); p.StandardInput.Flush(); } catch { }

        // If it hasn't closed itself after 2.5 s, end it.
        Task.Run(async () =>
        {
            await Task.Delay(2500);
            try { if (!p.HasExited) p.Kill(); } catch { }
        });
    }

    static Fmd Base64ToFmd(string b64)
    {
        return Fmd.DeserializeXml(Encoding.UTF8.GetString(Convert.FromBase64String(b64)));
    }

    static string FmdToBase64(Fmd fmd)
    {
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(Fmd.SerializeXml(fmd)));
    }

    static object Err(string e) { return new { ok = false, error = e }; }

    // ---------- endpoints ----------
    async Task<object> DoCapture()
    {
        var r = await CaptureToFmd(35000);
        if (r.Error != null) return Err(r.Error);
        return new { ok = true, fmd = r.B64, quality = "DP_QUALITY_GOOD" };
    }

    async Task<object> DoEnroll(JObject body)
    {
        int scans = 4;
        var sv = Get(body, "scans");
        if (sv != null) scans = (int)sv;
        if (scans < 2 || scans > 8) return Err("INVALID_SCAN_COUNT");

        var fmds = new List<Fmd>();
        for (int i = 0; i < scans; i++)
        {
            Log("Enroll scan " + (i + 1) + " of " + scans);
            var r = await CaptureToFmd(35000);
            if (r.Error != null) return Err(r.Error);
            fmds.Add(Base64ToFmd(r.B64));
            await Task.Delay(1200);   // time to lift the finger
        }

        var enr = Enrollment.CreateEnrollmentFmd(Constants.Formats.Fmd.ANSI, fmds);
        if (enr.ResultCode != Constants.ResultCode.DP_SUCCESS) return Err(enr.ResultCode.ToString());
        return new { ok = true, fmd = FmdToBase64(enr.Data), scansUsed = scans };
    }

    object DoIdentify(JObject body)
    {
        var probeB64 = (string)Get(body, "probe");
        var cands = Get(body, "candidates") as JArray;
        if (string.IsNullOrEmpty(probeB64) || cands == null) return Err("INVALID_FMD");

        try
        {
            var probe = Base64ToFmd(probeB64);
            int bestScore = int.MaxValue;
            string bestUser = null;

            foreach (JObject c in cands)
            {
                var uid = (string)Get(c, "userId");
                try
                {
                    var cand = Base64ToFmd((string)Get(c, "fmd"));
                    var cmp = Comparison.Compare(probe, 0, cand, 0);
                    Log("Compare: " + cmp.ResultCode + ", score " + cmp.Score);
                    if (cmp.ResultCode == Constants.ResultCode.DP_SUCCESS && (bestUser == null || cmp.Score < bestScore))
                    {
                        bestScore = cmp.Score;
                        bestUser = uid;
                    }
                }
                catch (Exception ex)
                {
                    Log("Skipping unreadable template for " + uid + ": " + ex.Message);
                }
            }

            if (bestUser != null) return new { ok = true, match = new { userId = bestUser, score = bestScore } };
            return new { ok = true, match = (object)null };
        }
        catch (Exception ex)
        {
            Log("Identify exception: " + ex);
            return new { ok = false, error = "IDENTIFY_FAILED", message = ex.Message };
        }
    }

    static JToken Get(JObject o, string name)
    {
        return o == null ? null : o.GetValue(name, StringComparison.OrdinalIgnoreCase);
    }

    // ---------- HTTP plumbing ----------
    void StartHttp()
    {
        try
        {
            listener = new HttpListener();
            listener.Prefixes.Add(Prefix);
            listener.Start();
            Log("Listening on " + Prefix);
            SetStatus("Bridge running on 8765");
        }
        catch (HttpListenerException ex)
        {
            Log("HTTP start failed: " + ex.Message);
            SetStatus("HTTP start failed - see console");
            return;
        }

        Task.Run(async () =>
        {
            while (listener.IsListening)
            {
                HttpListenerContext ctx;
                try { ctx = await listener.GetContextAsync(); } catch { break; }
                var _ = Task.Run(() => HandleAsync(ctx));
            }
        });
    }

    async Task HandleAsync(HttpListenerContext ctx)
    {
        try
        {
            string path = ctx.Request.Url.AbsolutePath.TrimEnd('/');
            string method = ctx.Request.HttpMethod;

            if (path != "/health" && ctx.Request.Headers["X-Bridge-Secret"] != Secret)
            {
                Respond(ctx, 401, Err("UNAUTHORIZED"));
                return;
            }

            JObject body = null;
            if (method == "POST" && ctx.Request.HasEntityBody)
            {
                using (var sr = new StreamReader(ctx.Request.InputStream, Encoding.UTF8))
                {
                    var text = await sr.ReadToEndAsync();
                    if (!string.IsNullOrWhiteSpace(text)) body = JObject.Parse(text);
                }
            }

            object result;
            if (path == "/health" && method == "GET")
                result = new { ok = true, deviceConnected = await CheckDevice(), sdkVersion = "2.2.3" };
            else if (path == "/capture" && method == "POST") result = await DoCapture();
            else if (path == "/enroll" && method == "POST") result = await DoEnroll(body);
            else if (path == "/identify" && method == "POST") result = DoIdentify(body);
            // Change E: /cancel endpoint
            else if (path == "/cancel" && method == "POST") { CancelCurrentScan(); result = new { ok = true }; }
            else { Respond(ctx, 404, Err("NOT_FOUND")); return; }

            Respond(ctx, 200, result);
        }
        catch (Exception ex)
        {
            Log(ex.ToString());
            try { Respond(ctx, 500, new { ok = false, error = "INTERNAL_ERROR", message = ex.Message }); } catch { }
        }
    }

    static void Respond(HttpListenerContext ctx, int status, object payload)
    {
        var bytes = Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(payload));
        ctx.Response.StatusCode = status;
        ctx.Response.ContentType = "application/json";
        ctx.Response.ContentLength64 = bytes.Length;
        ctx.Response.OutputStream.Write(bytes, 0, bytes.Length);
        ctx.Response.Close();
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        try { if (listener != null) listener.Stop(); } catch { }
        base.OnFormClosing(e);
    }
}