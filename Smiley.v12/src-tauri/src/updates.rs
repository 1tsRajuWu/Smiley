//! GitHub release check for Smiley v12 tags only.

use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};

const GITHUB_RELEASES_API: &str =
    "https://api.github.com/repos/1tsRajuWu/Smiley/releases?per_page=40";
pub const GITHUB_RELEASES_PAGE: &str = "https://github.com/1tsRajuWu/Smiley/releases/latest";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheck {
    pub current_version: String,
    pub latest_version: Option<String>,
    pub up_to_date: bool,
    pub releases_url: String,
    pub download_url: Option<String>,
    pub message: String,
}

#[derive(Deserialize)]
struct GhRelease {
    tag_name: String,
    html_url: String,
    draft: Option<bool>,
}

fn parse_v12_version(tag: &str) -> Option<Vec<u32>> {
    let s = tag.trim().trim_start_matches('v');
    if !s.starts_with("12.") {
        return None;
    }
    let parts: Vec<u32> = s
        .split('.')
        .take(4)
        .filter_map(|p| {
            let num: String = p.chars().take_while(|c| c.is_ascii_digit()).collect();
            num.parse().ok()
        })
        .collect();
    if parts.first() == Some(&12) && parts.len() >= 2 {
        Some(parts)
    } else {
        None
    }
}

fn cmp_versions(a: &[u32], b: &[u32]) -> std::cmp::Ordering {
    let n = a.len().max(b.len());
    for i in 0..n {
        let av = a.get(i).copied().unwrap_or(0);
        let bv = b.get(i).copied().unwrap_or(0);
        match av.cmp(&bv) {
            std::cmp::Ordering::Equal => {}
            other => return other,
        }
    }
    std::cmp::Ordering::Equal
}

fn normalize_tag(tag: &str) -> String {
    tag.trim().trim_start_matches('v').to_string()
}

pub fn is_safe_release_url(url: &str) -> bool {
    let u = url.trim();
    u.starts_with("https://github.com/1tsRajuWu/Smiley/releases/")
        || u == GITHUB_RELEASES_PAGE
        || u == "https://github.com/1tsRajuWu/Smiley/releases"
}

pub fn check_for_updates() -> AppResult<UpdateCheck> {
    let current = env!("CARGO_PKG_VERSION").to_string();
    let current_parts = parse_v12_version(&current).unwrap_or_else(|| {
        current
            .split('.')
            .filter_map(|p| p.parse().ok())
            .collect()
    });
    let releases_url = GITHUB_RELEASES_PAGE.to_string();

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent(format!("Smiley-v12/{current}"))
        .build()
        .map_err(|e| AppError::Msg(format!("HTTP client: {e}")))?;

    let resp = client
        .get(GITHUB_RELEASES_API)
        .header("Accept", "application/vnd.github+json")
        .send()
        .map_err(|e| AppError::Msg(format!("GitHub API: {e}")))?;

    if !resp.status().is_success() {
        return Ok(UpdateCheck {
            current_version: current,
            latest_version: None,
            up_to_date: true,
            releases_url,
            download_url: None,
            message: "Could not reach GitHub — try again later.".into(),
        });
    }

    let releases: Vec<GhRelease> = resp
        .json()
        .map_err(|e| AppError::Msg(format!("Parse releases: {e}")))?;

    let mut best: Option<(Vec<u32>, String, String)> = None;
    for rel in releases {
        if rel.draft.unwrap_or(false) {
            continue;
        }
        if let Some(ver) = parse_v12_version(&rel.tag_name) {
            if best
                .as_ref()
                .map_or(true, |(b, _, _)| cmp_versions(&ver, b) == std::cmp::Ordering::Greater)
            {
                best = Some((ver, normalize_tag(&rel.tag_name), rel.html_url));
            }
        }
    }

    let Some((latest_parts, latest_ver, html_url)) = best else {
        return Ok(UpdateCheck {
            current_version: current,
            latest_version: None,
            up_to_date: true,
            releases_url,
            download_url: None,
            message: "No v12 release found on GitHub yet.".into(),
        });
    };

    if cmp_versions(&current_parts, &latest_parts) >= std::cmp::Ordering::Equal {
        Ok(UpdateCheck {
            current_version: current.clone(),
            latest_version: Some(latest_ver),
            up_to_date: true,
            releases_url,
            download_url: None,
            message: format!("You're up to date (v{current})."),
        })
    } else {
        Ok(UpdateCheck {
            current_version: current.clone(),
            latest_version: Some(latest_ver.clone()),
            up_to_date: false,
            releases_url: html_url.clone(),
            download_url: Some(html_url),
            message: format!("Update available: v{latest_ver} (you have v{current})."),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_v12_tags() {
        assert_eq!(
            parse_v12_version("v12.0.0"),
            Some(vec![12, 0, 0])
        );
        assert!(parse_v12_version("v8.0.19").is_none());
    }

    #[test]
    fn compares_versions() {
        assert_eq!(
            cmp_versions(&[12, 0, 1], &[12, 0, 0]),
            std::cmp::Ordering::Greater
        );
    }

    #[test]
    fn allows_github_release_urls() {
        assert!(is_safe_release_url(
            "https://github.com/1tsRajuWu/Smiley/releases/tag/v12.0.0"
        ));
        assert!(!is_safe_release_url("https://evil.com/releases"));
    }
}
