import { escapeHtml, renderMarkdownHtml, stripMarkdownToPlainText } from './markdown.util';

describe('escapeHtml', () => {
  it('escapes &, < and >', () => {
    expect(escapeHtml('<b>&</b>')).toBe('&lt;b&gt;&amp;&lt;/b&gt;');
  });
});

describe('renderMarkdownHtml', () => {
  it('escapes raw HTML instead of rendering it', () => {
    expect(renderMarkdownHtml('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;',
    );
  });

  it('renders bold, inline code and headers', () => {
    expect(renderMarkdownHtml('**mocna**')).toBe('<strong>mocna</strong>');
    expect(renderMarkdownHtml('`kod`')).toBe('<code>kod</code>');
    expect(renderMarkdownHtml('## Tytuł')).toBe('<h4>Tytuł</h4>');
  });

  it('wraps consecutive bullet lines into a single list', () => {
    expect(renderMarkdownHtml('- pierwszy\n- drugi')).toBe(
      '<ul><li>pierwszy</li><li>drugi</li></ul>',
    );
    expect(renderMarkdownHtml('1. a\n2. b')).toBe('<ul><li>a</li><li>b</li></ul>');
  });

  it('turns blank lines into paragraph breaks and newlines into breaks', () => {
    expect(renderMarkdownHtml('akapit pierwszy\n\nakapit drugi')).toBe(
      'akapit pierwszy<br><br>akapit drugi',
    );
    expect(renderMarkdownHtml('linia\ndruga')).toBe('linia<br>druga');
  });
});

describe('stripMarkdownToPlainText', () => {
  it('unwraps headers, bold, code, links and list markers', () => {
    expect(
      stripMarkdownToPlainText('## Tytuł\n**mocna** teza z `kodem`\n- pierwszy\n1. drugi'),
    ).toBe('Tytuł mocna teza z kodem pierwszy drugi');
    expect(stripMarkdownToPlainText('Zobacz [dokument](https://example.com).')).toBe(
      'Zobacz dokument.',
    );
  });

  it('removes emoji and table pipes', () => {
    expect(stripMarkdownToPlainText('Cześć! 👋 Zaczynajmy 🚀')).toBe('Cześć! Zaczynajmy');
    expect(stripMarkdownToPlainText('| a | b |')).toBe('a b');
  });

  it('joins paragraphs into sentence pauses without doubling punctuation', () => {
    expect(stripMarkdownToPlainText('Pierwszy akapit.\n\nDrugi akapit')).toBe(
      'Pierwszy akapit. Drugi akapit',
    );
    expect(stripMarkdownToPlainText('bez kropki\n\ndalszy ciąg')).toBe('bez kropki. dalszy ciąg');
  });
});
