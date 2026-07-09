//! Foreground coding-app detection — editors, terminals, AI dev tools.
//! macOS: timed osascript JXA (same strategy as v7 `electron/now-coding.js`).

use crate::error::{AppError, AppResult};
use serde::Serialize;
use std::io::Read;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

const TIMEOUT: Duration = Duration::from_millis(2800);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodingSession {
    pub app_id: String,
    pub app_name: String,
    pub process_name: String,
    pub window_title: String,
    pub status: String,
    pub file_name: Option<String>,
    pub project_name: Option<String>,
    pub live_line: Option<String>,
}

struct CodingApp {
    id: &'static str,
    name: &'static str,
    processes: &'static [&'static str],
    bundles: &'static [&'static str],
}

const CODING_APPS: &[CodingApp] = &[
    CodingApp {
        id: "cursor",
        name: "Cursor",
        processes: &["cursor"],
        bundles: &["com.todesktop.230313mzl4w4u92"],
    },
    CodingApp {
        id: "vscode",
        name: "VS Code",
        processes: &[
            "code",
            "code - insiders",
            "code - oss",
            "visual studio code",
        ],
        bundles: &[
            "com.microsoft.vscode",
            "com.microsoft.vscodeinsiders",
            "com.microsoft.VSCode",
        ],
    },
    CodingApp {
        id: "vscodium",
        name: "VSCodium",
        processes: &["vscodium"],
        bundles: &["com.vscodium", "com.visualstudio.code.oss"],
    },
    CodingApp {
        id: "windsurf",
        name: "Windsurf",
        processes: &["windsurf"],
        bundles: &["com.exafunction.windsurf"],
    },
    CodingApp {
        id: "zed",
        name: "Zed",
        processes: &["zed"],
        bundles: &["dev.zed.zed"],
    },
    CodingApp {
        id: "sublime",
        name: "Sublime Text",
        processes: &["sublime text", "sublime_text", "subl"],
        bundles: &["com.sublimetext.4", "com.sublimetext.3"],
    },
    CodingApp {
        id: "idea",
        name: "IntelliJ IDEA",
        processes: &["idea", "idea64", "intellij idea"],
        bundles: &["com.jetbrains.intellij"],
    },
    CodingApp {
        id: "pycharm",
        name: "PyCharm",
        processes: &["pycharm", "pycharm64"],
        bundles: &["com.jetbrains.pycharm"],
    },
    CodingApp {
        id: "webstorm",
        name: "WebStorm",
        processes: &["webstorm", "webstorm64"],
        bundles: &["com.jetbrains.webstorm"],
    },
    CodingApp {
        id: "androidstudio",
        name: "Android Studio",
        processes: &["studio", "studio64", "android studio"],
        bundles: &["com.google.android.studio"],
    },
    CodingApp {
        id: "xcode",
        name: "Xcode",
        processes: &["xcode"],
        bundles: &["com.apple.dt.xcode"],
    },
    CodingApp {
        id: "nvim",
        name: "Neovim",
        processes: &["nvim", "neovide"],
        bundles: &[],
    },
    CodingApp {
        id: "vim",
        name: "Vim",
        processes: &["vim", "gvim"],
        bundles: &[],
    },
    CodingApp {
        id: "emacs",
        name: "Emacs",
        processes: &["emacs"],
        bundles: &[],
    },
    CodingApp {
        id: "opencode",
        name: "OpenCode",
        processes: &["opencode"],
        bundles: &[],
    },
    CodingApp {
        id: "openclaw",
        name: "OpenClaw",
        processes: &["openclaw"],
        bundles: &[],
    },
    CodingApp {
        id: "ollama",
        name: "Ollama",
        processes: &["ollama"],
        bundles: &["com.electron.ollama", "ai.ollama.ollama"],
    },
    CodingApp {
        id: "chatgpt",
        name: "ChatGPT",
        processes: &["chatgpt"],
        bundles: &["com.openai.chat"],
    },
    CodingApp {
        id: "claude",
        name: "Claude",
        processes: &["claude"],
        bundles: &["com.anthropic.claude", "com.anthropic.claudefordesktop"],
    },
    CodingApp {
        id: "copilot",
        name: "GitHub Copilot",
        processes: &["github copilot", "copilot"],
        bundles: &[],
    },
    CodingApp {
        id: "trae",
        name: "Trae",
        processes: &["trae"],
        bundles: &[],
    },
    CodingApp {
        id: "fleet",
        name: "Fleet",
        processes: &["fleet"],
        bundles: &["com.jetbrains.fleet"],
    },
    CodingApp {
        id: "terminal",
        name: "Terminal",
        processes: &[
            "terminal",
            "iterm2",
            "warp",
            "alacritty",
            "kitty",
            "wezterm",
        ],
        bundles: &[
            "com.apple.terminal",
            "com.googlecode.iterm2",
            "dev.warp.Warp-Stable",
        ],
    },
];

#[cfg(target_os = "macos")]
const FOREGROUND_JXA: &str = r#"
function run() {
  try {
    var se = Application('System Events');
    var name = '';
    var bundleId = '';
    var windowTitle = '';
    try {
      var front = se.applicationProcesses.whose({ frontmost: true });
      if (front && front.length) {
        var p = front[0];
        name = String(p.name());
        try { bundleId = String(p.bundleIdentifier()); } catch (e) {}
        try {
          var wins = p.windows();
          if (wins && wins.length) windowTitle = String(wins[0].name());
        } catch (e) {}
      }
    } catch (e) {}
    var ignored = /^(smiley|electron|discord|finder|loginwindow|windowserver)$/i;
    if (!name || ignored.test(name)) {
      var codingNames = [
        'Cursor', 'Code', 'Code - Insiders', 'Code - OSS', 'VSCodium', 'Windsurf',
        'Zed', 'Sublime Text', 'IntelliJ IDEA', 'PyCharm', 'WebStorm',
        'Android Studio', 'Xcode', 'Claude', 'ChatGPT', 'Ollama', 'Trae', 'Fleet',
        'iTerm2', 'Terminal', 'Warp', 'Alacritty', 'kitty', 'WezTerm'
      ];
      for (var i = 0; i < codingNames.length; i++) {
        try {
          var apps = se.applicationProcesses.whose({ name: codingNames[i] });
          if (!apps || !apps.length) continue;
          var app = apps[0];
          name = String(app.name());
          try { bundleId = String(app.bundleIdentifier()); } catch (e2) {}
          try {
            var awins = app.windows();
            if (awins && awins.length) windowTitle = String(awins[0].name());
          } catch (e3) {}
          break;
        } catch (e4) {}
      }
    }
    if (!name) return '';
    return JSON.stringify({ processName: name, bundleId: bundleId, windowTitle: windowTitle });
  } catch (e) {
    return '';
  }
}
"#;

#[derive(Debug)]
struct RawForeground {
    process_name: String,
    bundle_id: String,
    window_title: String,
}

fn humanize(v: &str) -> String {
    v.trim()
        .replace(".exe", "")
        .replace(".app", "")
        .replace(['_', '-'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn match_coding_app(raw: &RawForeground) -> Option<(&'static CodingApp, String)> {
    let process_name = humanize(&raw.process_name);
    if process_name.is_empty() || process_name.to_ascii_lowercase().contains("smiley") {
        return None;
    }
    let key = process_name.to_ascii_lowercase();
    if (key.contains("helper") || key.contains("crashpad") || key.contains("gpu") || key.contains("renderer"))
        && key != "cursor"
    {
        return None;
    }
    let bundle_id = raw.bundle_id.to_ascii_lowercase();
    for app in CODING_APPS {
        let proc_match = app.processes.iter().any(|p| {
            let needle = p.to_ascii_lowercase();
            key == needle || key.starts_with(&format!("{needle} ")) || key.contains(&needle)
        });
        let bundle_match = !bundle_id.is_empty()
            && app.bundles.iter().any(|b| {
                let needle = b.to_ascii_lowercase();
                bundle_id == needle || bundle_id.starts_with(&format!("{needle}."))
            });
        if proc_match || bundle_match {
            return Some((app, process_name));
        }
    }
    None
}

struct ParsedContext {
    status: &'static str,
    file_name: Option<String>,
    project_name: Option<String>,
    label: Option<String>,
}

fn is_ide_suffix(s: &str) -> bool {
    let lower = s.to_ascii_lowercase();
    [
        "visual studio code",
        "cursor",
        "windsurf",
        "vscodium",
        "vs code",
        "intellij idea",
        "pycharm",
        "webstorm",
        "android studio",
        "xcode",
        "zed",
        "sublime text",
    ]
    .iter()
    .any(|suffix| lower.ends_with(suffix))
}

fn is_idle_title(s: &str) -> bool {
    let lower = s.to_ascii_lowercase();
    lower.starts_with("welcome")
        || lower.starts_with("get started")
        || lower.starts_with("settings")
        || lower.starts_with("extension")
        || lower.starts_with("keyboard shortcuts")
        || lower.starts_with("release notes")
        || lower.starts_with("walkthrough")
}

fn looks_like_file(s: &str) -> bool {
    if let Some(dot) = s.rfind('.') {
        let ext = &s[dot + 1..];
        !ext.is_empty() && ext.len() <= 8 && ext.chars().all(|c| c.is_ascii_alphanumeric())
    } else {
        false
    }
}

fn split_title_parts(title: &str) -> Vec<String> {
    let mut parts = Vec::new();
    let mut current = String::new();
    let chars: Vec<char> = title.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if i + 2 < chars.len() {
            let triple = format!("{}{}{}", chars[i], chars[i + 1], chars[i + 2]);
            if triple == " — " || triple == " – " || triple == " - " {
                if !current.trim().is_empty() {
                    parts.push(current.trim().to_string());
                }
                current.clear();
                i += 3;
                continue;
            }
        }
        if chars[i] == '|' || chars[i] == '—' || chars[i] == '–' {
            if !current.trim().is_empty() {
                parts.push(current.trim().to_string());
            }
            current.clear();
            i += 1;
            continue;
        }
        current.push(chars[i]);
        i += 1;
    }
    if !current.trim().is_empty() {
        parts.push(current.trim().to_string());
    }
    parts
}

fn parse_coding_context(window_title: &str, app_name: &str) -> ParsedContext {
    let title = window_title.trim();
    if title.is_empty() || title.eq_ignore_ascii_case(app_name) {
        return ParsedContext {
            status: "idle",
            file_name: None,
            project_name: None,
            label: None,
        };
    }

    let parts = split_title_parts(title);
    if parts.len() >= 3 {
        let left = &parts[0];
        let middle = &parts[1];
        let right = &parts[2];
        if is_ide_suffix(right) {
            if is_idle_title(left) {
                return ParsedContext {
                    status: "idle",
                    file_name: None,
                    project_name: Some(middle.clone()),
                    label: None,
                };
            }
            return ParsedContext {
                status: "editing",
                file_name: Some(left.clone()),
                project_name: Some(middle.clone()),
                label: None,
            };
        }
        if looks_like_file(middle) {
            return ParsedContext {
                status: "editing",
                file_name: Some(middle.clone()),
                project_name: Some(left.clone()),
                label: None,
            };
        }
        if looks_like_file(left) {
            return ParsedContext {
                status: "editing",
                file_name: Some(left.clone()),
                project_name: Some(middle.clone()),
                label: None,
            };
        }
        return ParsedContext {
            status: "working",
            file_name: None,
            project_name: None,
            label: Some(left.clone()),
        };
    }

    if parts.len() == 2 {
        let left = &parts[0];
        let right = &parts[1];
        if is_ide_suffix(right) {
            if is_idle_title(left) {
                return ParsedContext {
                    status: "idle",
                    file_name: None,
                    project_name: None,
                    label: None,
                };
            }
            if looks_like_file(left) {
                return ParsedContext {
                    status: "editing",
                    file_name: Some(left.clone()),
                    project_name: None,
                    label: None,
                };
            }
            return ParsedContext {
                status: "working",
                file_name: None,
                project_name: Some(left.clone()),
                label: Some(left.clone()),
            };
        }
        if looks_like_file(left) {
            return ParsedContext {
                status: "editing",
                file_name: Some(left.clone()),
                project_name: Some(right.clone()),
                label: None,
            };
        }
        if looks_like_file(right) {
            return ParsedContext {
                status: "editing",
                file_name: Some(right.clone()),
                project_name: Some(left.clone()),
                label: None,
            };
        }
        return ParsedContext {
            status: "working",
            file_name: None,
            project_name: Some(left.clone()),
            label: Some(left.clone()),
        };
    }

    if looks_like_file(title) {
        return ParsedContext {
            status: "editing",
            file_name: Some(title.to_string()),
            project_name: None,
            label: None,
        };
    }

    let app_lower = app_name.to_ascii_lowercase();
    if app_lower.contains("chatgpt")
        || app_lower.contains("claude")
        || app_lower.contains("copilot")
        || app_lower.contains("ollama")
        || app_lower.contains("openclaw")
        || app_lower.contains("opencode")
    {
        return ParsedContext {
            status: "working",
            file_name: None,
            project_name: None,
            label: Some(title.to_string()),
        };
    }

    if is_idle_title(title) {
        return ParsedContext {
            status: "idle",
            file_name: None,
            project_name: None,
            label: None,
        };
    }

    ParsedContext {
        status: "working",
        file_name: None,
        project_name: None,
        label: Some(title.to_string()),
    }
}

fn build_live_line(ctx: &ParsedContext) -> Option<String> {
    if ctx.status == "editing" {
        if let Some(ref file) = ctx.file_name {
            let mut parts = vec![format!("Editing {file}")];
            if let Some(ref project) = ctx.project_name {
                parts.push(project.clone());
            }
            return Some(parts.join(" · "));
        }
    }
    if ctx.status == "idle" {
        return Some(
            ctx.project_name
                .as_ref()
                .map(|p| format!("Idle · {p}"))
                .unwrap_or_else(|| "Idle".into()),
        );
    }
    ctx.label.clone()
}

fn normalize_coding(raw: RawForeground) -> Option<CodingSession> {
    let (app, process_name) = match_coding_app(&raw)?;
    let window_title = raw.window_title.trim().to_string();
    let ctx = parse_coding_context(&window_title, app.name);
    let live_line = build_live_line(&ctx);
    Some(CodingSession {
        app_id: app.id.into(),
        app_name: app.name.into(),
        process_name,
        window_title,
        status: ctx.status.into(),
        file_name: ctx.file_name,
        project_name: ctx.project_name,
        live_line,
    })
}

pub fn session_signature(session: &CodingSession) -> String {
    format!(
        "{}\0{}\0{}\0{}\0{}\0{}\0{}",
        session.app_id,
        session.app_name,
        session.status,
        session.file_name.as_deref().unwrap_or(""),
        session.project_name.as_deref().unwrap_or(""),
        session.live_line.as_deref().unwrap_or(""),
        session.window_title,
    )
}

pub fn probe_foreground_coding() -> AppResult<Option<CodingSession>> {
    #[cfg(target_os = "macos")]
    {
        return probe_macos();
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = ();
        Ok(None)
    }
}

#[cfg(target_os = "macos")]
fn probe_macos() -> AppResult<Option<CodingSession>> {
    let mut child = Command::new("osascript")
        .args(["-l", "JavaScript", "-e", FOREGROUND_JXA])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| AppError::Msg(format!("osascript: {e}")))?;

    let started = Instant::now();
    while started.elapsed() < TIMEOUT {
        match child.try_wait() {
            Ok(Some(status)) if status.success() => break,
            Ok(Some(_)) => return Ok(None),
            Ok(None) => std::thread::sleep(Duration::from_millis(40)),
            Err(_) => {
                let _ = child.kill();
                return Ok(None);
            }
        }
    }
    if child.try_wait().ok().flatten().is_none() {
        let _ = child.kill();
        let _ = child.wait();
        return Err(AppError::Msg("coding probe timed out".into()));
    }

    let mut out = String::new();
    if let Some(mut stdout) = child.stdout.take() {
        let _ = stdout.read_to_string(&mut out);
    }
    let _ = child.wait();
    let line = out.trim();
    if line.is_empty() {
        return Ok(None);
    }
    let raw: serde_json::Value = serde_json::from_str(line).map_err(|e| AppError::Msg(e.to_string()))?;
    let raw = RawForeground {
        process_name: raw
            .get("processName")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .into(),
        bundle_id: raw
            .get("bundleId")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .into(),
        window_title: raw
            .get("windowTitle")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .into(),
    };
    Ok(normalize_coding(raw))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_cursor_file_title() {
        let ctx = parse_coding_context("app.rs — Project Smiley — Cursor", "Cursor");
        assert_eq!(ctx.status, "editing");
        assert_eq!(ctx.file_name.as_deref(), Some("app.rs"));
        assert_eq!(ctx.project_name.as_deref(), Some("Project Smiley"));
        let line = build_live_line(&ctx).unwrap();
        assert!(line.contains("Editing app.rs"));
    }

    #[test]
    fn idle_welcome_screen() {
        let ctx = parse_coding_context("Welcome — Cursor", "Cursor");
        assert_eq!(ctx.status, "idle");
        assert_eq!(build_live_line(&ctx).as_deref(), Some("Idle"));
    }

    #[test]
    fn matches_vscode_bundle() {
        let raw = RawForeground {
            process_name: "Code".into(),
            bundle_id: "com.microsoft.VSCode".into(),
            window_title: "main.ts — smiley".into(),
        };
        let session = normalize_coding(raw).expect("vscode");
        assert_eq!(session.app_id, "vscode");
        assert_eq!(session.status, "editing");
    }
}
