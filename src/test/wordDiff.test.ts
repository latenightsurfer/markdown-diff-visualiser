/**
 * Unit Tests for the word-level diff on rendered HTML.
 */

import { expect } from 'chai';
import { annotateWordChanges } from '../wordDiff';

describe('Word Diff - annotateWordChanges', function () {
  it('wraps the changed word on each side', function () {
    const result = annotateWordChanges('<p>Hello world</p>', '<p>Hello universe</p>');

    expect(result.oldHtml).to.equal('<p>Hello <span class="diff-removed-word">world</span></p>');
    expect(result.newHtml).to.equal('<p>Hello <span class="diff-added-word">universe</span></p>');
  });

  it('returns identical HTML unchanged', function () {
    const html = '<p>Same <strong>text</strong> here</p>';

    const result = annotateWordChanges(html, html);

    expect(result).to.deep.equal({ oldHtml: html, newHtml: html });
  });

  it('keeps highlight spans inside a single text node', function () {
    const result = annotateWordChanges(
      '<p>alpha <em>beta</em> gamma</p>',
      '<p>delta <em>epsilon</em> zeta</p>',
    );

    expect(result.newHtml).to.include('<em><span class="diff-added-word">epsilon</span></em>');
    expect(result.newHtml).to.not.match(/<span class="diff-added-word">[^<]*<(?!\/span>)/);
  });

  it('ignores markup that only exists in the markdown source', function () {
    const result = annotateWordChanges(
      '<table>\n<tr>\n<td>a</td>\n<td>1</td>\n</tr>\n</table>',
      '<table>\n<tr>\n<td>a</td>\n<td>2</td>\n</tr>\n</table>',
    );

    expect(result.newHtml).to.equal(
      '<table>\n<tr>\n<td>a</td>\n<td><span class="diff-added-word">2</span></td>\n</tr>\n</table>',
    );
  });

  it('never wraps whitespace between tags', function () {
    const result = annotateWordChanges(
      '<ul>\n<li>a</li>\n</ul>',
      '<ul>\n<li>a</li>\n<li>b</li>\n</ul>',
    );

    expect(result.newHtml).to.equal(
      '<ul>\n<li>a</li>\n<li><span class="diff-added-word">b</span></li>\n</ul>',
    );
  });

  it('treats an HTML entity as one unit', function () {
    const result = annotateWordChanges('<p>a &amp; b</p>', '<p>a &lt; b</p>');

    expect(result.oldHtml).to.equal('<p>a <span class="diff-removed-word">&amp;</span> b</p>');
    expect(result.newHtml).to.equal('<p>a <span class="diff-added-word">&lt;</span> b</p>');
  });

  it('handles empty input', function () {
    expect(annotateWordChanges('', '')).to.deep.equal({ oldHtml: '', newHtml: '' });
  });
});
