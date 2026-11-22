// SPDX-License-Identifier: MIT OR Apache-2.0
//
// rustmd-core — the platform-independent half of rustmd.
//
// Everything here is free of Tauri, of windows, and of desktop assumptions:
// path containment, front matter, text encodings (UTF-8/GBK/GB18030),
// note scanning, hashing and atomic writes. Any frontend or embedding
// application can depend on this crate instead of reimplementing the rules.
//
// License: MIT OR Apache-2.0 so it stays usable outside this application; the
// desktop application (this repository root) stays GPL-3.0-or-later.

use encoding_rs::{Encoding, GB18030, GBK, UTF_8};
use serde::{Deserialize, Serialize};
use std::fs;
use std::hash::{Hash, Hasher};
use std::io::{ErrorKind, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, UNIX_EPOCH};

// ---------------- Types ----------------

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NoteMeta {
    pub path: String,   // relative to notes root, forward slashes, e.g. "work/idea.md"
    pub folder: String, // "" for root
    pub title: String,
    pub tags: Vec<String>,
    pub snippet: String,
    pub mtime: i64, // unix seconds
    /// `"markdown"`, `"html"`, `"csv"`, `"txt"` or `"json"`: decides how the
    /// body is parsed/previewed and whether front matter applies.
    pub kind: String,
    /// Auto-detected on-disk text encoding. Empty for a file whose bytes
    /// decode as none of the supported codecs.
    pub encoding: String,
    /// Content hash of the raw file. The frontend sends it back on save so a
    /// file changed by another program is detected even when the mtime
    /// resolution (seconds) would miss it.
    pub hash: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub meta: NoteMeta,
    pub snippet: String, // plain text around the first match
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteContent {
    pub tags: Vec<String>,
    pub body: String,
    pub mtime: i64,
    pub hash: String,
    pub kind: String,
    /// Auto-detected on-disk text encoding (`UTF-8`, `UTF-8 BOM`, `GBK`,
    /// `GB18030`). Saving re-encodes with the same codec so opening a legacy
    /// CSV/TXT file never silently converts it.
    pub encoding: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveNoteArgs {
    pub tags: Vec<String>,
    pub body: String,
    /// Hash the editor loaded. `None` keeps the old last-writer-wins
    /// behaviour for callers that do not track it.
    #[serde(default)]
    pub base_hash: Option<String>,
    /// Legacy conflict token (kept for compatibility); `base_hash` is
    /// preferred because filesystem mtimes have one-second resolution.
    #[serde(default)]
    pub base_mtime: Option<i64>,
    /// User confirmed overwriting an externally modified file.
    #[serde(default)]
    pub force: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchedImage {
    pub bytes: Vec<u8>,
    pub mime: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalImage {
    pub bytes: Vec<u8>,
    pub mime: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SelftestConfig {
    pub examples_dir: String,
    pub out_dir: String,
}

// ---------------- Path safety ----------------

/// `fs::canonicalize` on Windows returns `\\?\`-prefixed (extended-length)
/// paths. Strip that prefix so the path stays comparable with normal
/// (root-relative) paths and `Path::strip_prefix` keeps working.
///
/// Network shares canonicalize to `\\?\UNC\server\share\…`; stripping only
/// `\\?\` would produce the invalid `UNC\server\…`, so the UNC form is
/// restored to a real `\\server\share\…` path.
pub fn strip_extended_prefix(p: &Path) -> PathBuf {
    let s = p.to_string_lossy();
    if let Some(rest) = s.strip_prefix(r"\\?\") {
        if let Some(unc) = rest
            .strip_prefix("UNC\\")
            .or_else(|| rest.strip_prefix("unc\\"))
        {
            return PathBuf::from(format!(r"\\{unc}"));
        }
        return PathBuf::from(rest);
    }
    p.to_path_buf()
}

pub fn canonical_root(root: &Path) -> Result<PathBuf, String> {
    if !root.is_dir() {
        return Err(format!("not a directory: {}", root.display()));
    }
    Ok(strip_extended_prefix(
        &fs::canonicalize(root).map_err(|e| e.to_string())?,
    ))
}

/// Deepest ancestor of `path` that currently exists (including `path`).
pub fn deepest_existing_ancestor(path: &Path) -> Option<PathBuf> {
    let mut p = path.to_path_buf();
    loop {
        if p.exists() {
            return Some(p);
        }
        if !p.pop() {
            return None;
        }
    }
}

/// Join a relative path to the notes root and verify the result stays inside
/// it. Existing paths are fully canonicalized (so `..`, junctions and case
/// are resolved); for a path that does not exist yet, the deepest existing
/// ancestor is canonicalized and checked instead. That closes the
/// "junction in the vault + new file" write escape.
pub fn resolve_in_root(root: &Path, rel: &str) -> Result<PathBuf, String> {
    if rel.trim().is_empty() {
        return Err("empty path".into());
    }
    let rel_path = Path::new(rel);
    if rel_path.is_absolute() {
        return Err("absolute path not allowed".into());
    }
    let mut inside = PathBuf::new();
    for comp in rel_path.components() {
        match comp {
            Component::Normal(c) => inside.push(c),
            Component::CurDir => {}
            // Note paths are generated by our own scan and never contain `..`;
            // reject them outright instead of resolving them.
            Component::ParentDir => return Err("path escapes notes root".into()),
            _ => return Err("invalid path".into()),
        }
    }
    let canon_root = canonical_root(root)?;
    if inside.as_os_str().is_empty() {
        // "." is the vault root itself; note paths never use it, but folder
        // arguments (create/move) and the path tests do.
        if rel.trim() == "." || rel.trim() == "./" {
            return Ok(canon_root);
        }
        return Err("empty path".into());
    }
    let full = canon_root.join(&inside);
    let Some(ancestor) = deepest_existing_ancestor(&full) else {
        return Err("path has no existing ancestor".into());
    };
    let canon_ancestor =
        strip_extended_prefix(&fs::canonicalize(&ancestor).map_err(|e| e.to_string())?);
    if !canon_ancestor.starts_with(&canon_root) {
        return Err("path escapes notes root".into());
    }
    if full.exists() {
        let canon = strip_extended_prefix(&fs::canonicalize(&full).map_err(|e| e.to_string())?);
        if !canon.starts_with(&canon_root) {
            return Err("path escapes notes root".into());
        }
        return Ok(canon);
    }
    Ok(full)
}

/// Convert a platform path into the note protocol path. On Windows the
/// backend separator is `\`; on Unix a literal backslash is a valid filename
/// character and must NOT be rewritten into a separator.
pub fn note_path_string(path: &Path) -> String {
    let text = path.to_string_lossy();
    #[cfg(windows)]
    {
        text.replace('\\', "/")
    }
    #[cfg(not(windows))]
    {
        text.into_owned()
    }
}

pub fn rel_from_root(root: &Path, full: &Path) -> Result<String, String> {
    let canon_root = canonical_root(root)?;
    full.strip_prefix(&canon_root)
        .map(note_path_string)
        .map_err(|e| e.to_string())
}

/// Windows junctions/reparse points and Unix symlinks must be treated as
/// opaque: following a directory junction can escape the vault (or loop on
/// an ancestor link), and a symlinked note can point outside the root.
pub fn is_link_or_reparse(path: &Path) -> bool {
    let Ok(md) = fs::symlink_metadata(path) else {
        return true;
    };
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
        md.file_type().is_symlink() || md.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
    }
    #[cfg(not(windows))]
    {
        md.file_type().is_symlink()
    }
}

// ---------------- Front matter ----------------

#[derive(Debug)]
pub struct FrontMatterDoc {
    pub bom: bool,
    pub line_ending: &'static str,
    pub frontmatter: Option<Vec<String>>,
    pub body: String,
}

pub fn line_ending_of(text: &str) -> &'static str {
    match text.find('\n') {
        Some(i) if i > 0 && text.as_bytes()[i - 1] == b'\r' => "\r\n",
        _ => "\n",
    }
}

pub fn normalize_newlines(text: &str) -> String {
    text.replace("\r\n", "\n").replace('\r', "\n")
}

/// Split a note into (optional) front matter lines and body. The body is
/// normalized to LF and trailing blank lines are preserved; line endings are
/// detected so `compose_note` can restore them on save.
pub fn split_document(text: &str) -> FrontMatterDoc {
    let (bom, rest) = match text.strip_prefix('\u{feff}') {
        Some(r) => (true, r),
        None => (false, text),
    };
    let line_ending = line_ending_of(rest);
    let normalized = normalize_newlines(rest);
    let mut lines = normalized.split('\n');
    let first = lines.next().unwrap_or("");
    if first.trim_end() != "---" {
        return FrontMatterDoc {
            bom,
            line_ending,
            frontmatter: None,
            body: normalized,
        };
    }
    let rest_lines: Vec<&str> = lines.collect();
    let Some(end_idx) = rest_lines
        .iter()
        .position(|l| matches!(l.trim_end(), "---" | "..."))
    else {
        return FrontMatterDoc {
            bom,
            line_ending,
            frontmatter: None,
            body: normalized,
        };
    };
    let frontmatter = rest_lines[..end_idx]
        .iter()
        .map(|s| s.to_string())
        .collect();
    let mut body_start = end_idx + 1;
    while body_start < rest_lines.len() && rest_lines[body_start].is_empty() {
        body_start += 1;
    }
    FrontMatterDoc {
        bom,
        line_ending,
        frontmatter: Some(frontmatter),
        body: rest_lines[body_start..].join("\n"),
    }
}

pub fn starts_with_whitespace(s: &str) -> bool {
    s.chars().next().is_some_and(|c| c.is_whitespace())
}

/// Strip a YAML comment (` #…`) that is outside a quoted scalar.
pub fn strip_yaml_comment(s: &str) -> &str {
    let mut quote: Option<char> = None;
    let mut escaped = false;
    for (idx, ch) in s.char_indices() {
        if escaped {
            escaped = false;
            continue;
        }
        match quote {
            Some(q) => {
                if q == '"' && ch == '\\' {
                    escaped = true;
                } else if ch == q {
                    quote = None;
                }
            }
            None => {
                if ch == '"' || ch == '\'' {
                    quote = Some(ch);
                } else if ch == '#' {
                    let before = s[..idx].chars().next_back();
                    if before.is_none_or(|c| c.is_whitespace()) {
                        return s[..idx].trim();
                    }
                }
            }
        }
    }
    s
}

/// Split a flow list / comma list on top-level commas (quotes respected).
pub fn split_top_level_commas(s: &str) -> Vec<&str> {
    let mut parts = Vec::new();
    let mut start = 0usize;
    let mut quote: Option<char> = None;
    let mut escaped = false;
    for (i, ch) in s.char_indices() {
        if escaped {
            escaped = false;
            continue;
        }
        match quote {
            Some(q) => {
                if q == '"' && ch == '\\' {
                    escaped = true;
                } else if ch == q {
                    quote = None;
                }
            }
            None => {
                if ch == '"' || ch == '\'' {
                    quote = Some(ch);
                } else if ch == ',' {
                    parts.push(&s[start..i]);
                    start = i + 1;
                }
            }
        }
    }
    parts.push(&s[start..]);
    parts
}

pub fn unescape_double_quoted(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars();
    while let Some(c) = chars.next() {
        if c == '\\' {
            match chars.next() {
                Some('n') => out.push('\n'),
                Some('t') => out.push('\t'),
                Some(other) => out.push(other),
                None => out.push('\\'),
            }
        } else {
            out.push(c);
        }
    }
    out
}

pub fn parse_yaml_scalar(s: &str) -> String {
    let s = s.trim();
    if s.len() >= 2 && s.starts_with('"') && s.ends_with('"') {
        return unescape_double_quoted(&s[1..s.len() - 1]);
    }
    if s.len() >= 2 && s.starts_with('\'') && s.ends_with('\'') {
        return s[1..s.len() - 1].replace("''", "'");
    }
    s.to_string()
}

pub fn parse_tag_list(raw: &str) -> Vec<String> {
    let s = raw.trim();
    let s = if s.len() >= 2 && s.starts_with('[') && s.ends_with(']') {
        s[1..s.len() - 1].trim()
    } else {
        s
    };
    let mut tags = Vec::new();
    for part in split_top_level_commas(s) {
        let tag = parse_yaml_scalar(part);
        if !tag.is_empty() {
            tags.push(tag);
        }
    }
    tags
}

pub fn push_unique(tags: &mut Vec<String>, tag: String) {
    if !tag.is_empty() && !tags.contains(&tag) {
        tags.push(tag);
    }
}

pub fn parse_tags(lines: &[String]) -> Vec<String> {
    let mut tags: Vec<String> = Vec::new();
    let mut i = 0;
    while i < lines.len() {
        let line = &lines[i];
        // Only a top-level `tags:` key belongs to the note. A nested
        // `meta:\n  tags:` must not be harvested.
        if !starts_with_whitespace(line)
            && let Some(rest) = line.strip_prefix("tags:")
        {
            let value = strip_yaml_comment(rest);
            if value.trim().is_empty() {
                let mut j = i + 1;
                while j < lines.len() {
                    let l = lines[j].trim();
                    if l.is_empty() {
                        j += 1;
                        continue;
                    }
                    if let Some(item) = l.strip_prefix("- ") {
                        let tag = parse_yaml_scalar(strip_yaml_comment(item));
                        push_unique(&mut tags, tag);
                        j += 1;
                    } else if l == "-" {
                        j += 1;
                    } else {
                        break;
                    }
                }
                i = j;
                continue;
            }
            for tag in parse_tag_list(value) {
                push_unique(&mut tags, tag);
            }
        }
        i += 1;
    }
    tags
}

pub fn yaml_quote_tag(tag: &str) -> String {
    let cleaned: String = tag
        .chars()
        .map(|c| if c == '\n' || c == '\r' { ' ' } else { c })
        .collect();
    format!("\"{}\"", cleaned.replace('\\', "\\\\").replace('"', "\\\""))
}

pub fn render_tags_line(tags: &[String]) -> String {
    if tags.is_empty() {
        return "tags: []".to_string();
    }
    let quoted: Vec<String> = tags.iter().map(|t| yaml_quote_tag(t)).collect();
    format!("tags: [{}]", quoted.join(", "))
}

/// Replace (or insert/remove) only the `tags:` entry in a front matter block,
/// preserving every other key and its comment.
pub fn set_tags_in_lines(lines: &mut Vec<String>, tags: &[String]) {
    let Some(tags_idx) = lines
        .iter()
        .position(|l| !starts_with_whitespace(l) && l.trim_start().starts_with("tags:"))
    else {
        if !tags.is_empty() {
            lines.push(render_tags_line(tags));
        }
        return;
    };
    // Consume an inline value plus an optional block list that follows it.
    let mut end = tags_idx + 1;
    while end < lines.len() {
        let t = lines[end].trim();
        if t.is_empty() || t == "-" || t.starts_with("- ") {
            end += 1;
        } else {
            break;
        }
    }
    if tags.is_empty() {
        lines.drain(tags_idx..end);
    } else {
        lines.splice(tags_idx..end, [render_tags_line(tags)]);
    }
}

/// Parse (tags, body). Kept as the single entry point used by the read paths.
pub fn parse_frontmatter(text: &str) -> (Vec<String>, String) {
    let doc = split_document(text);
    let tags = doc
        .frontmatter
        .as_deref()
        .map(parse_tags)
        .unwrap_or_default();
    (tags, doc.body)
}

/// Build the on-disk file from the editor body. When the file already exists,
/// its front matter block (minus `tags:`) and its line-ending style are
/// preserved — saving a note no longer deletes `title:`, `date:` or any other
/// custom field.
pub fn compose_note(existing: Option<&str>, tags: &[String], body: &str) -> String {
    let normalized_body = normalize_newlines(body);
    let (bom, line_ending, frontmatter) = match existing {
        Some(text) => {
            let doc = split_document(text);
            (doc.bom, doc.line_ending, doc.frontmatter)
        }
        None => (false, "\n", None),
    };

    let mut lines = frontmatter.unwrap_or_default();
    set_tags_in_lines(&mut lines, tags);
    let wrote_frontmatter = !lines.is_empty();

    let mut body_out = if line_ending == "\r\n" {
        normalized_body.replace('\n', "\r\n")
    } else {
        normalized_body
    };
    if wrote_frontmatter && !body_out.is_empty() && !body_out.ends_with('\n') {
        body_out.push_str(line_ending);
    }

    let mut out = String::new();
    if bom {
        out.push('\u{feff}');
    }
    if wrote_frontmatter {
        out.push_str("---");
        out.push_str(line_ending);
        for line in &lines {
            out.push_str(line);
            out.push_str(line_ending);
        }
        out.push_str("---");
        out.push_str(line_ending);
        if !body_out.is_empty() {
            out.push_str(line_ending);
        }
    }
    out.push_str(&body_out);
    out
}

// ---------------- Text encodings ----------------

/// The encodings recognized for note files. UTF-8 and GBK cover the vast
/// majority of Chinese notes; GB18030 is the strict superset used when a
/// four-byte sequence is present. UTF-16 is intentionally not guessed (a
/// BOMless binary blob often looks like UTF-16 and would open as noise).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TextEncoding {
    Utf8,
    Utf8Bom,
    Gbk,
    Gb18030,
}

pub const UTF8_BOM: [u8; 3] = [0xEF, 0xBB, 0xBF];
pub const UNSUPPORTED_ENCODING: &str =
    "note is not valid UTF-8, GBK or GB18030 text; convert it to UTF-8 before opening";

impl TextEncoding {
    pub fn label(self) -> &'static str {
        match self {
            Self::Utf8 => "UTF-8",
            Self::Utf8Bom => "UTF-8 BOM",
            Self::Gbk => "GBK",
            Self::Gb18030 => "GB18030",
        }
    }

    pub fn codec(self) -> &'static Encoding {
        match self {
            Self::Utf8 | Self::Utf8Bom => UTF_8,
            Self::Gbk => GBK,
            Self::Gb18030 => GB18030,
        }
    }

    pub fn payload(self, bytes: &[u8]) -> &[u8] {
        if self == Self::Utf8Bom {
            bytes.strip_prefix(&UTF8_BOM).unwrap_or(bytes)
        } else {
            bytes
        }
    }
}

pub fn decode_strict(bytes: &[u8], encoding: TextEncoding) -> Option<String> {
    encoding
        .codec()
        .decode_without_bom_handling_and_without_replacement(encoding.payload(bytes))
        .map(|text| text.into_owned())
}

/// GB18030 four-byte sequence: lead 81-FE, digit 30-39, lead 81-FE, digit
/// 30-39. GBK two-byte trails cannot be 30-39, so this pattern is unambiguous.
pub fn has_gb18030_four_byte_sequence(bytes: &[u8]) -> bool {
    bytes.windows(4).any(|w| {
        (0x81..=0xfe).contains(&w[0])
            && (0x30..=0x39).contains(&w[1])
            && (0x81..=0xfe).contains(&w[2])
            && (0x30..=0x39).contains(&w[3])
    })
}

/// Detect and decode a text note. A BOM identifies UTF-8 unambiguously;
/// otherwise valid UTF-8 wins, then GBK, then GB18030. This order matters:
/// GBK accepts almost every ASCII byte, so testing it before UTF-8 would
/// misclassify ordinary English notes. A rare GBK stream that is also valid
/// UTF-8 is necessarily treated as UTF-8; that inherent ambiguity is a
/// documented residual risk rather than a heuristic that could corrupt valid
/// UTF-8 notes in other scripts.
pub fn decode_note_text(bytes: &[u8]) -> Result<(String, TextEncoding), String> {
    let encoding = if bytes.starts_with(&UTF8_BOM) {
        TextEncoding::Utf8Bom
    } else if std::str::from_utf8(bytes).is_ok() {
        TextEncoding::Utf8
    } else {
        // GBK and GB18030 share the two-byte mappings. When a four-byte
        // GB18030 sequence makes the two decoders disagree, the GB18030
        // reading is authoritative; otherwise keep the narrower GBK label.
        let gbk = decode_strict(bytes, TextEncoding::Gbk);
        let gb18030 = decode_strict(bytes, TextEncoding::Gb18030);
        if has_gb18030_four_byte_sequence(bytes)
            && let Some(gb18030) = decode_strict(bytes, TextEncoding::Gb18030)
        {
            return Ok((gb18030, TextEncoding::Gb18030));
        }
        match (gbk, gb18030) {
            (Some(_), _) => TextEncoding::Gbk,
            (None, Some(_)) => TextEncoding::Gb18030,
            (None, None) => return Err(UNSUPPORTED_ENCODING.into()),
        }
    };
    let text = decode_strict(bytes, encoding).ok_or_else(|| UNSUPPORTED_ENCODING.to_string())?;
    // A single BOM was consumed by the codec. Repeated BOMs are treated as
    // accidental prefixes: strip them all so read→save cannot accumulate
    // one BOM per save.
    let text = if encoding == TextEncoding::Utf8Bom {
        text.trim_start_matches('\u{feff}').to_string()
    } else {
        text
    };
    Ok((text, encoding))
}

/// Best-effort decode for metadata/search: an unreadable legacy file still
/// stays visible in the list (lossy text) and can be found by filename.
pub fn decode_text_lossy(bytes: &[u8]) -> String {
    match decode_note_text(bytes) {
        Ok((text, _)) => text,
        Err(_) => String::from_utf8_lossy(bytes).to_string(),
    }
}

/// Re-encode with the file's original codec. `encoding_rs` replaces
/// unrepresentable characters with numeric entities and flags it; refuse the
/// save instead of silently corrupting a legacy file.
pub fn encode_note_text(text: &str, encoding: TextEncoding) -> Result<Vec<u8>, String> {
    let (encoded, _, had_errors) = encoding.codec().encode(text);
    if had_errors {
        // A GBK file is byte-compatible with GB18030 for its existing
        // repertoire. If the edit adds a four-byte character (e.g. an emoji),
        // upgrade the write to GB18030 instead of refusing it; the next read
        // reports GB18030.
        if encoding == TextEncoding::Gbk {
            let (fallback, _, fallback_errors) = GB18030.encode(text);
            if !fallback_errors {
                return Ok(fallback.into_owned());
            }
        }
        return Err(format!(
            "some characters cannot be represented in {}; convert the file to UTF-8 first",
            encoding.label()
        ));
    }
    let mut out = Vec::with_capacity(encoded.len() + UTF8_BOM.len());
    if encoding == TextEncoding::Utf8Bom {
        out.extend_from_slice(&UTF8_BOM);
    }
    out.extend_from_slice(&encoded);
    Ok(out)
}

/// First non-empty lines of a plain/CSV/JSON note, collapsed for the note
/// list. Data notes deliberately keep their file stem as the title: a CSV
/// header is data, not a document title.
pub fn data_snippet(text: &str, max_chars: usize) -> String {
    let mut out = String::new();
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if !out.is_empty() {
            out.push(' ');
        }
        out.push_str(trimmed);
        if out.chars().count() >= max_chars {
            break;
        }
    }
    let collapsed = out.split_whitespace().collect::<Vec<_>>().join(" ");
    truncate_chars(&collapsed, max_chars)
}

// ---------------- HTML notes ----------------

pub const NOTE_EXTENSIONS: [&str; 6] = ["md", "html", "htm", "csv", "txt", "json"];

/// Kind from the extension (the single source of truth). Renaming a file
/// changes its format, even when the contents still look like another kind.
pub fn note_kind(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .as_deref()
    {
        Some("html" | "htm") => "html",
        Some("csv") => "csv",
        Some("txt") => "txt",
        Some("json") => "json",
        _ => "markdown",
    }
}

pub fn is_note_file_name(name: &str) -> bool {
    Path::new(name)
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| NOTE_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
}

/// Same as `compose_note`, but HTML/CSV/TXT/JSON notes have no front matter:
/// keep the exact body the editor produced (LF-normalized), restore the
/// file's line-ending style, and never inject a `tags:` block. The text was
/// already decoded; `save_note_impl` re-encodes with the original codec and
/// adds back any BOM.
pub fn compose_html(existing: Option<&str>, body: &str) -> String {
    let (bom, line_ending) = match existing {
        Some(text) => {
            let doc = split_document(text);
            (doc.bom, doc.line_ending)
        }
        None => (false, "\n"),
    };
    let normalized = normalize_newlines(body);
    let mut out = String::with_capacity(normalized.len() + 2);
    if bom {
        out.push('\u{feff}');
    }
    if line_ending == "\r\n" {
        out.push_str(&normalized.replace('\n', "\r\n"));
    } else {
        out.push_str(&normalized);
    }
    out
}

pub fn find_ascii_ci(haystack: &str, needle: &str, from: usize) -> Option<usize> {
    let bytes = haystack.as_bytes();
    let needle = needle.as_bytes();
    if needle.is_empty() || from >= bytes.len() || needle.len() > bytes.len() - from {
        return None;
    }
    (from..=bytes.len() - needle.len())
        .find(|&i| bytes[i..i + needle.len()].eq_ignore_ascii_case(needle))
}

/// End byte index of a start tag, honouring quoted attribute values.
pub fn find_tag_end(html: &str, start: usize) -> Option<usize> {
    let bytes = html.as_bytes();
    let mut quote = 0u8;
    let mut i = start;
    while i < bytes.len() {
        let b = bytes[i];
        if quote == 0 {
            match b {
                b'"' | b'\'' => quote = b,
                b'>' => return Some(i),
                _ => {}
            }
        } else if b == quote {
            quote = 0;
        }
        i += 1;
    }
    None
}

/// Decode the handful of named entities plus numeric references that matter
/// for plain-text titles/snippets. Unknown entities are preserved verbatim.
pub fn decode_html_entities(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut rest = raw;
    while let Some(pos) = rest.find('&') {
        out.push_str(&rest[..pos]);
        let tail = &rest[pos..];
        let Some(end) = tail.find(';') else {
            out.push_str(tail);
            return out;
        };
        // An ampersand followed by an implausibly long run is plain text, not
        // an entity; emit it and continue scanning from the next character.
        if end > 12 {
            out.push('&');
            rest = &tail[1..];
            continue;
        }
        let entity = &tail[1..end];
        let decoded = match entity {
            "amp" => Some('&'),
            "lt" => Some('<'),
            "gt" => Some('>'),
            "quot" => Some('"'),
            "apos" | "#39" => Some('\''),
            "nbsp" => Some(' '),
            _ if entity.starts_with("#x") || entity.starts_with("#X") => {
                u32::from_str_radix(&entity[2..], 16)
                    .ok()
                    .and_then(char::from_u32)
            }
            _ if entity.starts_with('#') => {
                entity[1..].parse::<u32>().ok().and_then(char::from_u32)
            }
            _ => None,
        };
        match decoded {
            Some(ch) => {
                out.push(ch);
                rest = &tail[end + 1..];
            }
            None => {
                out.push('&');
                rest = &tail[1..];
            }
        }
    }
    out.push_str(rest);
    out
}

/// Collapse an HTML document to plain text for snippets/search. Skips
/// comments and raw-text elements (`script`, `style`, `head`, …) and inserts a
/// space at block boundaries so adjacent paragraphs do not concatenate.
pub fn html_to_text(html: &str) -> String {
    let mut out = String::with_capacity(html.len() / 2);
    let bytes = html.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'<' {
            // A literal `<` in body text (e.g. `1 < 2`) is not a tag. Only
            // treat it as markup when a plausible tag opener follows.
            let next = bytes.get(i + 1).copied();
            if !next.is_some_and(|b| b.is_ascii_alphabetic() || matches!(b, b'/' | b'!' | b'?')) {
                out.push('<');
                i += 1;
                continue;
            }
            if html[i..].starts_with("<!--") {
                match html[i + 4..].find("-->") {
                    Some(end) => i += 4 + end + 3,
                    None => break,
                }
                continue;
            }
            let Some(end) = find_tag_end(html, i + 1) else {
                break;
            };
            let inner = html[i + 1..end].trim();
            let closing = inner.starts_with('/');
            let name: String = inner
                .trim_start_matches('/')
                .trim_start()
                .chars()
                .take_while(|c| c.is_ascii_alphanumeric())
                .collect();
            let lower = name.to_ascii_lowercase();
            if !closing
                && !inner.ends_with('/')
                && matches!(
                    lower.as_str(),
                    "script" | "style" | "head" | "noscript" | "template"
                )
            {
                let close = format!("</{lower}");
                if let Some(close_at) = find_ascii_ci(html, &close, end + 1)
                    && let Some(gt) = html[close_at..].find('>')
                {
                    i = close_at + gt + 1;
                    if !out.ends_with(' ') {
                        out.push(' ');
                    }
                    continue;
                }
            }
            if matches!(
                lower.as_str(),
                "br" | "p"
                    | "div"
                    | "li"
                    | "tr"
                    | "td"
                    | "th"
                    | "h1"
                    | "h2"
                    | "h3"
                    | "h4"
                    | "h5"
                    | "h6"
                    | "section"
                    | "article"
                    | "header"
                    | "footer"
                    | "blockquote"
                    | "table"
                    | "ul"
                    | "ol"
                    | "pre"
                    | "hr"
            ) && !out.ends_with(' ')
            {
                out.push(' ');
            }
            i = end + 1;
            continue;
        }
        let next = html[i..]
            .find('<')
            .map(|offset| i + offset)
            .unwrap_or(bytes.len());
        for ch in decode_html_entities(&html[i..next]).chars() {
            if ch.is_whitespace() {
                if !out.ends_with(' ') {
                    out.push(' ');
                }
            } else {
                out.push(ch);
            }
        }
        i = next;
    }
    out.trim().to_string()
}

/// Text of the first `<tag …>…</tag>` occurrence, or None.
pub fn extract_html_element_text(html: &str, tag: &str) -> Option<String> {
    let open = format!("<{tag}");
    let close = format!("</{tag}");
    let mut from = 0;
    while let Some(pos) = find_ascii_ci(html, &open, from) {
        let after = pos + open.len();
        let boundary = html
            .as_bytes()
            .get(after)
            .is_none_or(|b| b.is_ascii_whitespace() || *b == b'>' || *b == b'/');
        if !boundary {
            from = after;
            continue;
        }
        let tag_end = find_tag_end(html, after)?;
        let close_at = find_ascii_ci(html, &close, tag_end + 1)?;
        let text = html_to_text(&html[tag_end + 1..close_at]);
        if !text.trim().is_empty() {
            return Some(text.trim().to_string());
        }
        from = close_at + 1;
    }
    None
}

pub fn truncate_chars(s: &str, max_chars: usize) -> String {
    let mut out: String = s.chars().take(max_chars).collect();
    if s.chars().count() > max_chars {
        out.push('…');
    }
    out
}

/// Title + snippet for an HTML note: `<title>` first, then the first `<h1>`,
/// then the file stem. The snippet is visible text, never raw markup.
pub fn html_meta(text: &str, fallback_title: &str) -> (String, String) {
    let title = extract_html_element_text(text, "title")
        .or_else(|| extract_html_element_text(text, "h1"))
        .unwrap_or_else(|| fallback_title.to_string());
    let plain = html_to_text(text);
    (
        truncate_chars(title.trim(), 120),
        truncate_chars(&plain, 100),
    )
}

// ---------------- Text helpers ----------------

pub fn heading_text(line: &str) -> Option<String> {
    let t = line.trim_start();
    let hashes = t.chars().take_while(|c| *c == '#').count();
    if !(1..=6).contains(&hashes) {
        return None;
    }
    let rest = &t[hashes..];
    // CommonMark requires a space (or end of line) after the hashes:
    // `#Title` is plain text, not a heading.
    if !rest.is_empty() && !rest.chars().next().is_some_and(|c| c.is_whitespace()) {
        return None;
    }
    let rest = rest.trim();
    if rest.is_empty() {
        return None;
    }
    let cleaned = rest.trim_end_matches('#').trim().to_string();
    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned)
    }
}

pub fn extract_title(body: &str, fallback: &str) -> String {
    let mut in_fence = false;
    for line in body.lines() {
        let t = line.trim_start();
        if t.starts_with("```") || t.starts_with("~~~") {
            in_fence = !in_fence;
            continue;
        }
        if in_fence {
            continue;
        }
        if let Some(title) = heading_text(line) {
            return title;
        }
    }
    fallback.to_string()
}

/// Remove inline markdown markers for a plain-text snippet.
pub fn strip_inline(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    let mut in_code = false;
    let mut link_text: Option<String> = None;
    let mut is_image = false;
    while let Some(c) = chars.next() {
        if let Some(t) = link_text.as_mut() {
            if c == ']' {
                if !is_image {
                    out.push_str(t);
                }
                link_text = None;
                is_image = false;
                if chars.peek() == Some(&'(') {
                    chars.next();
                    let mut depth = 1u32;
                    for nc in chars.by_ref() {
                        if nc == '(' {
                            depth += 1;
                        } else if nc == ')' {
                            depth -= 1;
                            if depth == 0 {
                                break;
                            }
                        }
                    }
                }
            } else {
                t.push(c);
            }
            continue;
        }
        match c {
            '`' => in_code = !in_code,
            '!' if !in_code => {
                if chars.peek() == Some(&'[') {
                    chars.next();
                    link_text = Some(String::new());
                    is_image = true;
                } else {
                    out.push('!');
                }
            }
            '[' if !in_code => {
                link_text = Some(String::new());
                is_image = false;
            }
            c if !in_code && matches!(c, '*' | '_' | '~' | '>' | '#' | '|') => {}
            c => out.push(c),
        }
    }
    // An unclosed `[` must not swallow the text after it.
    if let Some(t) = link_text
        && !is_image
    {
        out.push_str(&t);
    }
    out
}

/// First few lines of visible body text as a snippet (max_chars chars).
pub fn plain_snippet(body: &str, max_chars: usize) -> String {
    let mut out = String::new();
    let mut in_fence = false;
    let mut in_math = false;
    for line in body.lines() {
        let t = line.trim();
        if t.starts_with("```") || t.starts_with("~~~") {
            in_fence = !in_fence;
            continue;
        }
        if let Some(rest) = t.strip_prefix("$$") {
            // Skip display math instead of showing TeX source in the card.
            if rest.contains("$$") {
                continue; // one-line $$…$$
            }
            in_math = !in_math;
            continue;
        }
        if in_fence || in_math || t.is_empty() {
            continue;
        }
        if heading_text(t).is_some() {
            continue;
        }
        // strip a leading list marker
        let stripped: Option<&str> = t
            .strip_prefix("- ")
            .or_else(|| t.strip_prefix("* "))
            .or_else(|| t.strip_prefix("+ "))
            .or_else(|| {
                let n = t.chars().take_while(|c| c.is_ascii_digit()).count();
                if n == 0 {
                    return None;
                }
                let rest = &t[n..];
                rest.strip_prefix(". ").or_else(|| rest.strip_prefix(") "))
            });
        let s = strip_inline(stripped.unwrap_or(t));
        if s.is_empty() {
            continue;
        }
        if !out.is_empty() {
            out.push(' ');
        }
        out.push_str(&s);
        if out.chars().count() >= max_chars {
            break;
        }
    }
    let chars: Vec<char> = out.chars().collect();
    if chars.len() > max_chars {
        chars[..max_chars].iter().collect::<String>() + "…"
    } else {
        out
    }
}

pub fn mtime_of(path: &Path) -> i64 {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

pub fn content_hash(bytes: &[u8]) -> String {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    bytes.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

/// Read a note's metadata. `rel` is the note's root-relative path (as
/// listed), `full` is the absolute path of the file. Keeping them separate
/// avoids fragile `strip_prefix` comparisons between a user-typed root and
/// a canonicalized path — on Windows `fs::canonicalize` adds a `\\?\`
/// prefix, which silently broke read-back after every save.
/// Upper bound for loading a note into memory (listing, opening, search).
/// The vault is untrusted (synced / downloaded folders): without this, a few
/// multi-GB files freeze the UI on open or abort the process on allocation
/// failure. Files above the cap stay visible by name but are not read.
pub const MAX_NOTE_BYTES: u64 = 64 * 1024 * 1024;

pub fn read_meta(rel: &Path, full: &Path) -> Option<NoteMeta> {
    let rel_s = note_path_string(rel);
    let folder = rel.parent().map(note_path_string).unwrap_or_default();
    let size = fs::metadata(full).ok()?.len();
    if size > MAX_NOTE_BYTES {
        let name = full.file_stem()?.to_string_lossy().to_string();
        return Some(NoteMeta {
            path: rel_s,
            folder,
            title: name,
            tags: Vec::new(),
            snippet: "> 64 MB".into(),
            mtime: mtime_of(full),
            kind: note_kind(full).to_string(),
            encoding: String::new(),
            hash: String::new(),
        });
    }
    let bytes = fs::read(full).ok()?;
    // Keep unsupported-encoding notes visible in the list (instead of
    // silently hiding them); opening one returns a clear encoding error.
    let (text, encoding) = match decode_note_text(&bytes) {
        Ok((text, encoding)) => (text, encoding.label().to_string()),
        Err(_) => (String::from_utf8_lossy(&bytes).to_string(), String::new()),
    };
    let name = full.file_stem()?.to_string_lossy().to_string();
    let kind = note_kind(full);
    let (tags, title, snippet) = match kind {
        "html" => {
            let (title, snippet) = html_meta(&text, &name);
            (Vec::new(), title, snippet)
        }
        "markdown" => {
            let (tags, body) = parse_frontmatter(&text);
            (tags, extract_title(&body, &name), plain_snippet(&body, 100))
        }
        _ => (Vec::new(), name, data_snippet(&text, 100)),
    };
    Some(NoteMeta {
        path: rel_s,
        folder,
        title,
        tags,
        snippet,
        mtime: mtime_of(full),
        kind: kind.to_string(),
        encoding,
        hash: content_hash(&bytes),
    })
}

pub fn sort_note_metas(metas: &mut [NoteMeta]) {
    metas.sort_by(|a, b| {
        b.mtime
            .cmp(&a.mtime)
            .then_with(|| a.title.to_lowercase().cmp(&b.title.to_lowercase()))
            .then_with(|| a.path.cmp(&b.path))
    });
}

pub fn collect_notes(root: &Path) -> Result<Vec<NoteMeta>, String> {
    let mut metas: Vec<NoteMeta> = Vec::new();
    walk(root, root, true, &mut metas, true)?;
    sort_note_metas(&mut metas);
    Ok(metas)
}

/// Notes under `folder` (the vault root when `None`/empty). `recursive`
/// mirrors the sidebar's "include subfolders" switch: off means only files
/// sitting directly in that folder are returned. A folder outside the vault
/// is rejected by `resolve_in_root`.
pub fn collect_notes_scoped(
    root: &Path,
    folder: Option<&str>,
    recursive: bool,
) -> Result<Vec<NoteMeta>, String> {
    let scope = folder.unwrap_or("").trim_matches('/');
    let scan_root = canonical_root(root)?;
    let dir = if scope.is_empty() {
        scan_root.clone()
    } else {
        resolve_in_root(&scan_root, scope)?
    };
    if !dir.is_dir() {
        return Err("not a directory".into());
    }
    let mut metas: Vec<NoteMeta> = Vec::new();
    walk(&dir, &scan_root, recursive, &mut metas, true)?;
    sort_note_metas(&mut metas);
    Ok(metas)
}

pub fn walk(
    dir: &Path,
    root: &Path,
    recursive: bool,
    out: &mut Vec<NoteMeta>,
    fatal: bool,
) -> Result<(), String> {
    // A denied subdirectory (e.g. `System Volume Information` when a drive
    // root is the vault) must not hide every note in the vault. The scan
    // start itself is fatal; unreadable descendants are skipped.
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(e) if fatal => return Err(e.to_string()),
        Err(_) => return Ok(()),
    };
    for entry in entries {
        let Ok(entry) = entry else {
            continue;
        };
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        // The note protocol uses `/` as its separator. On Unix a backslash is
        // a legal filename character but cannot be represented unambiguously
        // in that protocol, so skip it instead of opening a different path.
        let ambiguous_unix_separator = cfg!(not(windows)) && name.contains('\\');
        if name.starts_with('.') || ambiguous_unix_separator {
            continue;
        }
        // Never follow symlinks/junctions: a directory junction can loop
        // forever or expose notes outside the vault, and a symlinked file is
        // not a note that `resolve_in_root` would let the user open.
        if is_link_or_reparse(&path) {
            continue;
        }
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_dir() {
            if recursive {
                // Descendant failures are non-fatal; see above.
                let _ = walk(&path, root, recursive, out, false);
            }
        } else if file_type.is_file()
            && is_note_file_name(&name)
            && let Ok(rel) = path.strip_prefix(root)
            && let Some(meta) = read_meta(rel, &path)
        {
            out.push(meta);
        }
    }
    Ok(())
}

pub fn collect_folders(root: &Path) -> Result<Vec<String>, String> {
    let mut out = Vec::new();
    walk_folders(root, root, &mut out, true)?;
    out.sort_by(|a, b| {
        a.to_lowercase()
            .cmp(&b.to_lowercase())
            .then_with(|| a.cmp(b))
    });
    Ok(out)
}

pub fn walk_folders(
    dir: &Path,
    root: &Path,
    out: &mut Vec<String>,
    fatal: bool,
) -> Result<(), String> {
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(e) if fatal => return Err(e.to_string()),
        Err(_) => return Ok(()),
    };
    for entry in entries {
        let Ok(entry) = entry else {
            continue;
        };
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let ambiguous_unix_separator = cfg!(not(windows)) && name.contains('\\');
        if name.starts_with('.') || ambiguous_unix_separator || is_link_or_reparse(&path) {
            continue;
        }
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_dir() {
            if let Ok(rel) = path.strip_prefix(root) {
                out.push(note_path_string(rel));
            }
            let _ = walk_folders(&path, root, out, false);
        }
    }
    Ok(())
}

pub fn sanitize_filename(s: &str) -> String {
    const INVALID: [char; 9] = ['<', '>', ':', '"', '|', '?', '*', '\\', '/'];
    let cleaned: String = s
        .chars()
        .filter(|c| !INVALID.contains(c) && !c.is_control())
        .collect();
    // Leading dots would make the note invisible to `walk`; trailing dots and
    // spaces are invalid on Windows. Check the stem before the extension:
    // Windows reserves `CON`/`NUL`/`COM1` even when a suffix such as `.md` is
    // appended.
    let trimmed = cleaned
        .trim()
        .trim_start_matches(['.', ' '])
        .trim_end_matches(['.', ' ']);
    let reserved = matches!(
        trimmed
            .split('.')
            .next()
            .unwrap_or("")
            .to_ascii_uppercase()
            .as_str(),
        "CON"
            | "PRN"
            | "AUX"
            | "NUL"
            | "COM1"
            | "COM2"
            | "COM3"
            | "COM4"
            | "COM5"
            | "COM6"
            | "COM7"
            | "COM8"
            | "COM9"
            | "LPT1"
            | "LPT2"
            | "LPT3"
            | "LPT4"
            | "LPT5"
            | "LPT6"
            | "LPT7"
            | "LPT8"
            | "LPT9"
    );
    if trimmed.is_empty() {
        "untitled".to_string()
    } else if reserved {
        format!("_{trimmed}")
    } else {
        trimmed.to_string()
    }
}

// ---------------- Atomic writes ----------------

pub static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Write via a sibling temp file + rename so a crash mid-write cannot leave a
/// half-truncated note. Windows `fs::rename` replaces an existing file
/// (MoveFileEx semantics), so this works for both new and existing notes.
pub fn atomic_write(path: &Path, data: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "no parent directory".to_string())?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    // Do NOT embed the target file name: a valid 253-character note name
    // leaves no room for the suffix within the 255-unit filename limit, so
    // every save of that note would fail. The pid+counter temp name is unique
    // within the process and create_new retries on collision.
    let mut last_err: Option<String> = None;
    for attempt in 0..5u32 {
        let tmp = parent.join(format!(
            ".rustmd-tmp-{}-{}-{attempt}",
            std::process::id(),
            TEMP_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        let mut file = match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&tmp)
        {
            Ok(f) => f,
            Err(e) if e.kind() == ErrorKind::AlreadyExists => {
                last_err = Some(e.to_string());
                continue;
            }
            Err(e) => return Err(e.to_string()),
        };
        let write_result = file.write_all(data).and_then(|_| file.sync_all());
        drop(file);
        if let Err(e) = write_result {
            let _ = fs::remove_file(&tmp);
            return Err(e.to_string());
        }
        // Keep the target's Unix mode across the temp-file + rename replace.
        // (Windows ACLs and macOS xattrs are not copied; documented boundary.)
        #[cfg(unix)]
        if let Ok(metadata) = fs::metadata(path) {
            let _ = fs::set_permissions(&tmp, metadata.permissions());
        }
        match fs::rename(&tmp, path) {
            Ok(()) => return Ok(()),
            Err(e) => {
                let _ = fs::remove_file(&tmp);
                last_err = Some(e.to_string());
                // Antivirus/indexers can briefly hold a freshly-created file
                // on Windows; retry with a short backoff before giving up.
                std::thread::sleep(Duration::from_millis(20 * u64::from(attempt + 1)));
            }
        }
    }
    Err(last_err.unwrap_or_else(|| "failed to write file".to_string()))
}
