using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Timers;
using Avalonia.Media.Imaging;
using Avalonia.Threading;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Smiley.Native.Models;
using Smiley.Native.Services;

namespace Smiley.Native.ViewModels;

public partial class MainWindowViewModel : ViewModelBase, IDisposable
{
    private readonly DiscordRpcService _rpc;
    private readonly WaifuApiService _waifu = new();
    private readonly AppSettings _settings;
    private readonly System.Timers.Timer _sessionTimer;
    private CancellationTokenSource? _gifCts;
    private DateTime _sessionStart = DateTime.MinValue;

    [ObservableProperty] private string _connectionStatus = "Connecting…";
    [ObservableProperty] private bool _isConnected;
    [ObservableProperty] private string _previewDetails = "Pick an activity";
    [ObservableProperty] private string _previewState = "Your status appears here";
    [ObservableProperty] private string _previewEmoji = "😊";
    [ObservableProperty] private string _sessionTimerText = "0:00";
    [ObservableProperty] private string _characterLabel = "Pick an activity to see your character!";
    [ObservableProperty] private string _gifSource = "";
    [ObservableProperty] private bool _isLoadingGif;
    [ObservableProperty] private Bitmap? _previewBitmap;
    [ObservableProperty] private string _searchQuery = "";
    [ObservableProperty] private ActivityCategory? _selectedCategory;
    [ObservableProperty] private ActivityItem? _selectedActivity;
    [ObservableProperty] private bool _animationsEnabled = true;
    [ObservableProperty] private bool _minimizeToTray = true;
    [ObservableProperty] private bool _startWithLogin;

    public ObservableCollection<ActivityCategory> Categories { get; } = [];
    public ObservableCollection<ActivityItem> VisibleActivities { get; } = [];

    public MainWindowViewModel()
    {
        _settings = SettingsService.Load();
        AnimationsEnabled = _settings.AnimationsEnabled;
        MinimizeToTray = _settings.MinimizeToTray;
        StartWithLogin = _settings.StartWithLogin;

        foreach (var cat in ActivityCatalog.Categories)
            Categories.Add(cat);

        SelectedCategory = Categories.FirstOrDefault();
        RefreshVisibleActivities();

        _rpc = new DiscordRpcService(_settings.DiscordClientId);
        _rpc.ConnectionChanged += OnConnectionChanged;

        _sessionTimer = new System.Timers.Timer(1000);
        _sessionTimer.Elapsed += (_, _) => UpdateSessionTimer();
        _sessionTimer.Start();

        _ = InitializeAsync();
    }

    private async Task InitializeAsync()
    {
        await Task.Delay(300);
        var ok = _rpc.Connect();
        ConnectionStatus = ok ? "Connected to Discord" : (_rpc.LastError ?? "Disconnected");
        IsConnected = ok;

        _ = Task.Run(async () =>
        {
            await Task.Delay(4000);
            await VersionCheckService.NotifyIfOutdatedAsync();
        });
    }

    private void OnConnectionChanged(bool connected, string? error)
    {
        Dispatcher.UIThread.Post(() =>
        {
            IsConnected = connected;
            ConnectionStatus = connected ? "Connected to Discord" : (error ?? "Disconnected");
        });
    }

    partial void OnSelectedCategoryChanged(ActivityCategory? value)
    {
        RefreshVisibleActivities();
    }

    partial void OnSearchQueryChanged(string value)
    {
        RefreshVisibleActivities();
    }

    private void RefreshVisibleActivities()
    {
        VisibleActivities.Clear();
        IEnumerable<ActivityItem> items = ActivityCatalog.AllActivities;

        if (!string.IsNullOrWhiteSpace(SearchQuery))
        {
            var q = SearchQuery.ToLowerInvariant();
            items = items.Where(a =>
                a.Details.ToLowerInvariant().Contains(q) ||
                a.State.ToLowerInvariant().Contains(q) ||
                a.Emoji.Contains(q));
        }
        else if (SelectedCategory != null)
        {
            items = SelectedCategory.Activities.Select(a =>
            {
                a.CategoryId = SelectedCategory.Id;
                a.CategoryColor = SelectedCategory.Color;
                a.FallbackGif = SelectedCategory.FallbackGif;
                a.WaifuTag = SelectedCategory.WaifuTag;
                return a;
            });
        }

        foreach (var item in items)
            VisibleActivities.Add(item);
    }

    [RelayCommand]
    private void SelectCategory(ActivityCategory category)
    {
        SearchQuery = "";
        SelectedCategory = category;
    }

    [RelayCommand]
    private async Task SelectActivityAsync(ActivityItem activity)
    {
        SelectedActivity = activity;
        PreviewDetails = activity.Details;
        PreviewState = activity.State;
        PreviewEmoji = activity.Emoji;
        CharacterLabel = GetCharacterLabel(activity.CategoryId);

        _gifCts?.Cancel();
        _gifCts = new CancellationTokenSource();
        var ct = _gifCts.Token;

        IsLoadingGif = true;
        GifSource = "";

        string? gifUrl = null;
        if (AnimationsEnabled)
        {
            gifUrl = await _waifu.ResolveImageAsync(activity.CategoryId, activity.Id, activity.WaifuTag, ct);
            GifSource = $"nekos.best · {SelectedCategory?.Label ?? activity.CategoryId}";
        }

        if (gifUrl == null)
        {
            gifUrl = WaifuApiService.ResolveDiscordImage(null, activity.CategoryId, activity.Id);
            GifSource = "nekos.best · fallback";
        }

        IsLoadingGif = false;

        var discordImage = WaifuApiService.ResolveDiscordImage(gifUrl, activity.CategoryId, activity.Id);
        var isReselect = _rpc.CurrentActivity?.Id == activity.Id;
        var ok = _rpc.SetActivity(activity, discordImage, !isReselect);

        if (!ok && !string.IsNullOrEmpty(_rpc.LastError))
            ConnectionStatus = _rpc.LastError;

        if (!isReselect)
        {
            _sessionStart = DateTime.UtcNow;
            UpdateSessionTimer();
        }
    }

    [RelayCommand]
    private void ClearPresence()
    {
        _rpc.ClearActivity();
        SelectedActivity = null;
        PreviewDetails = "Pick an activity";
        PreviewState = "Your status appears here";
        PreviewEmoji = "😊";
        CharacterLabel = "Pick an activity to see your character!";
        GifSource = "";
        SessionTimerText = "0:00";
        _sessionStart = DateTime.MinValue;
    }

    [RelayCommand]
    private void SaveSettings()
    {
        _settings.AnimationsEnabled = AnimationsEnabled;
        _settings.MinimizeToTray = MinimizeToTray;
        _settings.StartWithLogin = StartWithLogin;
        SettingsService.Save(_settings);
        SettingsService.SetStartWithLogin(StartWithLogin);
    }

    [RelayCommand]
    private void OpenDonation()
    {
        try
        {
            Process.Start(new ProcessStartInfo("https://paypal.me/1tsRaj") { UseShellExecute = true });
        }
        catch { }
    }

    private void UpdateSessionTimer()
    {
        if (_sessionStart == DateTime.MinValue) return;
        var elapsed = DateTime.UtcNow - _sessionStart;
        var text = elapsed.TotalHours >= 1
            ? $"{(int)elapsed.TotalHours}:{elapsed.Minutes:D2}:{elapsed.Seconds:D2}"
            : $"{elapsed.Minutes}:{elapsed.Seconds:D2}";

        Dispatcher.UIThread.Post(() => SessionTimerText = text);
    }

    private static string GetCharacterLabel(string category) => category switch
    {
        "food" => "Yum! Time to eat! 🍽️",
        "gaming" => "Game on! Let's go! 🎮",
        "chill" => "Relaxing and vibing... 😌",
        "work" => "Focus mode activated 💻",
        "social" => "Having fun with friends! ✨",
        _ => "Activity time!"
    };

    public void Dispose()
    {
        _sessionTimer.Stop();
        _sessionTimer.Dispose();
        _gifCts?.Cancel();
        _gifCts?.Dispose();
        _rpc.Dispose();
    }
}
