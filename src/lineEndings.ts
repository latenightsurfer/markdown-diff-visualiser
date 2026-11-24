/**
 * Line endings - Normalises text from different sources (git blobs, working tree) so that
 * versions can be compared line by line regardless of `core.autocrlf` or editor settings.
 */

const ANY_LINE_ENDING = /\r\n?/g;

/**
 * Convert CRLF (`\r\n`) and lone CR (`\r`) line endings to LF (`\n`).
 */
export function normalizeLineEndings(text: string): string {
  return text.replace(ANY_LINE_ENDING, '\n');
}
