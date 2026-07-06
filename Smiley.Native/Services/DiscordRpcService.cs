using DiscordRPC;
using Smiley.Native.Models;

namespace Smiley.Native.Services;

public sealed class DiscordRpcService : IDisposable
{
    private const int MinUpdateIntervalMs = 15_000;

    private readonly string _clientId;
    private DiscordRpcClient? _client;
    private DateTime _lastUpdate = DateTime.MinValue;
    private ActivityItem? _pending;
    private string? _pendingImageUrl;
    private DateTime _sessionStart = DateTime.UtcNow;

    public bool IsConnected => _client?.IsInitialized == true;
    public string? LastError { get; private set; }
    public ActivityItem? CurrentActivity { get; private set; }

    public event Action<bool, string?>? ConnectionChanged;

    public DiscordRpcService(string clientId)
    {
        _clientId = clientId;
    }

    public bool Connect()
    {
        try
        {
            _client?.Dispose();
            _client = new DiscordRpcClient(_clientId);

            _client.OnReady += (_, _) =>
            {
                LastError = null;
                ConnectionChanged?.Invoke(true, null);
            };

            _client.OnError += (_, args) =>
            {
                LastError = args.Message;
                ConnectionChanged?.Invoke(false, args.Message);
            };

            if (!_client.Initialize())
            {
                LastError = "Could not connect — is Discord open?";
                ConnectionChanged?.Invoke(false, LastError);
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            LastError = ex.Message;
            ConnectionChanged?.Invoke(false, LastError);
            return false;
        }
    }

    public bool SetActivity(ActivityItem activity, string imageUrl, bool newSession)
    {
        if (_client is not { IsInitialized: true })
        {
            if (!Connect()) return false;
        }

        if (newSession) _sessionStart = DateTime.UtcNow;

        var elapsed = (DateTime.UtcNow - _lastUpdate).TotalMilliseconds;
        if (elapsed < MinUpdateIntervalMs && CurrentActivity != null)
        {
            _pending = activity;
            _pendingImageUrl = imageUrl;
            return true;
        }

        return ApplyPresence(activity, imageUrl);
    }

    private bool ApplyPresence(ActivityItem activity, string imageUrl)
    {
        try
        {
            _client!.SetPresence(new RichPresence
            {
                Details = activity.Details,
                State = activity.State,
                Timestamps = new Timestamps { Start = _sessionStart },
                Assets = new Assets
                {
                    LargeImageKey = imageUrl,
                    LargeImageText = activity.Details
                }
            });

            _lastUpdate = DateTime.UtcNow;
            CurrentActivity = activity;
            _pending = null;

            _ = Task.Run(async () =>
            {
                await Task.Delay(MinUpdateIntervalMs);
                if (_pending != null)
                {
                    var img = _pendingImageUrl ?? _pending.FallbackGif;
                    ApplyPresence(_pending, img);
                }
            });

            return true;
        }
        catch (Exception ex)
        {
            LastError = ex.Message;
            return false;
        }
    }

    public void ClearActivity()
    {
        _client?.ClearPresence();
        CurrentActivity = null;
        _pending = null;
        _sessionStart = DateTime.UtcNow;
    }

    public void Dispose()
    {
        _client?.Dispose();
        _client = null;
    }
}
