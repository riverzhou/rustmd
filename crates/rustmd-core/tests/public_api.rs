// SPDX-License-Identifier: MIT OR Apache-2.0
//
// Integration tests that only touch the public surface, i.e. exactly what an
// external consumer can call. They also prove the crate is usable standalone
// (no Tauri, no desktop assumptions).

use rustmd_core::*;
use std::path::Path;

#[test]
fn note_kind_maps_every_supported_extension() {
    assert_eq!(note_kind(Path::new("a.md")), "markdown");
    assert_eq!(note_kind(Path::new("a.HTM")), "html");
    assert_eq!(note_kind(Path::new("dir/a.csv")), "csv");
    assert_eq!(note_kind(Path::new("a.txt")), "txt");
    assert_eq!(note_kind(Path::new("a.json")), "json");
}

#[test]
fn gbk_round_trips_through_decode_and_encode() {
    // "中文" in GBK.
    let gbk = [0xD6u8, 0xD0, 0xCE, 0xC4];
    let (text, encoding) = decode_note_text(&gbk).expect("GBK must decode");
    assert_eq!(text, "中文");
    assert_eq!(encoding.label(), "GBK");
    assert_eq!(encode_note_text(&text, encoding).expect("must encode"), gbk);
}

#[test]
fn utf8_bom_is_detected_and_restored() {
    let mut bytes = vec![0xEF, 0xBB, 0xBF];
    bytes.extend_from_slice("body".as_bytes());
    let (text, encoding) = decode_note_text(&bytes).expect("BOM must decode");
    assert_eq!(text, "body");
    assert_eq!(encoding.label(), "UTF-8 BOM");
    assert_eq!(
        encode_note_text(&text, encoding).expect("must encode"),
        bytes
    );
}

#[test]
fn compose_note_keeps_unknown_fields_and_crlf() {
    let existing = "---\r\ntitle: keep me\r\ntags: [old]\r\n---\r\nbody\r\n";
    let out = compose_note(Some(existing), &["new".to_string()], "body");
    assert!(
        out.contains("title: keep me"),
        "unknown field was dropped: {out}"
    );
    assert!(out.contains("new"), "tag was not written: {out}");
    assert!(!out.contains("[old]"), "old tag survived: {out}");
    assert!(out.contains("\r\n"), "CRLF line endings were not preserved");
}

#[test]
fn resolve_in_root_rejects_traversal() {
    let root = std::env::temp_dir();
    let err = resolve_in_root(&root, "../etc/passwd").unwrap_err();
    assert!(!err.is_empty(), "traversal must be rejected");
}

#[test]
fn html_to_text_strips_markup() {
    let plain = html_to_text("<p>hello <b>world</b></p>");
    assert!(plain.contains("hello"), "{plain}");
    assert!(plain.contains("world"), "{plain}");
    assert!(!plain.contains('<'), "markup survived: {plain}");
}

// --- front matter: streaming, terminator and separator round-trip ----------

#[test]
fn split_document_preserves_the_terminator_form() {
    let doc = split_document("---\ntags: a\n...\nbody\n");
    assert_eq!(doc.terminator, "...");
    let out = compose_note(Some("---\ntags: a\n...\nbody\n"), &["a".into()], "body\n");
    assert!(
        out.contains("..."),
        "the `...` terminator was rewritten: {out}"
    );
    assert!(
        !out.contains("\n---\n"),
        "unexpected second delimiter: {out}"
    );
}

#[test]
fn compose_note_does_not_force_a_trailing_newline() {
    let existing = "---\ntags: a\n---\nbody";
    let out = compose_note(Some(existing), &["a".into()], "body");
    assert!(out.ends_with("body"), "trailing newline was added: {out:?}");
}

#[test]
fn front_matter_separator_is_normalized_to_one_blank_line() {
    let existing = "---\ntags: a\n---\n\n\n\nbody\n";
    let out = compose_note(Some(existing), &["a".into()], "body\n");
    assert_eq!(out, "---\ntags: [\"a\"]\n---\n\nbody\n");
}

#[test]
fn split_document_handles_a_line_heavy_file_without_blowing_up() {
    // The old implementation collected every line into a Vec before looking
    // for the closing delimiter; this 4 MB body (~1M lines) must stay cheap.
    let mut text = String::with_capacity(4 * 1024 * 1024 + 32);
    text.push_str("---\ntags: a\n---\n");
    while text.len() < 4 * 1024 * 1024 {
        text.push_str("x\n");
    }
    let doc = split_document(&text);
    assert_eq!(
        doc.frontmatter.as_deref(),
        Some(&["tags: a".to_string()][..])
    );
    assert_eq!(doc.body.len(), text.len() - "---\ntags: a\n---\n".len());
}

// --- tags -----------------------------------------------------------------

#[test]
fn parse_tags_dedupes_bounds_and_handles_apostrophes() {
    let lines: Vec<String> = ["tags: [a, a, 'b c']", "tags: it's # not a comment"]
        .iter()
        .map(|s| s.to_string())
        .collect();
    let tags = parse_tags(&lines);
    assert_eq!(tags[0], "a");
    assert_eq!(tags[1], "b c");
    assert!(
        tags.iter().any(|t| t == "it's"),
        "apostrophe tag lost: {tags:?}"
    );
    assert!(
        !tags.iter().any(|t| t.contains('#')),
        "comment kept: {tags:?}"
    );

    let many: Vec<String> = std::iter::once("tags:".to_string())
        .chain((0..1500).map(|i| format!("  - t{i}")))
        .collect();
    let tags = parse_tags(&many);
    assert_eq!(tags.len(), 1000, "tag count must be bounded");
}

#[test]
fn set_tags_in_lines_rewrites_duplicate_keys() {
    let mut lines: Vec<String> = ["tags: [a]", "tags: [b]", "title: t"]
        .iter()
        .map(|s| s.to_string())
        .collect();
    set_tags_in_lines(&mut lines, &["c".to_string()]);
    assert_eq!(lines, vec!["tags: [\"c\"]", "title: t"]);
    set_tags_in_lines(&mut lines, &[]);
    assert_eq!(lines, vec!["title: t"]);
}

// --- HTML helpers: bounded scanning and honest titles ---------------------

#[test]
fn html_to_text_handles_unclosed_raw_text_without_rescanning() {
    let html = "<script>".repeat(20_000);
    let text = html_to_text(&html);
    assert!(
        text.is_empty(),
        "unclosed script must hide its body: {text:?}"
    );

    let entities = format!("{};", "&".repeat(100_000));
    let text = html_to_text(&entities);
    assert!(text.contains('&'), "ampersands must survive");
}

#[test]
fn html_title_ignores_comments_and_scripts() {
    let html = "<!-- <title>Fake</title> --><script>const t = '<title>AlsoFake</title>';</script>\
                <title>Real</title>";
    let (title, _) = html_meta(html, "fallback");
    assert_eq!(title, "Real");
}

// --- Markdown title/snippet rules ----------------------------------------

#[test]
fn heading_text_keeps_sharp_signs_and_skips_indented_code() {
    assert_eq!(heading_text("# C#").as_deref(), Some("C#"));
    assert_eq!(heading_text("## Title ##").as_deref(), Some("Title"));
    assert_eq!(heading_text("    # indented code"), None);
    assert_eq!(heading_text("\t# tabbed code"), None);
}

#[test]
fn extract_title_tracks_the_fence_marker() {
    let body = "```\n~~~\n# fake\n```\n# Real\n";
    assert_eq!(extract_title(body, "fallback"), "Real");
}

#[test]
fn plain_snippet_ignores_display_math_inside_a_fence() {
    let body = "```\n$$\ncode\n```\n\nReal text\n";
    assert_eq!(plain_snippet(body, 100), "Real text");
    assert!(plain_snippet(body, 4).ends_with('…'));
}

// --- filenames and snippets ----------------------------------------------

#[test]
fn sanitize_filename_rejects_reserved_windows_names() {
    assert_eq!(sanitize_filename("CON"), "_CON");
    assert_eq!(sanitize_filename("conin$.md"), "_conin$.md");
    assert_eq!(sanitize_filename("  ...  "), "untitled");
    let long = "a".repeat(400);
    assert!(sanitize_filename(&long).chars().count() <= 201);
}

#[test]
fn data_snippet_caps_characters_without_scanning_the_whole_line() {
    let text = "x".repeat(1_000_000);
    let snippet = data_snippet(&text, 100);
    assert_eq!(snippet.chars().count(), 101); // 100 chars + ellipsis
}
