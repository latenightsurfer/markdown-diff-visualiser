/**
 * Property-Based Test: tables stay tables (issue #9)
 *
 * For any table with any single changed body row, both panes render exactly one table and the
 * new pane marks exactly one row as added.
 */

import { expect } from 'chai';
import * as fc from 'fast-check';
import { countOccurrences, highlightDocuments } from './helpers/highlight';

const cellArb = fc.stringMatching(/^[a-z0-9]{1,8}$/);
const rowArb = fc.tuple(cellArb, cellArb);
const tableArb = fc.array(rowArb, { minLength: 2, maxLength: 8 });

function toDocument(rows: readonly (readonly string[])[]): string {
  const body = rows.map((cells) => `| ${cells.join(' | ')} |`).join('\n');
  return `Intro.\n\n| A | B |\n|---|---|\n${body}\n\nOutro.\n`;
}

describe('Property: tables with one changed row stay tables', function () {
  it('renders one table per pane and marks one added row', function () {
    fc.assert(
      fc.property(tableArb, fc.nat(), (rows, seed) => {
        const changedIndex = seed % rows.length;
        const newRows = rows.map((cells, index) =>
          index === changedIndex ? [cells[0], `${cells[1]}x`] : cells,
        );

        const result = highlightDocuments(toDocument(rows), toDocument(newRows));

        expect(countOccurrences(result.oldHtml, '<table>')).to.equal(1);
        expect(countOccurrences(result.newHtml, '<table>')).to.equal(1);
        expect(countOccurrences(result.newHtml, '<tr class="diff-added-part">')).to.equal(1);
      }),
      { numRuns: 100 },
    );
  });
});
