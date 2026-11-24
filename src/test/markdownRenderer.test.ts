/**
 * Unit Tests for Markdown Renderer
 *
 * Tests the createRenderer function and the MarkdownRenderer interface.
 * Covers standard markdown elements, GFM features, empty input, and
 * relative image path resolution via renderWithBase.
 *
 * Requirements covered: 2.1, 2.2, 2.3, 2.4
 */

import { expect } from 'chai';
import { createRenderer } from '../markdownRenderer';

describe('Markdown Renderer', function () {
  const renderer = createRenderer();

  // --- Requirement 2.1: Standard markdown to HTML ---

  describe('Standard Markdown Elements', function () {
    it('should render h1 through h6 headings', function () {
      expect(renderer.render('# H1')).to.contain('<h1>H1</h1>');
      expect(renderer.render('## H2')).to.contain('<h2>H2</h2>');
      expect(renderer.render('### H3')).to.contain('<h3>H3</h3>');
      expect(renderer.render('#### H4')).to.contain('<h4>H4</h4>');
      expect(renderer.render('##### H5')).to.contain('<h5>H5</h5>');
      expect(renderer.render('###### H6')).to.contain('<h6>H6</h6>');
    });

    it('should render paragraphs', function () {
      const html = renderer.render('This is a paragraph.');
      expect(html).to.contain('<p>This is a paragraph.</p>');
    });

    it('should render unordered lists', function () {
      const md = '- Item A\n- Item B\n- Item C';
      const html = renderer.render(md);
      expect(html).to.contain('<ul>');
      expect(html).to.contain('<li>Item A</li>');
      expect(html).to.contain('<li>Item B</li>');
      expect(html).to.contain('<li>Item C</li>');
      expect(html).to.contain('</ul>');
    });

    it('should render ordered lists', function () {
      const md = '1. First\n2. Second\n3. Third';
      const html = renderer.render(md);
      expect(html).to.contain('<ol>');
      expect(html).to.contain('<li>First</li>');
      expect(html).to.contain('<li>Second</li>');
      expect(html).to.contain('<li>Third</li>');
      expect(html).to.contain('</ol>');
    });

    it('should render links', function () {
      const html = renderer.render('[Example](https://example.com)');
      expect(html).to.contain('<a href="https://example.com">Example</a>');
    });

    it('should render images', function () {
      const html = renderer.render('![Alt text](https://example.com/img.png)');
      expect(html).to.contain('<img');
      expect(html).to.contain('src="https://example.com/img.png"');
      expect(html).to.contain('alt="Alt text"');
    });
  });

  // --- Requirement 2.2: GFM elements ---

  describe('GitHub Flavored Markdown Elements', function () {
    it('should render tables', function () {
      const md = [
        '| Header 1 | Header 2 |',
        '| -------- | -------- |',
        '| Cell 1   | Cell 2   |',
      ].join('\n');
      const html = renderer.render(md);
      expect(html).to.contain('<table>');
      expect(html).to.contain('<th>Header 1</th>');
      expect(html).to.contain('<th>Header 2</th>');
      expect(html).to.contain('<td>Cell 1</td>');
      expect(html).to.contain('<td>Cell 2</td>');
      expect(html).to.contain('</table>');
    });

    it('should render task lists with checkboxes', function () {
      const md = '- [ ] Unchecked\n- [x] Checked';
      const html = renderer.render(md);
      expect(html).to.contain('<input');
      expect(html).to.contain('type="checkbox"');
      // The checked item should have the checked attribute
      expect(html).to.match(/checked/i);
    });

    it('should render strikethrough text', function () {
      const html = renderer.render('~~deleted text~~');
      expect(html).to.contain('<s>deleted text</s>');
    });

    it('should render fenced code blocks', function () {
      const md = '```javascript\nconst x = 1;\n```';
      const html = renderer.render(md);
      expect(html).to.contain('<pre class="hljs">');
      expect(html).to.contain('<code');
      // highlight.js wraps keywords/numbers in spans, so check for the parts
      expect(html).to.contain('const');
      expect(html).to.contain('x = ');
      expect(html).to.contain('1');
    });
  });

  // --- Requirement 2.4: Empty input ---

  describe('Empty Input', function () {
    it('should return empty string for empty input', function () {
      expect(renderer.render('')).to.equal('');
    });

    it('should return empty string for undefined-like falsy input', function () {
      // The implementation checks !markdown, so null/undefined would also return ''
      expect(renderer.render(null as unknown as string)).to.equal('');
      expect(renderer.render(undefined as unknown as string)).to.equal('');
    });
  });

  // --- Requirement 2.3: Relative image path resolution ---

  describe('renderWithBase - Relative Image Path Resolution', function () {
    it('should resolve relative image paths against the base path', function () {
      const md = '![logo](./images/logo.png)';
      const html = renderer.renderWithBase(md, '/workspace/project');
      expect(html).to.contain('src="/workspace/project/images/logo.png"');
    });

    it('should resolve bare relative image paths (no ./ prefix)', function () {
      const md = '![icon](assets/icon.svg)';
      const html = renderer.renderWithBase(md, '/workspace/project');
      expect(html).to.contain('src="/workspace/project/assets/icon.svg"');
    });

    it('should not modify absolute http image URLs', function () {
      const md = '![photo](https://example.com/photo.jpg)';
      const html = renderer.renderWithBase(md, '/workspace/project');
      expect(html).to.contain('src="https://example.com/photo.jpg"');
    });

    it('should not modify data URI images', function () {
      const md = '![pixel](data:image/png;base64,abc123)';
      const html = renderer.renderWithBase(md, '/workspace/project');
      expect(html).to.contain('src="data:image/png;base64,abc123"');
    });

    it('should return empty string for empty input with renderWithBase', function () {
      expect(renderer.renderWithBase('', '/workspace')).to.equal('');
    });

    it('should handle multiple images in the same document', function () {
      const md = '![a](img/a.png)\n\n![b](img/b.png)';
      const html = renderer.renderWithBase(md, '/root');
      expect(html).to.contain('src="/root/img/a.png"');
      expect(html).to.contain('src="/root/img/b.png"');
    });
  });

  describe('renderFragment', function () {
    const PART = 'diff-added-part';
    const table = '| Name | Value |\n|---|---|\n| a | 1 |\n| b | 2 |';
    const marked = (lines: number[]) => ({ lines, className: PART });
    const renderMarked = (markdown: string, lines: number[]) =>
      renderer.renderFragment(markdown, renderer.createDocumentContext(markdown), marked(lines));

    it('adds the class to the table row on a changed line', function () {
      const html = renderMarked(table, [3]);

      expect(html).to.contain(`<tr class="${PART}">\n<td>b</td>`);
      expect(html.match(/diff-added-part/g)).to.have.length(1);
    });

    it('adds the class to the header row when the header changed', function () {
      const html = renderMarked(table, [0]);

      expect(html).to.contain(`<tr class="${PART}">\n<th>Name</th>`);
    });

    it('adds the class to the item of a tight list', function () {
      const html = renderMarked('- one\n- two\n- three', [1]);

      expect(html).to.contain(`<li class="${PART}">two</li>`);
      expect(html.match(/diff-added-part/g)).to.have.length(1);
    });

    it('adds the class to the paragraph inside a blockquote', function () {
      const html = renderMarked('> first\n>\n> second', [2]);

      expect(html).to.contain(`<p class="${PART}">second</p>`);
      expect(html).to.contain('<p>first</p>');
    });

    it('wraps a changed fenced code block in a div with the class', function () {
      const html = renderMarked('Intro.\n\n```\ncode\n```', [3]);

      expect(html).to.match(new RegExp(`<div class="${PART}"><pre class="hljs">`));
      expect(html).to.contain('<p>Intro.</p>');
    });

    it('renders like render() without marks', function () {
      const context = renderer.createDocumentContext(table);

      expect(renderer.renderFragment(table, context)).to.equal(renderer.render(table));
    });

    it('returns an empty string for empty input', function () {
      expect(renderMarked('', [0])).to.equal('');
    });

    describe('in the context of the whole document', function () {
      const documentMarkdown = [
        'See [the docs][docs].[^a]',
        '',
        'More.[^b]',
        '',
        '[docs]: https://example.com/docs',
        '',
        '[^a]: Note a.',
        '[^b]: Note b.',
        '[^unused]: Never referenced.',
      ].join('\n');
      const context = renderer.createDocumentContext(documentMarkdown);

      it('resolves a reference link defined in another fragment', function () {
        const html = renderer.renderFragment('See [the docs][docs].[^a]', context);

        expect(html).to.contain('<a href="https://example.com/docs">the docs</a>');
      });

      it('numbers a footnote reference like the whole document does', function () {
        const html = renderer.renderFragment('More.[^b]', context);

        expect(html).to.contain('<a href="#fn2" id="fnref2">[2]</a>');
        expect(html).not.to.contain('footnotes-sep');
      });

      it('renders a footnote definition in place with its document number', function () {
        const html = renderer.renderFragment('[^b]: Note b.', context);

        expect(html).to.contain('<ol class="footnotes-list" start="2">');
        expect(html).to.contain('<li id="fn2" class="footnote-item"><p>Note b.</p>');
      });

      it('marks the changed paragraph of a footnote definition', function () {
        const html = renderer.renderFragment('[^a]: Note a.\n[^b]: Note b.', context, marked([1]));

        expect(html).to.contain(`<p class="${PART}">Note b.</p>`);
        expect(html).to.contain('<p>Note a.</p>');
      });

      it('renders an unreferenced footnote definition without a number', function () {
        const html = renderer.renderFragment('[^unused]: Never referenced.', context);

        expect(html).to.contain('<ul class="footnotes-list">');
        expect(html).to.contain('Never referenced.');
      });

      it('still lists inline footnotes after the fragment', function () {
        const fragment = 'Text.^[Inline note.] More.[^b]';

        const html = renderer.renderFragment(fragment, context);

        expect(html).to.contain('<a href="#fn1" id="fnref1">[1]</a>');
        expect(html).to.contain('<a href="#fn2" id="fnref2">[2]</a>');
        expect(html).to.contain('<li id="fn1" class="footnote-item"><p>Inline note.');
        expect(html.match(/footnote-item/g)).to.have.length(1);
      });
    });
  });

  describe('render', function () {
    it('collects footnotes at the end of a whole document', function () {
      const html = renderer.render('Text.[^a]\n\n[^a]: Note.\n\nAfter.');

      expect(html.indexOf('After.')).to.be.lessThan(html.indexOf('Note.'));
      expect(html).to.contain('footnotes-sep');
    });
  });

  describe('topLevelBlockRanges', function () {
    it('returns one range per top-level block', function () {
      const md = '# Title\n\n| a |\n|---|\n| 1 |\n\n- x\n- y\n\n```js\ncode\n```';

      const ranges = renderer.topLevelBlockRanges(md);

      // markdown-it counts the blank line after a list as part of the list
      expect(ranges).to.deep.equal([
        { start: 0, end: 1 },
        { start: 2, end: 5 },
        { start: 6, end: 9 },
        { start: 9, end: 12 },
      ]);
    });

    it('returns one range for a footnote definition with several paragraphs', function () {
      const md = 'Text.[^a]\n\n[^a]: First.\n\n    Second.';

      expect(renderer.topLevelBlockRanges(md)).to.deep.equal([
        { start: 0, end: 1 },
        { start: 2, end: 5 },
      ]);
    });

    it('returns no ranges for empty input', function () {
      expect(renderer.topLevelBlockRanges('')).to.deep.equal([]);
    });
  });
});
