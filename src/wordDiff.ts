/**
 * Word Diff - Marks the words that differ between two rendered HTML fragments.
 *
 * The diff runs on the visible text of the rendered HTML (not on the markdown source), so markup
 * such as `|`, `**` or list markers never shifts the highlights. Highlight spans are only placed
 * inside a single text node and therefore never break the HTML structure.
 */

import DiffMatchPatch from 'diff-match-patch';
import type { HighlightedDiff } from './diffHighlighter';

const REMOVED_WORD_CLASS = 'diff-removed-word';
const ADDED_WORD_CLASS = 'diff-added-word';

/** An HTML entity, a word, a whitespace run, or any other single character. */
const TEXT_UNIT = /&[#a-zA-Z0-9]+;|[\p{L}\p{N}_]+|\s+|\S/gu;

/** Units are encoded as one character each; start above the ASCII range for readability. */
const FIRST_UNIT_CODE = 0x100;

const WHITESPACE_ONLY = /^\s*$/;

interface HtmlToken {
  readonly type: 'tag' | 'text';
  readonly value: string;
}

/**
 * Wrap the words that only exist in `oldHtml` in `diff-removed-word` spans and the words that
 * only exist in `newHtml` in `diff-added-word` spans.
 */
export function annotateWordChanges(oldHtml: string, newHtml: string): HighlightedDiff {
  const oldTokens = tokenizeHtml(oldHtml);
  const newTokens = tokenizeHtml(newHtml);
  const oldUnits = oldTokens.map(textUnits);
  const newUnits = newTokens.map(textUnits);
  const { oldChanged, newChanged } = diffUnits(oldUnits.flat(), newUnits.flat());

  return {
    oldHtml: renderTokens(oldTokens, oldUnits, oldChanged, REMOVED_WORD_CLASS),
    newHtml: renderTokens(newTokens, newUnits, newChanged, ADDED_WORD_CLASS),
  };
}

/**
 * Split HTML into tag and text tokens.
 */
function tokenizeHtml(html: string): HtmlToken[] {
  const tokens: HtmlToken[] = [];
  let index = 0;
  while (index < html.length) {
    const isTag = html[index] === '<';
    const end = isTag ? endOf(html, '>', index) + 1 : endOf(html, '<', index);
    tokens.push({ type: isTag ? 'tag' : 'text', value: html.substring(index, end) });
    index = end;
  }
  return tokens;
}

/** Index of the next `char` from `from`, or the end of `html` if there is none. */
function endOf(html: string, char: string, from: number): number {
  const next = html.indexOf(char, from);
  return next === -1 ? html.length : next;
}

function textUnits(token: HtmlToken): string[] {
  return token.type === 'text' ? (token.value.match(TEXT_UNIT) ?? []) : [];
}

/**
 * Diff two unit sequences and report for every unit whether it changed.
 */
function diffUnits(
  oldUnits: readonly string[],
  newUnits: readonly string[],
): { oldChanged: boolean[]; newChanged: boolean[] } {
  const encode = createUnitEncoder();
  const dmp = new DiffMatchPatch();
  const diffs = dmp.diff_main(encode(oldUnits), encode(newUnits), false);
  dmp.diff_cleanupSemantic(diffs);

  const oldChanged: boolean[] = [];
  const newChanged: boolean[] = [];
  for (const [operation, text] of diffs) {
    for (let i = 0; i < text.length; i++) {
      if (operation !== DiffMatchPatch.DIFF_INSERT) {
        oldChanged.push(operation === DiffMatchPatch.DIFF_DELETE);
      }
      if (operation !== DiffMatchPatch.DIFF_DELETE) {
        newChanged.push(operation === DiffMatchPatch.DIFF_INSERT);
      }
    }
  }
  return { oldChanged, newChanged };
}

/**
 * Map every distinct unit to one character, so diff-match-patch compares whole units.
 */
function createUnitEncoder(): (units: readonly string[]) => string {
  const codes = new Map<string, string>();
  return (units) =>
    units
      .map((unit) => {
        const code = codes.get(unit) ?? String.fromCharCode(FIRST_UNIT_CODE + codes.size);
        codes.set(unit, code);
        return code;
      })
      .join('');
}

function renderTokens(
  tokens: readonly HtmlToken[],
  unitsPerToken: readonly string[][],
  changed: readonly boolean[],
  className: string,
): string {
  let unitIndex = 0;
  return tokens
    .map((token, tokenIndex) => {
      if (token.type === 'tag' || WHITESPACE_ONLY.test(token.value)) {
        // Whitespace between tags (e.g. between <tr> and <td>) must never be wrapped in a span
        unitIndex += unitsPerToken[tokenIndex].length;
        return token.value;
      }
      const units = unitsPerToken[tokenIndex];
      const flags = changed.slice(unitIndex, unitIndex + units.length);
      unitIndex += units.length;
      return renderUnits(units, flags, className);
    })
    .join('');
}

/**
 * Join the units of one text node, wrapping each run of changed units in a highlight span.
 */
function renderUnits(
  units: readonly string[],
  changed: readonly boolean[],
  className: string,
): string {
  let html = '';
  let run = '';
  units.forEach((unit, index) => {
    run += unit;
    if (index === units.length - 1 || changed[index] !== changed[index + 1]) {
      html += changed[index] ? `<span class="${className}">${run}</span>` : run;
      run = '';
    }
  });
  return html;
}
