using System.Reflection;
using System.Text.Json;
using Smiley.Native.Models;

namespace Smiley.Native.Services;

public static class ActivityCatalog
{
    private static IReadOnlyList<ActivityCategory>? _categories;
    private static IReadOnlyList<ActivityItem>? _all;

    public static IReadOnlyList<ActivityCategory> Categories
    {
        get
        {
            EnsureLoaded();
            return _categories!;
        }
    }

    public static IReadOnlyList<ActivityItem> AllActivities
    {
        get
        {
            EnsureLoaded();
            return _all!;
        }
    }

    private static void EnsureLoaded()
    {
        if (_categories != null) return;

        var assembly = Assembly.GetExecutingAssembly();
        using var stream = assembly.GetManifestResourceStream("Smiley.Native.Activities.json")
            ?? throw new InvalidOperationException("Activities.json not embedded");

        var categories = JsonSerializer.Deserialize<List<ActivityCategory>>(stream) ?? [];
        var flat = new List<ActivityItem>();

        foreach (var cat in categories)
        {
            foreach (var item in cat.Activities)
            {
                item.CategoryId = cat.Id;
                item.CategoryColor = cat.Color;
                item.FallbackGif = cat.FallbackGif;
                item.WaifuTag = cat.WaifuTag;
                flat.Add(item);
            }
        }

        _categories = categories;
        _all = flat;
    }
}
