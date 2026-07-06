using System.Text.Json;

namespace Smiley.Native.Services;

public sealed class AppSettings
{
    public string DiscordClientId { get; set; } = "1522538045989982279";
    public string DonationUrl { get; set; } = "https://paypal.me/1tsRaj";
    public bool MinimizeToTray { get; set; } = true;
    public bool AnimationsEnabled { get; set; } = true;
    public bool StartWithLogin { get; set; } = false;
}

public static class SettingsService
{
    private static readonly string SettingsPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "Smiley.Native",
        "settings.json");

    public static AppSettings Load()
    {
        try
        {
            if (File.Exists(SettingsPath))
            {
                var json = File.ReadAllText(SettingsPath);
                return JsonSerializer.Deserialize<AppSettings>(json) ?? new AppSettings();
            }
        }
        catch { }

        // Bundled defaults
        try
        {
            var bundled = Path.Combine(AppContext.BaseDirectory, "appsettings.json");
            if (File.Exists(bundled))
            {
                var json = File.ReadAllText(bundled);
                return JsonSerializer.Deserialize<AppSettings>(json) ?? new AppSettings();
            }
        }
        catch { }

        return new AppSettings();
    }

    public static void Save(AppSettings settings)
    {
        var dir = Path.GetDirectoryName(SettingsPath)!;
        Directory.CreateDirectory(dir);
        var json = JsonSerializer.Serialize(settings, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(SettingsPath, json);
    }

    public static void SetStartWithLogin(bool enabled)
    {
        if (!OperatingSystem.IsWindows()) return;

        const string keyName = @"Software\Microsoft\Windows\CurrentVersion\Run";
        const string appName = "Smiley";
        var exePath = Environment.ProcessPath;
        if (string.IsNullOrEmpty(exePath)) return;

        using var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(keyName, true);
        if (key == null) return;

        if (enabled)
            key.SetValue(appName, $"\"{exePath}\"");
        else
            key.DeleteValue(appName, false);
    }
}
