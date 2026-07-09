//! Discord artwork for Valorant sessions — logo + contextual small overlay.

use crate::riot::RiotLive;
use crate::valorant_catalog::{self, valorant_game_logo};

#[derive(Debug, Clone)]
pub struct ValorantArt {
    pub large_image: String,
    pub large_text: String,
    pub small_image: Option<String>,
    pub small_text: Option<String>,
}

pub fn resolve_art(live: &RiotLive) -> ValorantArt {
    let large_image = valorant_game_logo().to_string();
    let large_text = live
        .board
        .map
        .clone()
        .filter(|m| !m.is_empty())
        .unwrap_or_else(|| live.title.clone());

    let agent_id = live.self_agent_id.as_deref();
    let map_ref = live
        .map_id
        .as_deref()
        .or(live.board.map.as_deref())
        .unwrap_or("");
    let queue_id = live.queue_id.as_deref().unwrap_or("");

    let (small_image, small_text) = match live.phase.as_str() {
        "match" | "pregame" => {
            if let Some(id) = agent_id {
                if let Some(url) = valorant_catalog::agent_icon_url(id) {
                    let text = live
                        .board
                        .self_agent
                        .clone()
                        .or_else(|| valorant_catalog::agent_display_name(id));
                    return ValorantArt {
                        large_image,
                        large_text,
                        small_image: Some(url),
                        small_text: text,
                    };
                }
            }
            if !map_ref.is_empty() {
                if let Some(url) = valorant_catalog::map_icon_url(map_ref) {
                    return ValorantArt {
                        large_image,
                        large_text,
                        small_image: Some(url),
                        small_text: live.board.map.clone(),
                    };
                }
            }
            (None, None)
        }
        "queue" | "lobby" => {
            let mode_url = valorant_catalog::mode_icon_url(queue_id);
            let mode_text = live.board.mode.clone();
            (mode_url, mode_text)
        }
        _ => (None, None),
    };

    ValorantArt {
        large_image,
        large_text,
        small_image,
        small_text,
    }
}
