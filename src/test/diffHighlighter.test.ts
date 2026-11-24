/**
 * Unit Tests for Diff Highlighter
 *
 * Tests the highlightDiff and computeBlockDiffs functions
 * with realistic DiffHunk objects. Verifies CSS class presence in output HTML.
 *
 * Requirements covered: 4.1, 4.2, 4.3, 4.4
 */

import { expect } from 'chai';
import { highlightDiff, computeBlockDiffs } from '../diffHighlighter';
import { DiffHunk, DiffChange } from '../diffParser';
import { countOccurrences, highlightDocuments } from './helpers/highlight';

/**
 * Helper to build a DiffHunk from a concise description.
 */
function makeHunk(
  oldStart: number,
  oldLines: number,
  newStart: number,
  newLines: number,
  changes: DiffChange[],
): DiffHunk {
  return { oldStart, oldLines, newStart, newLines, changes };
}

describe('Diff Highlighter - highlightDiff', function () {
  it('should highlight a fully added block with diff-added-block class on new pane', function () {
    // A hunk that adds two lines after line 2 of the old file
    const oldMarkdown = '# Title\n\nExisting paragraph.';
    const newMarkdown = '# Title\n\nNew first line.\n\nNew second line.\n\nExisting paragraph.';

    const hunks: DiffHunk[] = [
      makeHunk(3, 1, 3, 5, [
        { type: 'add', content: 'New first line.', newLineNumber: 3 },
        { type: 'add', content: '', newLineNumber: 4 },
        { type: 'add', content: 'New second line.', newLineNumber: 5 },
        { type: 'add', content: '', newLineNumber: 6 },
        { type: 'normal', content: 'Existing paragraph.', oldLineNumber: 3, newLineNumber: 7 },
      ]),
    ];

    const result = highlightDiff(oldMarkdown, newMarkdown, hunks);

    // New HTML should contain the added block class
    expect(result.newHtml).to.include('diff-added-block');
    // Old HTML should NOT contain added block class
    expect(result.oldHtml).to.not.include('diff-added-block');
  });

  it('should highlight a fully removed block with diff-removed-block class on old pane', function () {
    // A hunk that removes two lines from the old file
    const oldMarkdown = '# Title\n\nRemoved paragraph.\n\nKeep this.';
    const newMarkdown = '# Title\n\nKeep this.';

    const hunks: DiffHunk[] = [
      makeHunk(3, 3, 3, 1, [
        { type: 'del', content: 'Removed paragraph.', oldLineNumber: 3 },
        { type: 'del', content: '', oldLineNumber: 4 },
        { type: 'normal', content: 'Keep this.', oldLineNumber: 5, newLineNumber: 3 },
      ]),
    ];

    const result = highlightDiff(oldMarkdown, newMarkdown, hunks);

    // Old HTML should contain the removed block class
    expect(result.oldHtml).to.include('diff-removed-block');
    // New HTML should NOT contain removed block class
    expect(result.newHtml).to.not.include('diff-removed-block');
  });

  it('should highlight a modified block with word-level diffs', function () {
    // A hunk where a line is changed (del followed by add = modified)
    const oldMarkdown = 'Hello world';
    const newMarkdown = 'Hello universe';

    const hunks: DiffHunk[] = [
      makeHunk(1, 1, 1, 1, [
        { type: 'del', content: 'Hello world', oldLineNumber: 1 },
        { type: 'add', content: 'Hello universe', newLineNumber: 1 },
      ]),
    ];

    const result = highlightDiff(oldMarkdown, newMarkdown, hunks);

    // Modified blocks get wrapped: old side in diff-removed-block, new side in diff-added-block
    expect(result.oldHtml).to.include('diff-removed-block');
    expect(result.newHtml).to.include('diff-added-block');

    // Word-level diffs should be present
    expect(result.oldHtml).to.include('diff-removed-word');
    expect(result.newHtml).to.include('diff-added-word');
  });

  it('should not apply highlight classes to unchanged content', function () {
    const markdown = '# Title\n\nSome paragraph.\n\nAnother paragraph.';

    // No hunks means no changes
    const hunks: DiffHunk[] = [];

    const result = highlightDiff(markdown, markdown, hunks);

    // Neither pane should have any highlight classes
    expect(result.oldHtml).to.not.include('diff-added-block');
    expect(result.oldHtml).to.not.include('diff-removed-block');
    expect(result.oldHtml).to.not.include('diff-added-word');
    expect(result.oldHtml).to.not.include('diff-removed-word');

    expect(result.newHtml).to.not.include('diff-added-block');
    expect(result.newHtml).to.not.include('diff-removed-block');
    expect(result.newHtml).to.not.include('diff-added-word');
    expect(result.newHtml).to.not.include('diff-removed-word');
  });

  it('should highlight all new content for an added file scenario', function () {
    // Added file: old is empty, new has content
    const oldMarkdown = '';
    const newMarkdown = '# New Document\n\nThis is brand new content.';

    const hunks: DiffHunk[] = [
      makeHunk(0, 0, 1, 3, [
        { type: 'add', content: '# New Document', newLineNumber: 1 },
        { type: 'add', content: '', newLineNumber: 2 },
        { type: 'add', content: 'This is brand new content.', newLineNumber: 3 },
      ]),
    ];

    const result = highlightDiff(oldMarkdown, newMarkdown, hunks);

    // Old pane should be empty
    expect(result.oldHtml).to.equal('');
    // New pane should be entirely wrapped in diff-added-block
    expect(result.newHtml).to.include('diff-added-block');
  });

  it('should highlight all old content for a deleted file scenario', function () {
    // Deleted file: old has content, new is empty
    const oldMarkdown = '# Old Document\n\nThis content is being deleted.';
    const newMarkdown = '';

    const hunks: DiffHunk[] = [
      makeHunk(1, 3, 0, 0, [
        { type: 'del', content: '# Old Document', oldLineNumber: 1 },
        { type: 'del', content: '', oldLineNumber: 2 },
        { type: 'del', content: 'This content is being deleted.', oldLineNumber: 3 },
      ]),
    ];

    const result = highlightDiff(oldMarkdown, newMarkdown, hunks);

    // New pane should be empty
    expect(result.newHtml).to.equal('');
    // Old pane should be entirely wrapped in diff-removed-block
    expect(result.oldHtml).to.include('diff-removed-block');
  });
});

describe('Diff Highlighter - computeBlockDiffs', function () {
  it('should classify added lines as type "added"', function () {
    const oldLines = ['line1', 'line2'];
    const newLines = ['line1', 'inserted', 'line2'];

    const hunks: DiffHunk[] = [
      makeHunk(2, 1, 2, 2, [
        { type: 'add', content: 'inserted', newLineNumber: 2 },
        { type: 'normal', content: 'line2', oldLineNumber: 2, newLineNumber: 3 },
      ]),
    ];

    const blocks = computeBlockDiffs(oldLines, newLines, hunks);

    const addedBlock = blocks.find((b) => b.type === 'added');
    expect(addedBlock).to.exist;
    expect(addedBlock!.newLines).to.deep.equal(['inserted']);
    expect(addedBlock!.oldLines).to.deep.equal([]);
  });

  it('should classify removed lines as type "removed"', function () {
    const oldLines = ['line1', 'to-remove', 'line2'];
    const newLines = ['line1', 'line2'];

    const hunks: DiffHunk[] = [
      makeHunk(2, 2, 2, 1, [
        { type: 'del', content: 'to-remove', oldLineNumber: 2 },
        { type: 'normal', content: 'line2', oldLineNumber: 3, newLineNumber: 2 },
      ]),
    ];

    const blocks = computeBlockDiffs(oldLines, newLines, hunks);

    const removedBlock = blocks.find((b) => b.type === 'removed');
    expect(removedBlock).to.exist;
    expect(removedBlock!.oldLines).to.deep.equal(['to-remove']);
    expect(removedBlock!.newLines).to.deep.equal([]);
  });

  it('should classify del followed by add as type "modified"', function () {
    const oldLines = ['old content'];
    const newLines = ['new content'];

    const hunks: DiffHunk[] = [
      makeHunk(1, 1, 1, 1, [
        { type: 'del', content: 'old content', oldLineNumber: 1 },
        { type: 'add', content: 'new content', newLineNumber: 1 },
      ]),
    ];

    const blocks = computeBlockDiffs(oldLines, newLines, hunks);

    const modifiedBlock = blocks.find((b) => b.type === 'modified');
    expect(modifiedBlock).to.exist;
    expect(modifiedBlock!.oldLines).to.deep.equal(['old content']);
    expect(modifiedBlock!.newLines).to.deep.equal(['new content']);
  });

  it('should return unchanged block when there are no hunks', function () {
    const lines = ['line1', 'line2', 'line3'];

    const blocks = computeBlockDiffs(lines, lines, []);

    expect(blocks).to.have.lengthOf(1);
    expect(blocks[0].type).to.equal('unchanged');
    expect(blocks[0].oldLines).to.deep.equal(lines);
    expect(blocks[0].newLines).to.deep.equal(lines);
  });

  it('should return empty array for empty inputs with no hunks', function () {
    const blocks = computeBlockDiffs([], [], []);
    expect(blocks).to.deep.equal([]);
  });
});

describe('Diff Highlighter - markdown blocks split by a hunk (issue #9)', function () {
  const table = (rowB: string) =>
    `# Title\n\n| Name | Value |\n|---|---|\n| a | 1 |\n${rowB}\n| c | 3 |\n\nAfter.\n`;

  it('renders a table whose middle row changed as one table on each side', function () {
    const result = highlightDocuments(table('| b | 2 |'), table('| b | 20 |'));

    expect(countOccurrences(result.oldHtml, '<table>')).to.equal(1);
    expect(countOccurrences(result.newHtml, '<table>')).to.equal(1);
    expect(result.newHtml).to.not.include('| b');
  });

  it('marks only the changed table row', function () {
    const result = highlightDocuments(table('| b | 2 |'), table('| b | 20 |'));

    expect(countOccurrences(result.oldHtml, '<tr class="diff-removed-part">')).to.equal(1);
    expect(countOccurrences(result.newHtml, '<tr class="diff-added-part">')).to.equal(1);
  });

  it('does not fill a table that changed only in one row', function () {
    const result = highlightDocuments(table('| b | 2 |'), table('| b | 20 |'));

    expect(result.oldHtml).to.include('<div class="diff-removed-block diff-partial"><table>');
    expect(result.newHtml).to.include('<div class="diff-added-block diff-partial"><table>');
  });

  it('marks the changed word inside the changed table cell', function () {
    const result = highlightDocuments(table('| b | 2 |'), table('| b | 20 |'));

    expect(result.oldHtml).to.include('<td><span class="diff-removed-word">2</span></td>');
    expect(result.newHtml).to.include('<td><span class="diff-added-word">20</span></td>');
  });

  it('leaves the old table unmarked when a row was only added', function () {
    const oldMarkdown = '| Name | Value |\n|---|---|\n| a | 1 |\n\nAfter.\n';
    const newMarkdown = '| Name | Value |\n|---|---|\n| a | 1 |\n| b | 2 |\n\nAfter.\n';

    const result = highlightDocuments(oldMarkdown, newMarkdown);

    expect(countOccurrences(result.oldHtml, '<table>')).to.equal(1);
    expect(result.oldHtml).to.not.include('diff-removed-part');
    expect(result.oldHtml).to.not.include('diff-removed-word');
    expect(countOccurrences(result.newHtml, '<tr class="diff-added-part">')).to.equal(1);
  });

  it('marks only the added row of a formatted table whose columns got wider', function () {
    const oldMarkdown = '| Os  | Status |\n| --- | ------ |\n| Win | tested |\n';
    const newMarkdown =
      '| Os  | Status       |\n| --- | ------------ |\n| Win | tested       |\n| WSL | experimental |\n';

    const result = highlightDocuments(oldMarkdown, newMarkdown);

    expect(countOccurrences(result.newHtml, 'diff-added-part')).to.equal(1);
    expect(result.newHtml).to.include('<tr class="diff-added-part">\n<td><span');
    expect(result.oldHtml).to.not.include('diff-removed-part');
  });

  it('renders a fenced code block whose middle line changed as one code block', function () {
    const fence = (line: string) =>
      `Intro.\n\n\`\`\`js\nconst a = 1;\n${line}\nconst c = 3;\n\`\`\`\n`;

    const result = highlightDocuments(fence('const b = 2;'), fence('const b = 20;'));

    expect(countOccurrences(result.newHtml, '<pre')).to.equal(1);
    expect(result.newHtml).to.not.include('```');
  });

  it('marks only the changed item of a list', function () {
    const list = (item: string) => `Intro.\n\n- one\n- ${item}\n- three\n`;

    const result = highlightDocuments(list('two'), list('zwei'));

    expect(countOccurrences(result.newHtml, '<ul>')).to.equal(1);
    expect(result.newHtml).to.include(
      '<li class="diff-added-part"><span class="diff-added-word">zwei',
    );
    expect(result.newHtml).to.include('<li>one</li>');
  });

  it('keeps unchanged paragraphs outside the highlighted table', function () {
    const result = highlightDocuments(table('| b | 2 |'), table('| b | 20 |'));
    const highlighted = result.newHtml.match(
      /<div class="diff-added-block[^"]*">([\s\S]*?)<\/div>/,
    );

    expect(highlighted?.[1]).to.include('<table>');
    expect(highlighted?.[1]).to.not.include('Title');
    expect(highlighted?.[1]).to.not.include('After.');
  });
});

describe('Diff Highlighter - word-level highlights on rendered markdown', function () {
  it('marks the changed word inside bold text without breaking the markup', function () {
    const result = highlightDocuments('Some **bold** text.\n', 'Some **brave** text.\n');

    expect(result.oldHtml).to.include(
      '<strong><span class="diff-removed-word">bold</span></strong>',
    );
    expect(result.newHtml).to.include(
      '<strong><span class="diff-added-word">brave</span></strong>',
    );
  });

  it('marks a changed paragraph as a whole block', function () {
    const result = highlightDocuments('Old sentence.\n', 'New sentence.\n');

    expect(result.newHtml).to.include('<div class="diff-added-block"><p>');
  });
});

describe('Diff Highlighter - footnotes and reference links in separate blocks', function () {
  const document = (paragraph: string, note: string, url: string) =>
    [
      '# Guide',
      '',
      `${paragraph}[^issues] See [the docs][docs].`,
      '',
      'Unchanged paragraph.',
      '',
      `[docs]: ${url}`,
      '',
      `[^issues]: ${note}`,
      '',
    ].join('\n');
  const before = document('Report problems.', 'Include the markdown.', 'https://example.com/old');

  it('renders footnote references and reference links of a changed paragraph', function () {
    const after = document(
      'Report problems on GitHub.',
      'Include the markdown.',
      'https://example.com/old',
    );

    const result = highlightDocuments(before, after);

    expect(result.newHtml).to.contain('<a href="#fn1" id="fnref1">[1]</a>');
    expect(result.newHtml).to.contain('<a href="https://example.com/old">');
    expect(result.newHtml).not.to.contain('[^issues]');
    expect(result.newHtml).not.to.contain('[docs]');
  });

  it('shows a changed footnote definition with its changed words', function () {
    const after = document(
      'Report problems.',
      'Include the failing markdown.',
      'https://example.com/old',
    );

    const result = highlightDocuments(before, after);

    expect(result.newHtml).to.match(
      /<div class="diff-added-block">[^]*?<li id="fn1" class="footnote-item">[^]*?<span class="diff-added-word">failing/,
    );
    expect(result.oldHtml).to.contain('<li id="fn1" class="footnote-item">');
  });

  it('shows the source of a changed reference link definition', function () {
    const after = document('Report problems.', 'Include the markdown.', 'https://example.com/new');

    const result = highlightDocuments(before, after);

    expect(result.newHtml).to.contain(
      '<pre class="diff-source"><code>[docs]: https://example.com/',
    );
    expect(result.newHtml).to.contain('<span class="diff-added-word">new</span>');
    expect(result.newHtml).to.contain('<a href="https://example.com/new">');
  });
});
