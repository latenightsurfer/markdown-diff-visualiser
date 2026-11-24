/**
 * Test helpers for highlighting two documents the way the extension does.
 */

import { createTwoFilesPatch } from 'diff';
import { highlightDiff, HighlightedDiff } from '../../diffHighlighter';
import { parseDiff } from '../../diffParser';

const GIT_DIFF_HEADER = 'diff --git a/test.md b/test.md';

/**
 * Highlight two documents using the real diff library and parser.
 */
export function highlightDocuments(oldMarkdown: string, newMarkdown: string): HighlightedDiff {
  const patch = createTwoFilesPatch('a/test.md', 'b/test.md', oldMarkdown, newMarkdown);
  const gitDiff = patch.replace(/^[^\n]*/, GIT_DIFF_HEADER);
  return highlightDiff(oldMarkdown, newMarkdown, parseDiff(gitDiff)[0].hunks);
}

export function countOccurrences(text: string, search: string): number {
  return text.split(search).length - 1;
}
