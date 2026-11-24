/**
 * Property-Based Test: line ending normalisation (issue #8)
 *
 * For any text, the normalised text contains no CR, and a document joined with CRLF normalises
 * to the same document joined with LF.
 */

import { expect } from 'chai';
import * as fc from 'fast-check';
import { normalizeLineEndings } from '../lineEndings';

const lineArb = fc.stringOf(
  fc.char().filter((c) => c !== '\n' && c !== '\r'),
  { maxLength: 40 },
);

describe('Property: normalised line endings', function () {
  it('never contains a carriage return', function () {
    fc.assert(
      fc.property(fc.string(), (text) => {
        expect(normalizeLineEndings(text)).to.not.include('\r');
      }),
      { numRuns: 200 },
    );
  });

  it('turns a CRLF document into the same LF document', function () {
    fc.assert(
      fc.property(fc.array(lineArb, { maxLength: 20 }), (lines) => {
        expect(normalizeLineEndings(lines.join('\r\n'))).to.equal(lines.join('\n'));
      }),
      { numRuns: 200 },
    );
  });
});
