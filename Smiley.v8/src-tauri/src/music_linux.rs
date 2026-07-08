//! Linux MPRIS D-Bus probe — lightweight poll (playerctl / Music Presence pattern).

use crate::music::TrackHit;

/// One-shot active-player probe via MPRIS2 D-Bus.
pub fn probe_mpris() -> Option<TrackHit> {
    use mpris::{PlaybackStatus, PlayerFinder};

    let finder = PlayerFinder::new().ok()?;
    let player = finder.find_active().ok()?;
    let app = player
        .identity()
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Media".into());
    let status = player.get_playback_status().ok()?;
    let playing = status == PlaybackStatus::Playing;
    let meta = player.get_metadata().ok()?;
    let title = meta.title()?.trim();
    if title.is_empty() {
        return None;
    }
    let artist = meta
        .artists()
        .map(|list| list.join(", "))
        .unwrap_or_default();
    let album = meta.album_name().unwrap_or("").to_string();

    Some(TrackHit {
        title: title.chars().take(120).collect(),
        artist: artist.chars().take(120).collect(),
        album: album.chars().take(120).collect(),
        app: app.chars().take(64).collect(),
        playing,
    })
}
