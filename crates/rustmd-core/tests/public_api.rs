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
