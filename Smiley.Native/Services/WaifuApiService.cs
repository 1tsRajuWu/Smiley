using System.Collections.Concurrent;
using System.Net.Http;
using System.Text.Json;

namespace Smiley.Native.Services;

/// <summary>
/// SFW anime image APIs (nekos.best, waifu.pics). User is responsible for usage.
/// </summary>
public sealed class WaifuApiService
{
    private static readonly HttpClient Http = new()
    {
        Timeout = TimeSpan.FromSeconds(6),
        DefaultRequestHeaders = { { "User-Agent", "Smiley-Native/2.1.10" } },
    };

    private static readonly ConcurrentDictionary<string, string> SessionCache = new();

    private static readonly Dictionary<string, string> NekosEndpoints = new()
    {
        ["food"] = "nom",
        ["gaming"] = "yeet",
        ["chill"] = "sleep",
        ["work"] = "bored",
        ["social"] = "wave",
    };

    private static readonly Dictionary<string, string> ActivityEndpoints = new()
    {
        ["eating-pizza"] = "feed",
        ["eating-sushi"] = "nom",
        ["eating-ramen"] = "feed",
        ["eating-burger"] = "bite",
        ["eating-tacos"] = "nom",
        ["eating-snacks"] = "nom",
        ["cooking"] = "feed",
        ["eating-dessert"] = "bite",
        ["gaming"] = "yeet",
        ["ranked"] = "yeet",
        ["coop"] = "hug",
        ["retro"] = "dance",
        ["speedrun"] = "yeet",
        ["vr-gaming"] = "dance",
        ["sleeping"] = "sleep",
        ["napping"] = "sleep",
        ["reading"] = "smile",
        ["listening"] = "dance",
        ["meditating"] = "smile",
        ["bath"] = "happy",
        ["coding"] = "bored",
        ["studying"] = "bored",
        ["meeting"] = "wave",
        ["focus"] = "bored",
        ["designing"] = "smile",
        ["writing"] = "bored",
        ["streaming"] = "wave",
        ["watching"] = "happy",
        ["traveling"] = "wave",
        ["gym"] = "yeet",
        ["partying"] = "dance",
        ["shopping"] = "happy",
    };

    public static readonly Dictionary<string, string> VerifiedFallbacks = new()
    {
        ["food"] = "https://nekos.best/api/v2/nom/eaa199e9-2b86-4b15-87d1-53688e36d8ec.gif",
        ["gaming"] = "https://nekos.best/api/v2/yeet/ae4dda45-2175-4576-b957-58dcc1362284.gif",
        ["chill"] = "https://nekos.best/api/v2/sleep/611a318f-1645-48f4-9cc0-099eb8d817d9.gif",
        ["work"] = "https://nekos.best/api/v2/bored/82f8fec0-d651-4905-a739-5917d728f89f.gif",
        ["social"] = "https://nekos.best/api/v2/wave/e6f276a8-11f1-4ad0-b1e0-3fa91678e2f4.gif",
        ["eating-pizza"] = "https://nekos.best/api/v2/feed/b9abbae0-3b59-437e-b866-3402c2c7f22e.gif",
        ["eating-burger"] = "https://nekos.best/api/v2/bite/5ff15901-a4fb-4d2f-bf61-97ad62d1e53e.gif",
        ["coding"] = "https://nekos.best/api/v2/bored/82f8fec0-d651-4905-a739-5917d728f89f.gif",
        ["sleeping"] = "https://nekos.best/api/v2/sleep/611a318f-1645-48f4-9cc0-099eb8d817d9.gif",
    };

    public async Task<string?> FetchNekosAsync(string endpoint, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(endpoint)) return null;
        try
        {
            using var response = await Http.GetAsync($"https://nekos.best/api/v2/{endpoint}", ct);
            if (!response.IsSuccessStatusCode) return null;
            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            if (doc.RootElement.TryGetProperty("results", out var results) &&
                results.GetArrayLength() > 0 &&
                results[0].TryGetProperty("url", out var url))
            {
                var s = url.GetString();
                return IsValidDiscordImageUrl(s) ? s : null;
            }
        }
        catch { /* fallback below */ }
        return null;
    }

    public async Task<string?> FetchWaifuAsync(string tag, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(tag)) return null;
        try
        {
            using var response = await Http.GetAsync($"https://api.waifu.pics/sfw/{tag}", ct);
            if (!response.IsSuccessStatusCode) return null;
            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            if (doc.RootElement.TryGetProperty("url", out var url))
            {
                var s = url.GetString();
                return IsValidDiscordImageUrl(s) ? s : null;
            }
        }
        catch { /* fallback below */ }
        return null;
    }

    public async Task<string> ResolveImageAsync(string categoryId, string? activityId, string? waifuTag, CancellationToken ct = default)
    {
        var cacheKey = activityId ?? categoryId;
        if (SessionCache.TryGetValue(cacheKey, out var cached))
            return cached;

        var endpoint = activityId != null && ActivityEndpoints.TryGetValue(activityId, out var ae)
            ? ae
            : NekosEndpoints.GetValueOrDefault(categoryId, "neko");

        var nekos = await FetchNekosAsync(endpoint, ct);
        if (nekos != null)
        {
            SessionCache[cacheKey] = nekos;
            return nekos;
        }

        if (!string.IsNullOrWhiteSpace(waifuTag))
        {
            var waifu = await FetchWaifuAsync(waifuTag, ct);
            if (waifu != null)
            {
                SessionCache[cacheKey] = waifu;
                return waifu;
            }
        }

        var fallback = activityId != null && VerifiedFallbacks.TryGetValue(activityId, out var byActivity)
            ? byActivity
            : VerifiedFallbacks.GetValueOrDefault(categoryId, VerifiedFallbacks["food"]);

        SessionCache[cacheKey] = fallback;
        return fallback;
    }

    public static string ResolveDiscordImage(string? gifUrl, string categoryId, string? activityId = null)
    {
        if (IsValidDiscordImageUrl(gifUrl)) return gifUrl!;
        if (activityId != null && VerifiedFallbacks.TryGetValue(activityId, out var byActivity))
            return byActivity;
        if (VerifiedFallbacks.TryGetValue(categoryId, out var byCat))
            return byCat;
        return VerifiedFallbacks["food"];
    }

    private static bool IsValidDiscordImageUrl(string? url) =>
        !string.IsNullOrWhiteSpace(url) &&
        url.StartsWith("https://", StringComparison.OrdinalIgnoreCase) &&
        !url.StartsWith("data:", StringComparison.OrdinalIgnoreCase);
}
