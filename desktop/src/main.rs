// The FUI desktop shell.
//
// The window is a view onto a `dsh --profile fui` process this app owns: it
// spawns the backend on an OS-assigned port, reads the port back from the URL
// line the web bundle prints, and points the webview at it.
//
// Out of process rather than embedded, for two reasons that are properties of
// the harness rather than preferences. Client plugins are loaded by injecting
// external <script> tags into the page, which a `file://` origin does not
// serve; and Tauri uses the system webview, so there is no Node runtime in
// this process to host the harness anyway. Loopback HTTP sidesteps both, and
// the harness already fences `/api` to loopback authorities.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
#[cfg(unix)]
use std::os::unix::process::CommandExt;
use std::collections::VecDeque;
use std::sync::atomic::{AtomicI32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, WindowEvent};

/// How long to wait for the backend to announce its URL before giving up.
const READY_TIMEOUT: Duration = Duration::from_secs(90);

/// Pid of the live backend's process group, readable from a signal handler.
///
/// The handler cannot take the mutex below — locking is not async-signal-safe —
/// so the group id is mirrored here as a plain atomic that `killpg` can use
/// directly.
static BACKEND_GROUP: AtomicI32 = AtomicI32::new(0);

/// The backend process this app owns, held so every exit path can reap it.
struct Backend(Mutex<Option<Child>>);

impl Backend {
    /// Terminate the backend if it is still running. Idempotent.
    ///
    /// Signals the whole process group, not just the child. `pnpm dsh` is a
    /// three-link chain — a launcher shim, the resolved pnpm, then the tsx
    /// host — so killing only the process we spawned leaves the two that
    /// actually hold the port. The child is put in its own group at spawn
    /// precisely so this signal can reach all of them.
    fn reap(&self) {
        if let Some(mut child) = self.0.lock().unwrap().take() {
            BACKEND_GROUP.store(0, Ordering::SeqCst);
            terminate_group(child.id());
            let _ = child.wait();
        }
    }
}

/// Signal a whole process group down, escalating if it does not go quietly.
fn terminate_group(pid: u32) {
    #[cfg(unix)]
    unsafe {
        if libc::killpg(pid as i32, libc::SIGTERM) != 0 {
            // No group (spawn raced, or already reaped): fall back to the one pid.
            libc::kill(pid as i32, libc::SIGTERM);
        }
        // The harness closes its server and sockets on SIGTERM; give it a
        // moment before insisting.
        std::thread::sleep(Duration::from_millis(600));
        libc::killpg(pid as i32, libc::SIGKILL);
    }
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill").args(["/PID", &pid.to_string(), "/T", "/F"]).output();
    }
}

/// Path of the file recording the live backend's pid.
fn pid_file() -> PathBuf {
    std::env::temp_dir().join("deepseek-fui-backend.pid")
}

/// Kill a backend a previous run left behind.
///
/// A parent killed with SIGKILL runs no exit path, so its child outlives it.
/// Reaping at startup keeps that orphan from accumulating across launches.
/// It cannot strand the port — the backend binds an OS-assigned one — so this
/// is about process hygiene, not availability.
fn reap_previous_backend() {
    let path = pid_file();
    let Ok(text) = std::fs::read_to_string(&path) else { return };
    if let Ok(pid) = text.trim().parse::<u32>() {
        #[cfg(unix)]
        {
            // Signal 0 probes liveness; only then spend a real kill, so a
            // recycled pid belonging to something else is left alone.
            let alive = unsafe { libc::kill(pid as i32, 0) } == 0;
            if alive {
                terminate_group(pid);
            }
        }
        #[cfg(not(unix))]
        terminate_group(pid);
    }
    let _ = std::fs::remove_file(&path);
}

/// Lowest Node the harness runs on, from the root package.json engines range.
const MIN_NODE: (u32, u32) = (22, 19);

/// Env var naming a directory to put ahead of PATH for the backend.
///
/// The seam a packaged build will use: point it at the bundled Node and the
/// shell stops depending on whatever the launching environment happens to
/// have. In a checkout it is also the escape hatch when the developer's first
/// `node` is too old.
const NODE_BIN_OVERRIDE: &str = "DEEPSEEK_FUI_NODE_BIN";

/// PATH for the backend, with the override directory in front when set.
fn backend_path() -> Option<String> {
    let dir = std::env::var(NODE_BIN_OVERRIDE).ok()?;
    let rest = std::env::var("PATH").unwrap_or_default();
    Some(format!("{dir}:{rest}"))
}

/// Verify the `node` the backend will inherit can actually run the harness.
///
/// Worth a pre-flight rather than letting the boot fail: below this version
/// `node:zlib` has no `createZstdDecompress`, and the harness dies deep inside
/// plugin loading with a module-export error that says nothing about Node
/// versions. PATH is what decides this, and a GUI launch has a different PATH
/// from the terminal the developer tested in.
fn check_node_version() -> Result<(), String> {
    let mut probe = Command::new("node");
    probe.arg("-v");
    if let Some(path) = backend_path() {
        probe.env("PATH", path);
    }
    let out = probe
        .output()
        .map_err(|e| format!("could not run `node` ({e}). Is it on PATH?"))?;
    let text = String::from_utf8_lossy(&out.stdout);
    let version = text.trim().trim_start_matches('v');
    let mut parts = version.split('.').map(str::parse::<u32>);
    let (Some(Ok(major)), Some(Ok(minor))) = (parts.next(), parts.next()) else {
        return Err(format!("could not read a version out of `node -v` ({version})"));
    };
    let ok = major > 22 || (major == MIN_NODE.0 && minor >= MIN_NODE.1);
    if ok {
        return Ok(());
    }
    Err(format!(
        "node {version} is too old for the harness, which needs ^{}.{}.0 or >=24 \
         (below that, node:zlib has no createZstdDecompress and plugin loading dies \
         with an unrelated-looking module error).\n\
         The PATH this app inherits decides which node is used. From a checkout:\n\
         source .scratch/deepseek-fui-desktop/env.sh\n\
         Or point {NODE_BIN_OVERRIDE} at a directory holding a new enough node.",
        MIN_NODE.0, MIN_NODE.1,
    ))
}

/// Repository root, resolved from this crate's location.
fn repository_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf()
}

/// Spawn the backend and block until it announces its URL.
///
/// Returns the URL, or a message fit to show a user: this runs before there is
/// any window worth calling a UI, so a failure here has to explain itself.
fn start_backend(backend: &Backend) -> Result<String, String> {
    check_node_version()?;
    reap_previous_backend();

    let root = repository_root();
    let mut command = Command::new("pnpm");
    if let Some(path) = backend_path() {
        command.env("PATH", path);
    }
    let mut child = command
        .args(["dsh", "--profile", "fui", "--port", "0"])
        .current_dir(&root)
        // Own process group, so reap() can signal the whole `pnpm -> pnpm ->
        // tsx` chain at once and so a Ctrl-C in a terminal parent does not
        // race us to the child.
        .process_group_compat()
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("could not start the harness ({e}). Is pnpm on PATH?"))?;

    let _ = std::fs::write(pid_file(), child.id().to_string());
    BACKEND_GROUP.store(child.id() as i32, Ordering::SeqCst);

    let stdout = child.stdout.take().ok_or("the harness produced no stdout")?;
    let stderr = child.stderr.take().ok_or("the harness produced no stderr")?;
    *backend.0.lock().unwrap() = Some(child);

    // Drain stderr, keeping a bounded tail. Draining is not optional: a piped
    // stream nobody reads fills its buffer and blocks the writer. Keeping the
    // tail is what makes a boot failure diagnosable — without it the only
    // symptom is that no URL ever arrived.
    let diagnostics: Arc<Mutex<VecDeque<String>>> = Arc::new(Mutex::new(VecDeque::new()));
    let sink = Arc::clone(&diagnostics);
    std::thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            let mut held = sink.lock().unwrap();
            if held.len() == DIAGNOSTIC_LINES {
                held.pop_front();
            }
            held.push_back(line);
        }
    });

    // The URL line is the harness's readiness signal: the web bundle prints it
    // only after its Loader tree settles, so a sibling row that failed to mount
    // cannot announce a dead app.
    let (tx, rx) = std::sync::mpsc::channel::<Result<String, String>>();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if let Some(rest) = line.split_once("dsh web: ") {
                // The line may carry a trailing LAN address; the loopback URL
                // is the first whitespace-delimited token after the marker.
                let url = rest.1.split_whitespace().next().unwrap_or_default().to_string();
                let _ = tx.send(Ok(url));
                return;
            }
        }
        // Ran out of output without a URL: the process died during boot.
        let _ = tx.send(Err("the harness exited before it was ready".into()));
    });

    let outcome = match rx.recv_timeout(READY_TIMEOUT) {
        Ok(Ok(url)) => return Ok(url),
        Ok(Err(message)) => message,
        Err(_) => format!("the harness did not become ready within {}s", READY_TIMEOUT.as_secs()),
    };
    // Give the stderr drain a moment to catch the tail of a fast crash.
    std::thread::sleep(Duration::from_millis(200));
    let tail = diagnostics.lock().unwrap().iter().cloned().collect::<Vec<_>>();
    Err(if tail.is_empty() {
        outcome
    } else {
        format!("{outcome}\n\nLast output from the harness:\n{}", tail.join("\n"))
    })
}

/// How many trailing stderr lines to keep for a failure report.
const DIAGNOSTIC_LINES: usize = 40;

/// `process_group(0)` where the platform has it, a no-op elsewhere.
trait ProcessGroupCompat {
    fn process_group_compat(&mut self) -> &mut Command;
}

impl ProcessGroupCompat for Command {
    #[cfg(unix)]
    fn process_group_compat(&mut self) -> &mut Command {
        self.process_group(0)
    }

    #[cfg(not(unix))]
    fn process_group_compat(&mut self) -> &mut Command {
        self
    }
}

/// Reap the backend when this process is asked to terminate.
///
/// Tauri installs no handler for these, so a SIGTERM — from a supervisor, a
/// `killall`, or a logout — would otherwise tear the app down without running
/// any exit path and strand the backend. SIGKILL still cannot be caught; that
/// case is covered by reaping at the next startup.
#[cfg(unix)]
extern "C" fn on_terminating_signal(signal: i32) {
    let group = BACKEND_GROUP.load(Ordering::SeqCst);
    if group != 0 {
        unsafe { libc::killpg(group, libc::SIGKILL) };
    }
    // Restore default disposition and re-raise, so the exit status is honest.
    unsafe {
        libc::signal(signal, libc::SIG_DFL);
        libc::raise(signal);
    }
}

/// Install the terminating-signal handlers.
#[cfg(unix)]
fn install_signal_handlers() {
    unsafe {
        libc::signal(libc::SIGTERM, on_terminating_signal as *const () as libc::sighandler_t);
        libc::signal(libc::SIGINT, on_terminating_signal as *const () as libc::sighandler_t);
        libc::signal(libc::SIGHUP, on_terminating_signal as *const () as libc::sighandler_t);
    }
}

#[cfg(not(unix))]
fn install_signal_handlers() {}

/// Bring the main window forward, restoring it if it was minimised or hidden.
fn focus_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Build the application menu.
///
/// Only the window and edit roles are populated. Everything the harness itself
/// owns — sessions, settings, the model picker — stays in the web surface,
/// because duplicating it into a native menu would give two controls for one
/// piece of state and no way to keep them agreeing.
fn build_menu(app: &tauri::AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let edit = Submenu::with_items(app, "Edit", true, &[
        &PredefinedMenuItem::undo(app, None)?,
        &PredefinedMenuItem::redo(app, None)?,
        &PredefinedMenuItem::separator(app)?,
        &PredefinedMenuItem::cut(app, None)?,
        &PredefinedMenuItem::copy(app, None)?,
        &PredefinedMenuItem::paste(app, None)?,
        &PredefinedMenuItem::select_all(app, None)?,
    ])?;
    let window = Submenu::with_items(app, "Window", true, &[
        &PredefinedMenuItem::minimize(app, None)?,
        &PredefinedMenuItem::fullscreen(app, None)?,
        &PredefinedMenuItem::separator(app)?,
        &PredefinedMenuItem::close_window(app, None)?,
    ])?;
    Menu::with_items(app, &[&edit, &window])
}

/// Seat the tray icon: a way back to the window after it is closed.
fn build_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show DeepSeek FUI", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &PredefinedMenuItem::separator(app)?, &quit])?;
    TrayIconBuilder::new()
        .icon(app.default_window_icon().cloned().ok_or(tauri::Error::UnknownPath)?)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => focus_main_window(app),
            // Reaping rides the Exit run event, so quitting here is enough.
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;
    Ok(())
}

fn main() {
    install_signal_handlers();
    tauri::Builder::default()
        // A second launch must not start a second backend; it hands focus to
        // the running window instead.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            focus_main_window(app);
        }))
        // Window geometry survives restarts. Registered after single-instance,
        // which the plugin's own guidance asks for.
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(Backend(Mutex::new(None)))
        .setup(|app| {
            let backend = app.state::<Backend>();
            let url = match start_backend(&backend) {
                Ok(url) => url,
                Err(message) => {
                    // Returning Err here makes Tauri panic inside a callback
                    // that cannot unwind, so the operator gets an abort and a
                    // Rust backtrace instead of the reason. Report and leave.
                    eprintln!("deepseek-fui: {message}");
                    app.state::<Backend>().reap();
                    std::process::exit(1);
                }
            };
            let window = app.get_webview_window("main").ok_or("main window missing")?;
            window.navigate(url.parse()?)?;
            app.set_menu(build_menu(app.handle())?)?;
            build_tray(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::CloseRequested { .. }) {
                window.app_handle().state::<Backend>().reap();
            }
        })
        .build(tauri::generate_context!())
        .expect("error building the FUI desktop shell")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                app.state::<Backend>().reap();
                let _ = std::fs::remove_file(pid_file());
            }
        });
}
