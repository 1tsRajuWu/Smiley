using System.Diagnostics;
using System.Reflection;
using System.Text.Json;

namespace Smiley.Native.Services;

public static class VersionCheckService
{
    private const string ReleasesApi = "https://api.github.com/repos/1tsRaj/smiley-rpc/releases/latest";
    private const string ReleasesPage = "https://github.com/1tsRaj/smiley-rpc/releases/latest";

    public static string CurrentVersion =>
        Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "0.0.0";

    public static async Task<(bool UpdateAvailable, string? LatestVersion, string? Url)> CheckAsync()
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(8) };
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Smiley-Native/2.0");

            var json = await client.GetStringAsync(ReleasesApi);
            using var doc = JsonDocument.Parse(json);
            var tag = doc.RootElement.GetProperty("tag_name").GetString()?.TrimStart('v') ?? "";
            var url = doc.RootElement.GetProperty("html_url").GetString() ?? ReleasesPage;

            if (Version.TryParse(tag, out var latest) &&
                Version.TryParse(CurrentVersion, out var current) &&
                latest > current)
            {
                return (true, tag, url);
            }

            return (false, tag, url);
        }
        catch
        {
            return (false, null, null);
        }
    }

    public static async Task NotifyIfOutdatedAsync()
    {
        var (available, latest, url) = await CheckAsync();
        if (!available || string.IsNullOrEmpty(url)) return;

        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    }
}
