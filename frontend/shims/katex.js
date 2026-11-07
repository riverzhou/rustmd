// Mermaid 12 has an optional KaTeX code path (`await import("katex")`) for
// math inside diagrams. This app renders note math with MathJax, so we alias
// KaTeX to this stub instead of shipping an unused ~260 KB dependency.
// It only throws if a mermaid diagram actually asks for KaTeX math.
const unsupported = () => {
  throw new Error('KaTeX is not bundled; note math is rendered with MathJax.');
};

export const render = unsupported;
export const renderToString = unsupported;

export default {
  version: '0.0.0-stub',
  render,
  renderToString,
};
