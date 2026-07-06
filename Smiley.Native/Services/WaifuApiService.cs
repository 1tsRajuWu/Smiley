using System.Net.Http;
using System.Text.Json;

namespace Smiley.Native.Services;

public sealed class WaifuApiService
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(5) };

    public async Task<string?> FetchImageAsync(string tag, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(tag)) return null;

        try
        {
            using var response = await Http.GetAsync($"https://api.waifu.pics/sfw/{tag}", ct);
            if (!response.IsSuccessStatusCode) return null;

            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            if (doc.RootElement.TryGetProperty("url", out var url))
                return url.GetString();
        }
        catch
        {
            // Fall back to Tenor GIF
        }

        return null;
    }

    public static string ResolveDiscordImage(string? gifUrl, string fallbackGif)
    {
        if (!string.IsNullOrWhiteSpace(gifUrl) &&
            gifUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            return gifUrl;
        return fallbackGif;
    }
}
