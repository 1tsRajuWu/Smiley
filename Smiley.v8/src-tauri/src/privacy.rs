//! Privacy filters — what leaves the Rust core toward UI / logs / Discord.

use crate::models::Config;
use crate::riot::{MatchBoard, RiotLive};

/// Strip or mask match board fields based on user privacy settings.
pub fn sanitize_board(mut board: MatchBoard, cfg: &Config) -> Option<MatchBoard> {
    if !cfg.live_gaming || !cfg.show_match_board {
        return None;
    }

    if !cfg.show_other_riot_ids {
        let mut ally_n = 0u32;
        let mut enemy_n = 0u32;
        for p in &mut board.players {
            if p.is_self {
                p.name = "You".into();
                continue;
            }
            if p.seat == "Enemy" {
                enemy_n += 1;
                p.name = format!("Enemy {enemy_n}");
            } else {
                ally_n += 1;
                p.name = format!("Ally {ally_n}");
            }
        }
    }

    if !cfg.show_other_player_stats {
        for p in &mut board.players {
            if !p.is_self {
                p.kda = None;
            }
        }
    }

    if !cfg.share_valorant_stats_discord {
        board.score = None;
        board.self_kda = None;
    }

    Some(board)
}

/// Discord lines respecting share_valorant_stats_discord.
pub fn valorant_discord_lines(live: &RiotLive, cfg: &Config) -> (String, String) {
    if !cfg.share_valorant_stats_discord {
        return (
            live.title.clone(),
            match live.phase.as_str() {
                "match" => "In match".into(),
                "pregame" => "Agent select".into(),
                "queue" => "In queue".into(),
                _ => "In lobby".into(),
            },
        );
    }
    (live.details.clone(), live.state.clone())
}

/// Redact secrets / identities from user-facing log lines.
pub fn redact_log_message(message: &str) -> String {
    let mut out = String::with_capacity(message.len().min(500));
    for word in message.split_whitespace() {
        let w = word.trim_matches(|c: char| c == ',' || c == ';' || c == '.' || c == ')' || c == '(');
        if looks_like_puuid(w) || looks_like_riot_id(w) || w.contains("lockfile") {
            out.push_str("[redacted] ");
        } else {
            out.push_str(word);
            out.push(' ');
        }
    }
    out.trim().chars().take(500).collect()
}

fn looks_like_puuid(s: &str) -> bool {
    let s = s.trim_matches('"');
    s.len() == 36
        && s.chars().filter(|c| *c == '-').count() == 4
        && s.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
}

fn looks_like_riot_id(s: &str) -> bool {
    let s = s.trim_matches('"');
    if let Some((name, tag)) = s.split_once('#') {
        return !name.is_empty() && tag.len() >= 2 && tag.len() <= 6;
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_puuid() {
        let msg = "player 550e8400-e29b-41d4-a716-446655440000 joined";
        assert!(redact_log_message(msg).contains("[redacted]"));
    }

    #[test]
    fn redacts_riot_id() {
        let msg = "saw PlayerName#TAG1 in lobby";
        assert!(redact_log_message(msg).contains("[redacted]"));
    }
}
