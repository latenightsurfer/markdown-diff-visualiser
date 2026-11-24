/**
 * Unit Tests for line ending normalisation (issue #8).
 */

import { expect } from 'chai';
import { normalizeLineEndings } from '../lineEndings';

describe('Line Endings - normalizeLineEndings', function () {
  it('converts CRLF line endings to LF', function () {
    const result = normalizeLineEndings('# Title\r\n\r\nText.\r\n');

    expect(result).to.equal('# Title\n\nText.\n');
  });

  it('converts lone CR line endings to LF', function () {
    const result = normalizeLineEndings('a\rb\r');

    expect(result).to.equal('a\nb\n');
  });

  it('converts mixed line endings to LF', function () {
    const result = normalizeLineEndings('a\r\nb\nc\rd');

    expect(result).to.equal('a\nb\nc\nd');
  });

  it('leaves LF-only text unchanged', function () {
    const text = '# Title\n\nText.\n';

    const result = normalizeLineEndings(text);

    expect(result).to.equal(text);
  });

  it('returns an empty string for empty input', function () {
    expect(normalizeLineEndings('')).to.equal('');
  });
});
