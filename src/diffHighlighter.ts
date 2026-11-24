/**
 * Diff Highlighter - Compares old/new markdown, computes block-level and word-level diffs,
 * and produces annotated HTML.
 */

import { DiffHunk } from './diffParser';
import {
  ChangeMarks,
  createRenderer,
  DocumentContext,
  escapeHtml,
  MarkdownRenderer,
} from './markdownRenderer';
import { alignToMarkdownBlocks, AlignedBlock } from './blockAlignment';
import { annotateWordChanges } from './wordDiff';

export interface HighlightedDiff {
  oldHtml: string;
  newHtml: string;
}

export interface BlockDiff {
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  oldLines: string[];
  newLines: string[];
}

/** CSS classes for one side of the diff: the whole block and a changed part inside it. */
interface SideClasses {
  readonly blockClass: string;
  readonly partClass: string;
}

const REMOVED_SIDE: SideClasses = {
  blockClass: 'diff-removed-block',
  partClass: 'diff-removed-part',
};
const ADDED_SIDE: SideClasses = { blockClass: 'diff-added-block', partClass: 'diff-added-part' };
const PARTIAL_BLOCK_CLASS = 'diff-partial';
/** Class of the source shown for a changed fragment that renders nothing. */
const SOURCE_CLASS = 'diff-source';

/** Definitions of both documents, for rendering their blocks one by one. */
interface DocumentContexts {
  readonly oldDocument: DocumentContext;
  readonly newDocument: DocumentContext;
}

/**
 * Compute block-level diffs from old/new lines and diff hunks.
 *
 * Walks through the hunks and classifies contiguous groups of lines as:
 * - 'unchanged': lines not touched by any hunk
 * - 'added': lines that only appear in the new version
 * - 'removed': lines that only appear in the old version
 * - 'modified': lines where old content was replaced by new content (del followed by add)
 */
export function computeBlockDiffs(
  oldLines: string[],
  newLines: string[],
  hunks: DiffHunk[],
): BlockDiff[] {
  if (hunks.length === 0) {
    // No changes — everything is unchanged
    const allLines = oldLines.length > 0 ? oldLines : newLines;
    if (allLines.length === 0) {
      return [];
    }
    return [
      {
        type: 'unchanged',
        oldLines: [...oldLines],
        newLines: [...newLines],
      },
    ];
  }

  const blocks: BlockDiff[] = [];
  let oldIdx = 0;
  let newIdx = 0;

  // Sort hunks by position
  const sortedHunks = [...hunks].sort((a, b) => a.oldStart - b.oldStart);

  for (const hunk of sortedHunks) {
    const hunkOldStart = hunk.oldStart - 1; // convert to 0-based
    const hunkNewStart = hunk.newStart - 1;

    // Add unchanged lines before this hunk
    if (oldIdx < hunkOldStart || newIdx < hunkNewStart) {
      const unchangedOld: string[] = [];
      const unchangedNew: string[] = [];
      while (oldIdx < hunkOldStart && oldIdx < oldLines.length) {
        unchangedOld.push(oldLines[oldIdx]);
        oldIdx++;
      }
      while (newIdx < hunkNewStart && newIdx < newLines.length) {
        unchangedNew.push(newLines[newIdx]);
        newIdx++;
      }
      if (unchangedOld.length > 0 || unchangedNew.length > 0) {
        blocks.push({
          type: 'unchanged',
          oldLines: unchangedOld,
          newLines: unchangedNew,
        });
      }
    }

    // Process changes within the hunk
    // Group consecutive del/add/normal changes
    const changes = hunk.changes;
    let i = 0;
    while (i < changes.length) {
      const change = changes[i];

      if (change.type === 'normal') {
        // Collect consecutive normal lines
        const normalOld: string[] = [];
        const normalNew: string[] = [];
        while (i < changes.length && changes[i].type === 'normal') {
          normalOld.push(changes[i].content);
          normalNew.push(changes[i].content);
          oldIdx++;
          newIdx++;
          i++;
        }
        blocks.push({
          type: 'unchanged',
          oldLines: normalOld,
          newLines: normalNew,
        });
      } else if (change.type === 'del') {
        // Collect consecutive del lines, then check for following add lines (modified)
        const delLines: string[] = [];
        while (i < changes.length && changes[i].type === 'del') {
          delLines.push(changes[i].content);
          oldIdx++;
          i++;
        }
        // Check if followed by add lines — that makes it a 'modified' block
        const addLines: string[] = [];
        while (i < changes.length && changes[i].type === 'add') {
          addLines.push(changes[i].content);
          newIdx++;
          i++;
        }
        if (addLines.length > 0) {
          blocks.push({
            type: 'modified',
            oldLines: delLines,
            newLines: addLines,
          });
        } else {
          blocks.push({
            type: 'removed',
            oldLines: delLines,
            newLines: [],
          });
        }
      } else if (change.type === 'add') {
        // Pure add lines (not preceded by del)
        const addLines: string[] = [];
        while (i < changes.length && changes[i].type === 'add') {
          addLines.push(changes[i].content);
          newIdx++;
          i++;
        }
        blocks.push({
          type: 'added',
          oldLines: [],
          newLines: addLines,
        });
      } else {
        i++;
      }
    }
  }

  // Add any remaining unchanged lines after the last hunk
  const remainingOld: string[] = [];
  const remainingNew: string[] = [];
  while (oldIdx < oldLines.length) {
    remainingOld.push(oldLines[oldIdx]);
    oldIdx++;
  }
  while (newIdx < newLines.length) {
    remainingNew.push(newLines[newIdx]);
    newIdx++;
  }
  if (remainingOld.length > 0 || remainingNew.length > 0) {
    blocks.push({
      type: 'unchanged',
      oldLines: remainingOld,
      newLines: remainingNew,
    });
  }

  return blocks;
}

/**
 * Wrap an HTML string in a div with the given CSS class.
 */
function wrapBlock(html: string, className: string): string {
  return `<div class="${className}">${html}</div>`;
}

/**
 * Highlight differences between old and new markdown content.
 *
 * Computes block-level diffs from the hunks, extends them to whole markdown blocks (tables,
 * lists, fences), renders every block and marks changed blocks, changed parts and changed words.
 *
 * Edge cases:
 * - Fully added file (empty old, non-empty new): all new content gets diff-added-block
 * - Fully deleted file (non-empty old, empty new): all old content gets diff-removed-block
 * - No changes (empty hunks): no highlight classes applied
 */
export function highlightDiff(
  oldMarkdown: string,
  newMarkdown: string,
  hunks: DiffHunk[],
): HighlightedDiff {
  const renderer = createRenderer();
  if (hunks.length === 0) {
    return { oldHtml: renderer.render(oldMarkdown), newHtml: renderer.render(newMarkdown) };
  }

  const oldLines = oldMarkdown.length > 0 ? oldMarkdown.split('\n') : [];
  const newLines = newMarkdown.length > 0 ? newMarkdown.split('\n') : [];
  if (oldLines.length === 0 && newLines.length > 0) {
    return { oldHtml: '', newHtml: wrapBlock(renderer.render(newMarkdown), ADDED_SIDE.blockClass) };
  }
  if (oldLines.length > 0 && newLines.length === 0) {
    return {
      oldHtml: wrapBlock(renderer.render(oldMarkdown), REMOVED_SIDE.blockClass),
      newHtml: '',
    };
  }

  const contexts: DocumentContexts = {
    oldDocument: renderer.createDocumentContext(oldMarkdown),
    newDocument: renderer.createDocumentContext(newMarkdown),
  };
  const blocks = alignToMarkdownBlocks(
    computeBlockDiffs(oldLines, newLines, hunks),
    renderer.topLevelBlockRanges(oldMarkdown),
    renderer.topLevelBlockRanges(newMarkdown),
  );
  const rendered = blocks.map((block) => renderBlock(renderer, contexts, block));
  return {
    oldHtml: rendered.map((part) => part.oldHtml).join(''),
    newHtml: rendered.map((part) => part.newHtml).join(''),
  };
}

function renderBlock(
  renderer: MarkdownRenderer,
  contexts: DocumentContexts,
  block: AlignedBlock,
): HighlightedDiff {
  const oldMarkdown = block.oldLines.join('\n');
  const newMarkdown = block.newLines.join('\n');
  switch (block.type) {
    case 'unchanged':
      return {
        oldHtml: renderer.renderFragment(oldMarkdown, contexts.oldDocument),
        newHtml: renderer.renderFragment(newMarkdown, contexts.newDocument),
      };
    case 'added':
      return {
        oldHtml: '',
        newHtml: wrapBlock(
          renderVisible(renderer, newMarkdown, contexts.newDocument),
          ADDED_SIDE.blockClass,
        ),
      };
    case 'removed':
      return {
        oldHtml: wrapBlock(
          renderVisible(renderer, oldMarkdown, contexts.oldDocument),
          REMOVED_SIDE.blockClass,
        ),
        newHtml: '',
      };
    case 'modified':
      return renderModifiedBlock(renderer, contexts, block);
  }
}

/**
 * Render both sides of a modified block with changed parts and changed words marked.
 */
function renderModifiedBlock(
  renderer: MarkdownRenderer,
  contexts: DocumentContexts,
  block: AlignedBlock,
): HighlightedDiff {
  const oldSide = highlightForSide(block.oldLines, block.changedOldLines, REMOVED_SIDE);
  const newSide = highlightForSide(block.newLines, block.changedNewLines, ADDED_SIDE);
  const words = annotateWordChanges(
    renderVisible(renderer, block.oldLines.join('\n'), contexts.oldDocument, oldSide.marks),
    renderVisible(renderer, block.newLines.join('\n'), contexts.newDocument, newSide.marks),
  );
  return {
    oldHtml: wrapBlock(words.oldHtml, oldSide.blockClass),
    newHtml: wrapBlock(words.newHtml, newSide.blockClass),
  };
}

/**
 * Render a changed fragment. Some markdown renders nothing on its own, e.g. a reference link
 * definition; its source is shown instead, so that the change stays visible.
 */
function renderVisible(
  renderer: MarkdownRenderer,
  markdown: string,
  context: DocumentContext,
  marks?: ChangeMarks,
): string {
  const html = renderer.renderFragment(markdown, context, marks);
  if (html.trim() !== '' || markdown.trim() === '') {
    return html;
  }
  return `<pre class="${SOURCE_CLASS}"><code>${escapeHtml(markdown)}</code></pre>`;
}

/**
 * A block whose content changed on every line is filled as a whole. A block that also contains
 * unchanged content (e.g. the other rows of a table) is not filled; only its changed parts are
 * marked. Blank lines do not count as content.
 */
function highlightForSide(
  lines: readonly string[],
  changedLines: readonly number[],
  side: SideClasses,
): { marks?: ChangeMarks; blockClass: string } {
  const changed = new Set(changedLines);
  const hasUnchangedContent = lines.some(
    (line, index) => line.trim() !== '' && !changed.has(index),
  );
  if (hasUnchangedContent) {
    return {
      marks: { lines: changedLines, className: side.partClass },
      blockClass: `${side.blockClass} ${PARTIAL_BLOCK_CLASS}`,
    };
  }
  return { blockClass: side.blockClass };
}
