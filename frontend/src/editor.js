import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { markdown, markdownLanguage, markdownKeymap } from '@codemirror/lang-markdown';
import { html as htmlLanguage } from '@codemirror/lang-html';
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
  // HTML notes: tags / attributes / values get explicit colors instead of
  // relying on the base editor theme (the custom Markdown style otherwise
  // makes HTML source look almost uniform).
  { tag: t.tagName, color: 'var(--hl-tag)' },
  { tag: t.attributeName, color: 'var(--hl-attr)' },
  { tag: t.attributeValue, color: 'var(--hl-string)' },
  { tag: t.angleBracket, color: 'var(--text-faint)' },
  // Nested JavaScript/CSS inside HTML <script>/<style>. The HTML package
  // parses those regions with the JS/CSS parsers, but our custom highlight
  // style has to give their tags colors too — otherwise the script body is
  // one uniform color.
  {
    tag: [
      t.keyword,
      t.controlKeyword,
      t.definitionKeyword,
      t.moduleKeyword,
      t.operatorKeyword,
      t.modifier,
      t.self,
    ],
    color: 'var(--hl-keyword)',
  },
  {
    tag: [t.string, t.special(t.string), t.regexp, t.escape],
    color: 'var(--hl-string)',
  },
  { tag: [t.variableName, t.propertyName], color: 'var(--hl-var)' },
  {
    tag: [
      t.function(t.variableName),
      t.function(t.propertyName),
      t.definition(t.variableName),
    ],
    color: 'var(--hl-func)',
  },
  {
    tag: [t.className, t.typeName, t.namespace],
    color: 'var(--hl-class)',
  },
  {
    tag: [t.operator, t.punctuation, t.bracket, t.separator, t.derefOperator],
    color: 'var(--hl-punct)',
  },
  {
    tag: [t.atom, t.unit, t.color],
    color: 'var(--hl-number)',
  },
  { tag: [t.meta, t.annotation], color: 'var(--hl-comment)' },
]);

/** Language + keymap for a note kind. Swapped per note via a Compartment, so
 * opening an HTML page does not keep Markdown list/Enter behavior. */
function languageExtension(kind) {
  return kind === 'html'
    ? [htmlLanguage()]
    : [
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        keymap.of(markdownKeymap),
      ];
}

export function createEditor(holder, { onChange }) {
  const languageCompartment = new Compartment();
  const wrapCompartment = new Compartment();
  const state = EditorState.create({
    doc: '',
    extensions: [
      basicSetup,
      languageCompartment.of(languageExtension('markdown')),
      wrapCompartment.of(EditorView.lineWrapping),
      theme, // already an extension array from EditorView.theme() — don't re-wrap
      syntaxHighlighting(highlight),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) onChange();
      }),
    ],
  });
  const view = new EditorView({ state, parent: holder });
  view.noteKind = 'markdown';
  view.wrapEnabled = true;
  /** Toggle soft wrapping without touching the document/undo history. */
  view.setLineWrapping = (enabled) => {
    if (view.wrapEnabled === enabled) return;
    view.wrapEnabled = enabled;
    view.dispatch({
      effects: wrapCompartment.reconfigure(
        enabled ? EditorView.lineWrapping : []
      ),
    });
  };
  /** Switch syntax highlighting without touching the document/undo history. */
  view.setLanguage = (kind) => {
    if (view.noteKind === kind) return;
    view.noteKind = kind;
    view.dispatch({
      effects: languageCompartment.reconfigure(languageExtension(kind)),
    });
  };
  return view;
}
