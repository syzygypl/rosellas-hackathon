/** Escape &, <, > so arbitrary text can be embedded in generated HTML. */
export function escapeHtml(value: string): string {
  return (value ?? '').replace(
    /[&<>]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!,
  );
}

/**
 * Minimal markdown for bot answers: headers, bold, code, bullet lists.
 * The source is escaped first, so the output contains only tags produced here.
 */
export function renderMarkdownHtml(value: string): string {
  let html = escapeHtml(value);
  html = html
    .replace(/^#{1,3} (.*)$/gm, '<h4>$1</h4>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^\s*(?:[-•*]|\d+\.) (.*)$/gm, '<li>$1</li>');
  html = html.replace(
    /(?:<li>.*?<\/li>\n?)+/gs,
    (m) => '<ul>' + m.replace(/\n/g, '') + '</ul>',
  );
  return html.replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
}
