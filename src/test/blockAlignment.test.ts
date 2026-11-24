/**
 * Unit Tests for Block Alignment (issue #9)
 *
 * alignToMarkdownBlocks merges line-based diff blocks so that no top-level markdown block
 * (table, list, fence, …) is split between two rendered fragments.
 */

import { expect } from 'chai';
import { alignToMarkdownBlocks } from '../blockAlignment';
import type { BlockDiff } from '../diffHighlighter';
import type { LineRange } from '../markdownRenderer';

const TABLE_HEADER = ['| Name | Value |', '|---|---|'];

function unchanged(...lines: string[]): BlockDiff {
  return { type: 'unchanged', oldLines: lines, newLines: lines };
}

function range(start: number, end: number): LineRange {
  return { start, end };
}

describe('Block Alignment - alignToMarkdownBlocks', function () {
  it('keeps blocks that already end on markdown block boundaries', function () {
    const blocks: BlockDiff[] = [
      unchanged('# Title', ''),
      { type: 'modified', oldLines: ['Old.'], newLines: ['New.'] },
    ];
    const ranges = [range(0, 1), range(2, 3)];

    const aligned = alignToMarkdownBlocks(blocks, ranges, ranges);

    expect(aligned.map((block) => block.type)).to.deep.equal(['unchanged', 'modified']);
    expect(aligned[1].changedOldLines).to.deep.equal([0]);
    expect(aligned[1].changedNewLines).to.deep.equal([0]);
  });

  it('merges a changed table row with the rest of its table', function () {
    const blocks: BlockDiff[] = [
      unchanged(...TABLE_HEADER, '| a | 1 |'),
      { type: 'modified', oldLines: ['| b | 2 |'], newLines: ['| b | 20 |'] },
      unchanged('| c | 3 |'),
    ];
    const tableRange = [range(0, 5)];

    const aligned = alignToMarkdownBlocks(blocks, tableRange, tableRange);

    expect(aligned).to.have.length(1);
    expect(aligned[0].type).to.equal('modified');
    expect(aligned[0].newLines).to.deep.equal([
      ...TABLE_HEADER,
      '| a | 1 |',
      '| b | 20 |',
      '| c | 3 |',
    ]);
    expect(aligned[0].changedOldLines).to.deep.equal([3]);
    expect(aligned[0].changedNewLines).to.deep.equal([3]);
  });

  it('marks a table with an added row as modified so the old table stays visible', function () {
    const blocks: BlockDiff[] = [
      unchanged(...TABLE_HEADER, '| a | 1 |'),
      { type: 'added', oldLines: [], newLines: ['| b | 2 |'] },
    ];

    const aligned = alignToMarkdownBlocks(blocks, [range(0, 3)], [range(0, 4)]);

    expect(aligned).to.have.length(1);
    expect(aligned[0].type).to.equal('modified');
    expect(aligned[0].oldLines).to.have.length(3);
    expect(aligned[0].changedOldLines).to.deep.equal([]);
    expect(aligned[0].changedNewLines).to.deep.equal([3]);
  });

  it('leaves unchanged lines after the end of a changed table outside of it', function () {
    const blocks: BlockDiff[] = [
      unchanged(...TABLE_HEADER),
      { type: 'modified', oldLines: ['| b | 2 |'], newLines: ['| b | 20 |'] },
      unchanged('| c | 3 |', '', 'After.'),
    ];
    const ranges = [range(0, 4), range(5, 6)];

    const aligned = alignToMarkdownBlocks(blocks, ranges, ranges);

    expect(aligned.map((block) => block.type)).to.deep.equal(['modified', 'unchanged']);
    expect(aligned[0].newLines).to.deep.equal([...TABLE_HEADER, '| b | 20 |', '| c | 3 |']);
    expect(aligned[1].newLines).to.deep.equal(['', 'After.']);
  });

  it('keeps unchanged blocks unchanged when they are merged', function () {
    const blocks = [unchanged('- one'), unchanged('- two')];
    const listRange = [range(0, 2)];

    const aligned = alignToMarkdownBlocks(blocks, listRange, listRange);

    expect(aligned).to.have.length(1);
    expect(aligned[0].type).to.equal('unchanged');
    expect(aligned[0].changedNewLines).to.deep.equal([]);
  });

  it('keeps a pure addition as added', function () {
    const blocks: BlockDiff[] = [{ type: 'added', oldLines: [], newLines: ['New.'] }];

    const aligned = alignToMarkdownBlocks(blocks, [], [range(0, 1)]);

    expect(aligned[0].type).to.equal('added');
    expect(aligned[0].changedNewLines).to.deep.equal([0]);
  });

  it('does not count table rows that were only re-padded as changed', function () {
    const blocks: BlockDiff[] = [
      {
        type: 'modified',
        oldLines: ['| A  | B  |', '| -- | -- |', '| a  | 1  |'],
        newLines: ['| A  | B     |', '| -- | ----- |', '| a  | 1     |', '| b  | 22222 |'],
      },
    ];
    const tableRange = (end: number) => [range(0, end)];

    const aligned = alignToMarkdownBlocks(blocks, tableRange(3), tableRange(4));

    expect(aligned[0].type).to.equal('modified');
    expect(aligned[0].changedOldLines).to.deep.equal([1]);
    expect(aligned[0].changedNewLines).to.deep.equal([1, 3]);
  });

  it('does not count list items that were only renumbered as changed', function () {
    const blocks: BlockDiff[] = [
      {
        type: 'modified',
        oldLines: ['2. Create a tag', '3. Publish'],
        newLines: ['2. Update the README', '3. Create a tag', '4. Publish'],
      },
    ];
    const listRange = (end: number) => [range(0, end)];

    const aligned = alignToMarkdownBlocks(blocks, listRange(2), listRange(3));

    expect(aligned[0].changedOldLines).to.deep.equal([]);
    expect(aligned[0].changedNewLines).to.deep.equal([0]);
  });

  it('treats a block that changed only in whitespace as unchanged', function () {
    const blocks: BlockDiff[] = [
      { type: 'modified', oldLines: ['Some   text.'], newLines: ['Some text.'] },
    ];

    const aligned = alignToMarkdownBlocks(blocks, [range(0, 1)], [range(0, 1)]);

    expect(aligned[0].type).to.equal('unchanged');
  });

  it('returns no blocks for no input', function () {
    expect(alignToMarkdownBlocks([], [], [])).to.deep.equal([]);
  });
});
