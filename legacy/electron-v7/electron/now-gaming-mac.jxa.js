function run() {
  try {
    var se = Application('System Events');
    var name = '';
    var bundleId = '';
    var windowTitle = '';

    // Prefer frontmost app. `byAttribute('frontmost', true)` is unreliable on recent macOS
    // and often returns empty / throws — use `whose({frontmost: true})` instead.
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

    // If Smiley/Electron/Discord is frontmost, fall back to a running coding editor.
    // Users usually keep Smiley open while testing — without this, coding sync never sees Cursor.
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
