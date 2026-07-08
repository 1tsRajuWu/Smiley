function run() {
  try {
    var se = Application('System Events');
    var proc = se.processes.byAttribute('frontmost', true);
    if (!proc || !proc.length) return '';
    var p = proc[0];
    var name = String(p.name());
    var bundleId = '';
    try { bundleId = String(p.bundleIdentifier()); } catch (e) {}
    var windowTitle = '';
    try {
      var wins = p.windows();
      if (wins && wins.length) windowTitle = String(wins[0].name());
    } catch (e) {}
    return JSON.stringify({ processName: name, bundleId: bundleId, windowTitle: windowTitle });
  } catch (e) {
    return '';
  }
}
