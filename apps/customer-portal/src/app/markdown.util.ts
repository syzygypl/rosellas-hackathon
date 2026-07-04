/** Escape &, <, > so arbitrary text can be embedded in generated HTML. */
export function escapeHtml(value: string): string {
  return (value ?? '').replace(
    /[&<>]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!,
  );
}

/**
 * Flatten bot markdown to plain speakable text for TTS: the same minimal
 * dialect renderMarkdownHtml handles, plus links, emoji and table pipes.
 */
export function stripMarkdownToPlainText(value: string): string {
  let text = (value ?? '')
    .replace(/^#{1,3} +/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(?:[-•*]|\d+\.) +/gm, '')
    .replace(/^\s*>+ ?/gm, '')
    .replace(/\|/g, ' ')
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '');
  // Paragraph breaks become sentence pauses; avoid doubling end punctuation.
  text = text
    .replace(/([.!?…:])\s*\n{2,}/g, '$1 ')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
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
