using Avalonia.Controls;
using Smiley.Native.ViewModels;

namespace Smiley.Native.Views;

public partial class MainWindow : Window
{
    private TrayIcon? _trayIcon;
    private MainWindowViewModel? _vm;

    public MainWindow()
    {
        InitializeComponent();
        _vm = new MainWindowViewModel();
        DataContext = _vm;
        SetupTray();
        Closing += OnClosing;
    }

    private void SetupTray()
    {
        var showItem = new NativeMenuItem("Show Smiley");
        showItem.Click += (_, _) => ShowWindow();

        var clearItem = new NativeMenuItem("Clear Presence");
        clearItem.Click += (_, _) => _vm?.ClearPresenceCommand.Execute(null);

        var quitItem = new NativeMenuItem("Quit");
        quitItem.Click += (_, _) => Close();

        _trayIcon = new TrayIcon
        {
            ToolTipText = "Smiley — Discord Rich Presence",
            IsVisible = true,
            Menu = [showItem, clearItem, new NativeMenuItem("-"), quitItem]
        };

        try
        {
            var iconPath = Path.Combine(AppContext.BaseDirectory, "Assets", "icon.png");
            if (File.Exists(iconPath))
                _trayIcon.Icon = new WindowIcon(iconPath);
        }
        catch { }
    }

    private void ShowWindow()
    {
        Show();
        WindowState = WindowState.Normal;
        Activate();
    }

    private void OnClosing(object? sender, WindowClosingEventArgs e)
    {
        if (_vm?.MinimizeToTray == true && e.CloseReason != WindowCloseReason.ApplicationShutdown)
        {
            e.Cancel = true;
            Hide();
        }
        else
        {
            _trayIcon?.Dispose();
            _vm?.Dispose();
        }
    }
}
