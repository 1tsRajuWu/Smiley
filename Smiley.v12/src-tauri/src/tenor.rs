//! Tenor GIF URL normalization and resolution (CDN + page links).
//!
//! Tenor's public API was sunset; we resolve page links via the lightweight
//! `/embed/{id}` endpoint which ships a `gif-json` payload with `media_formats`.

use crate::error::{AppError, AppResult};
use std::time::Duration;

pub const GIF_FALLBACK: &str =
    "https://media.tenor.com/_EzjRj8XOP4AAAAM/streaming-stream.gif";

const FETCH_UA: &str =
    "Mozilla/5.0 (compatible; Smiley/12; +https://github.com/1tsRajuWu/Smiley)";

/// Strip paste noise (HTML wrappers, trailing punctuation, query/hash).
pub fn clean_pasted_url(raw: &str) -> String {
    let mut u = raw.trim().trim_matches('"').trim_matches('\'').to_string();
    if u.starts_with('<') && u.ends_with('>') {
        u = u[1..u.len() - 1].trim().to_string();
    }
    if let Some(idx) = u.find(' ') {
        u.truncate(idx);
    }
    // Browser "Copy image address" often appends ?hh=&ww= size params — Discord wants a clean .gif.
    if let Some(idx) = u.find(['?', '#']) {
        u.truncate(idx);
    }
    u.trim_end_matches(&['.', ',', ';', ')', ']', '}'][..]).to_string()
}

/// True when the URL path (not query) ends with `.gif` — matches v7 `/\.gif(\?|#|$)/`.
fn path_ends_with_gif(url: &str) -> bool {
    let path = url.split(['?', '#']).next().unwrap_or(url);
    path.to_ascii_lowercase().ends_with(".gif")
}

/// Normalize Tenor CDN variants (media1, media2, http) to Discord-safe HTTPS.
pub fn normalize_gif_url(url: &str) -> String {
    let mut u = clean_pasted_url(url);
    if u.is_empty() {
        return u;
    }
    if !u.starts_with("http://") && !u.starts_with("https://") && u.contains("tenor.com") {
        u = format!("https://{u}");
    }
    if u.starts_with("http://") {
        u = u.replacen("http://", "https://", 1);
    }
    if let Some(rest) = u.strip_prefix("https://media1.tenor.com/m/") {
        let mut parts = rest.splitn(2, '/');
        if let (Some(id), Some(file)) = (parts.next(), parts.next()) {
            let id = if id.ends_with("AAAAC") {
                format!("{}AAAAM", &id[..id.len().saturating_sub(5)])
            } else if id.ends_with("AAAAd") {
                format!("{}AAAAM", &id[..id.len().saturating_sub(5)])
            } else {
                id.to_string()
            };
            return format!("https://media.tenor.com/{id}/{file}");
        }
        u = u.replace("https://media1.tenor.com", "https://media.tenor.com");
    }
    if u.starts_with("https://media1.tenor.com/") {
        u = u.replace("https://media1.tenor.com", "https://media.tenor.com");
    }
    if u.starts_with("https://media2.tenor.com/") {
        u = u.replace("https://media2.tenor.com", "https://media.tenor.com");
    }
    if u.starts_with("https://media3.tenor.com/") {
        u = u.replace("https://media3.tenor.com", "https://media.tenor.com");
    }
    u
}

fn is_valid_tenor_gif_url(url: &str) -> bool {
    let u = url.trim();
    if u.is_empty() || u.len() >= 500 {
        return false;
    }
    if u.contains(['"', '\'', '<', '>', ' ']) {
        return false;
    }
    if !path_ends_with_gif(u) {
        return false;
    }
    let host = u
        .strip_prefix("https://")
        .and_then(|rest| rest.split('/').next());
    let Some(host) = host else {
        return false;
    };
    host == "media.tenor.com"
        || host == "c.tenor.com"
        || host == "media1.tenor.com"
        || (host.starts_with("media") && host.ends_with(".tenor.com"))
}

/// Tenor HTTPS only — Discord-safe + matches CSP img-src.
pub fn sanitize_gif_url(url: &str) -> Option<String> {
    let u = normalize_gif_url(url);
    if is_valid_tenor_gif_url(&u) {
        Some(u)
    } else {
        None
    }
}

pub fn sanitize_gif_url_or(url: &str, fallback: &str) -> String {
    sanitize_gif_url(url).unwrap_or_else(|| fallback.to_string())
}

/// Allowlisted GIF browse sites (Tenor attribution only).
pub fn is_safe_gif_source_url(url: &str) -> bool {
    let u = url.trim();
    u == "https://tenor.com"
        || u.starts_with("https://tenor.com/")
        || u == "https://www.tenor.com"
        || u.starts_with("https://www.tenor.com/")
}

/// Pull a direct Tenor CDN `.gif` URL from HTML (view pages, search, embed).
pub fn extract_tenor_gif_from_html(html: &str) -> Option<String> {
    if let Some(url) = extract_gif_from_json_script(html) {
        return Some(url);
    }
    const PREFIXES: &[&str] = &[
        "https://media.tenor.com/",
        "https://media1.tenor.com/",
        "https://media2.tenor.com/",
        "https://media3.tenor.com/",
        "https://c.tenor.com/",
    ];
    for prefix in PREFIXES {
        let mut search_from = 0;
        while let Some(rel) = html[search_from..].find(prefix) {
            let start = search_from + rel;
            let slice = &html[start..];
            let Some(gif_rel) = slice.find(".gif") else {
                break;
            };
            let end = gif_rel + 4;
            let candidate = decode_json_escapes(&slice[..end]);
            if let Some(url) = sanitize_gif_url(&candidate) {
                return Some(url);
            }
            search_from = start + prefix.len();
        }
    }
    None
}

fn decode_json_escapes(s: &str) -> String {
    s.replace("\\u002F", "/").replace("\\/", "/")
}

/// Parse `<script id="gif-json">` from Tenor embed pages.
fn extract_gif_from_json_script(html: &str) -> Option<String> {
    let marker = r#"<script id="gif-json""#;
    let start = html.find(marker)?;
    let after = &html[start..];
    let content_start = after.find('>')? + 1;
    let content_end = after[content_start..].find("</script>")? + content_start;
    let json_raw = &after[content_start..content_end];
    let value: serde_json::Value = serde_json::from_str(json_raw).ok()?;
    pick_gif_from_media_formats(&value)
}

fn pick_gif_from_media_formats(root: &serde_json::Value) -> Option<String> {
    let formats = root.get("media_formats")?;
    // Prefer medium/full GIF for Discord large_image clarity; tinygif last.
    for key in ["mediumgif", "gif", "tinygif", "nanogif"] {
        if let Some(url) = formats
            .get(key)
            .and_then(|f| f.get("url"))
            .and_then(|u| u.as_str())
        {
            let decoded = decode_json_escapes(url);
            if let Some(safe) = sanitize_gif_url(&decoded) {
                return Some(safe);
            }
        }
    }
    None
}

/// Extract Tenor post id from view/embed/short URLs.
pub fn extract_tenor_post_id(url: &str) -> Option<String> {
    let lower = url.to_ascii_lowercase();
    if !lower.contains("tenor.com") {
        return None;
    }
    if let Some(rest) = lower.strip_prefix("https://tenor.com/embed/") {
        let id: String = rest
            .chars()
            .take_while(|c| c.is_ascii_digit())
            .collect();
        if !id.is_empty() {
            return Some(id);
        }
    }
    if let Some(idx) = lower.rfind("-gif-") {
        let tail = &url[idx + 5..];
        let id: String = tail
            .chars()
            .take_while(|c| c.is_ascii_digit())
            .collect();
        if !id.is_empty() {
            return Some(id);
        }
    }
    if let Some(idx) = lower.rfind('/') {
        let tail = &lower[idx + 1..];
        if let Some(dash) = tail.rfind('-') {
            let id: String = tail[dash + 1..]
                .chars()
                .take_while(|c| c.is_ascii_digit())
                .collect();
            if id.len() >= 5 {
                return Some(id);
            }
        }
    }
    None
}

fn http_client() -> AppResult<reqwest::blocking::Client> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(12))
        .redirect(reqwest::redirect::Policy::limited(5))
        .user_agent(FETCH_UA)
        .build()
        .map_err(|e| AppError::Msg(format!("http client: {e}")))
}

fn fetch_text(client: &reqwest::blocking::Client, url: &str) -> AppResult<String> {
    let resp = client
        .get(url)
        .send()
        .map_err(|e| AppError::Msg(format!("Could not fetch Tenor: {e}")))?;
    if !resp.status().is_success() {
        return Err(AppError::Msg(format!(
            "Tenor returned HTTP {} for {}",
            resp.status(),
            trim_url_for_error(url)
        )));
    }
    resp.text()
        .map_err(|e| AppError::Msg(format!("Could not read Tenor response: {e}")))
}

fn trim_url_for_error(url: &str) -> String {
    if url.len() > 80 {
        format!("{}…", &url[..77])
    } else {
        url.to_string()
    }
}

fn resolve_via_embed(client: &reqwest::blocking::Client, post_id: &str) -> AppResult<String> {
    let embed_url = format!("https://tenor.com/embed/{post_id}");
    let body = fetch_text(client, &embed_url)?;
    if let Some(url) = extract_tenor_gif_from_html(&body) {
        return Ok(url);
    }
    Err(AppError::Msg(
        "Tenor embed page had no GIF — try a direct media.tenor.com link".into(),
    ))
}

/// Resolve a pasted Tenor CDN or Tenor page URL to a Discord-safe GIF URL.
pub fn resolve_gif_url(raw: &str) -> AppResult<String> {
    let trimmed = clean_pasted_url(raw);
    if trimmed.is_empty() {
        return Err(AppError::Msg("GIF URL is empty".into()));
    }
    let normalized = normalize_gif_url(&trimmed);
    if let Some(url) = sanitize_gif_url(&normalized) {
        return Ok(url);
    }

    let fetch_url = if normalized.starts_with("https://") {
        normalized.clone()
    } else if normalized.starts_with("http://") {
        normalize_gif_url(&normalized)
    } else if normalized.contains("tenor.com") {
        format!("https://{normalized}")
    } else {
        return Err(AppError::Msg(
            "GIF must be a Tenor link (https://media.tenor.com/… or a tenor.com page)".into(),
        ));
    };

    let lower = fetch_url.to_ascii_lowercase();
    if !lower.contains("tenor.com") {
        return Err(AppError::Msg(
            "Only Tenor GIF URLs are supported (https://media.tenor.com/…)".into(),
        ));
    }

    let client = http_client()?;

    // Fast path: embed endpoint is reliable even when view pages are SPA shells.
    if let Some(post_id) = extract_tenor_post_id(&fetch_url) {
        if let Ok(url) = resolve_via_embed(&client, &post_id) {
            return Ok(url);
        }
    }

    // Follow redirects (short links like tenor.com/wykR.gif → view page).
    if let Ok(body) = fetch_text(&client, &fetch_url) {
        if let Some(url) = extract_tenor_gif_from_html(&body) {
            return Ok(url);
        }
        if let Some(post_id) = extract_tenor_post_id(&body) {
            if let Ok(url) = resolve_via_embed(&client, &post_id) {
                return Ok(url);
            }
        }
    }

    Err(AppError::Msg(
        "Could not resolve that Tenor link — paste a direct https://media.tenor.com/… URL, \
         or open Tenor, pick a GIF, and copy the page link from the address bar"
            .into(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_media1_tenor_path() {
        let raw = "https://media1.tenor.com/m/AbCdEfAAAAC/taco.gif";
        let out = normalize_gif_url(raw);
        assert_eq!(out, "https://media.tenor.com/AbCdEfAAAAM/taco.gif");
    }

    #[test]
    fn accepts_media2_tenor_host() {
        let url = "https://media2.tenor.com/abc/def.gif";
        assert!(sanitize_gif_url(url).is_some());
    }

    #[test]
    fn upgrades_http_tenor() {
        let url = "http://media.tenor.com/abc/def.gif";
        let out = sanitize_gif_url(url).expect("valid");
        assert!(out.starts_with("https://media.tenor.com/"));
    }

    #[test]
    fn normalize_protocol_less_tenor_cdn() {
        let raw = "media.tenor.com/BsoscZUHi-gAAAAM/sleepy-sleep.gif";
        let out = normalize_gif_url(raw);
        assert_eq!(out, "https://media.tenor.com/BsoscZUHi-gAAAAM/sleepy-sleep.gif");
        assert!(sanitize_gif_url(&out).is_some());
    }

    #[test]
    fn extract_tenor_gif_from_sample_html() {
        let html = r#"<meta content="https://media.tenor.com/BsoscZUHi-gAAAAM/sleepy-sleep.gif" />"#;
        let out = extract_tenor_gif_from_html(html).expect("gif");
        assert_eq!(
            out,
            "https://media.tenor.com/BsoscZUHi-gAAAAM/sleepy-sleep.gif"
        );
    }

    #[test]
    fn extract_post_id_from_view_url() {
        let id = extract_tenor_post_id(
            "https://tenor.com/view/chuck-norris-walker-texas-ranger-gif-5336135",
        );
        assert_eq!(id.as_deref(), Some("5336135"));
    }

    #[test]
    fn extract_post_id_from_embed_url() {
        let id = extract_tenor_post_id("https://tenor.com/embed/5336135");
        assert_eq!(id.as_deref(), Some("5336135"));
    }

    #[test]
    fn parse_gif_json_script() {
        let html = r#"<script id="gif-json" type="text/x-cache">{"media_formats":{"tinygif":{"url":"https:\/\/media.tenor.com\/ZZonEFGoli0AAAAM\/chuck.gif"}}}</script>"#;
        let out = extract_tenor_gif_from_html(html).expect("gif");
        assert_eq!(
            out,
            "https://media.tenor.com/ZZonEFGoli0AAAAM/chuck.gif"
        );
    }

    #[test]
    fn clean_pasted_url_strips_html() {
        assert_eq!(
            clean_pasted_url(r#"<https://media.tenor.com/abc/def.gif>"#),
            "https://media.tenor.com/abc/def.gif"
        );
    }

    #[test]
    fn accepts_cdn_gif_with_query_params() {
        let raw = "https://media.tenor.com/BsoscZUHi-gAAAAM/sleepy-sleep.gif?hh=200&ww=200";
        let out = sanitize_gif_url(raw).expect("query-string CDN GIF must sanitize");
        assert_eq!(
            out,
            "https://media.tenor.com/BsoscZUHi-gAAAAM/sleepy-sleep.gif"
        );
        assert_eq!(resolve_gif_url(raw).expect("resolve"), out);
    }

    #[test]
    fn accepts_cdn_gif_with_hash() {
        let raw = "https://media.tenor.com/BsoscZUHi-gAAAAM/sleepy-sleep.gif#t";
        let out = sanitize_gif_url(raw).expect("hash CDN GIF must sanitize");
        assert_eq!(
            out,
            "https://media.tenor.com/BsoscZUHi-gAAAAM/sleepy-sleep.gif"
        );
    }

    #[test]
    fn gif_source_allowlist() {
        assert!(is_safe_gif_source_url("https://tenor.com/"));
        assert!(is_safe_gif_source_url("https://tenor.com/search?q=anime"));
        assert!(!is_safe_gif_source_url("https://example.com/"));
    }
}
