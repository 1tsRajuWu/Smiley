using System.Text.Json.Serialization;

namespace Smiley.Native.Models;

public sealed class ActivityCategory
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("label")]
    public string Label { get; set; } = "";

    [JsonPropertyName("emoji")]
    public string Emoji { get; set; } = "";

    [JsonPropertyName("color")]
    public string Color { get; set; } = "#7aa2f7";

    [JsonPropertyName("waifuTag")]
    public string WaifuTag { get; set; } = "";

    [JsonPropertyName("fallbackGif")]
    public string FallbackGif { get; set; } = "";

    [JsonPropertyName("activities")]
    public List<ActivityItem> Activities { get; set; } = [];
}

public sealed class ActivityItem
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("details")]
    public string Details { get; set; } = "";

    [JsonPropertyName("state")]
    public string State { get; set; } = "";

    [JsonPropertyName("emoji")]
    public string Emoji { get; set; } = "";

    public string CategoryId { get; set; } = "";
    public string CategoryColor { get; set; } = "#7aa2f7";
    public string FallbackGif { get; set; } = "";
    public string WaifuTag { get; set; } = "";
}
