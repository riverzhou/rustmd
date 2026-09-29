import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { markdown, markdownLanguage, markdownKeymap } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

const theme = EditorView.theme({
  '&': {
    color: 'var(--cm-fg)',
    backgroundColor: 'var(--cm-bg)',
    fontSize: '14.5px',
    height: '100%',
  },
  '.cm-scroller': {
    fontFamily:
      '"Cascadia Code", "JetBrains Mono", "Fira Code", Consolas, "Courier New", monospace',
    lineHeight: '1.7',
  },
  '.cm-content': {
    caretColor: 'var(--accent)',
    padding: '20px 0',
  },
  '.cm-line': {
    padding: '0 20px',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection':
    {
      backgroundColor: 'var(--cm-selection) !important',
    },
  '.cm-cursor': {
    borderLeftColor: 'var(--accent)',
    borderLeftWidth: '2px',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--cm-active-line)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
  },
  '.cm-selectionMatch': {
    backgroundColor: 'var(--cm-selection)',
  },
  '.cm-gutters': {
    display: 'none',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--code-bg)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
  },
  '.cm-panels': {
    backgroundColor: 'var(--code-bg)',
    color: 'var(--text)',
  },
});

const highlight = HighlightStyle.define([
  { tag: [t.heading, t.strong], fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.monospace, fontFamily: 'var(--font-mono)' },
  { tag: [t.comment, t.quote], color: 'var(--hl-comment)', fontStyle: 'italic' },
  { tag: t.link, color: 'var(--hl-link)', textDecoration: 'underline' },
  { tag: t.url, color: 'var(--hl-link)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--hl-number)' },
  { tag: [t.contentSeparator, t.processingInstruction], color: 'var(--text-faint)' },
  { tag: t.list, color: 'var(--accent)' },
]);

export function createEditor(holder, { onChange }) {
  const state = EditorState.create({
    doc: '',
    extensions: [
      basicSetup,
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      keymap.of(markdownKeymap),
      EditorView.lineWrapping,
      theme, // already an extension array from EditorView.theme() — don't re-wrap
      syntaxHighlighting(highlight),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) onChange();
      }),
    ],
  });
  const view = new EditorView({ state, parent: holder });
  return view;
}
