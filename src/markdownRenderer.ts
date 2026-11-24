/**
 * Markdown Renderer - Converts markdown strings to HTML using markdown-it with GFM plugins.
 * Resolves relative image paths.
 */

import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import footnote from 'markdown-it-footnote';
import hljs from 'highlight.js/lib/core';
// Register commonly used languages
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import sql from 'highlight.js/lib/languages/sql';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import markdown from 'highlight.js/lib/languages/markdown';
import diff from 'highlight.js/lib/languages/diff';
import java from 'highlight.js/lib/languages/java';
import csharp from 'highlight.js/lib/languages/csharp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import ruby from 'highlight.js/lib/languages/ruby';
import php from 'highlight.js/lib/languages/php';
import shell from 'highlight.js/lib/languages/shell';
import dockerfile from 'highlight.js/lib/languages/dockerfile';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('css', css);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('diff', diff);
hljs.registerLanguage('java', java);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('cs', csharp);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('rs', rust);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('rb', ruby);
hljs.registerLanguage('php', php);
hljs.registerLanguage('shell', shell);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('docker', dockerfile);
import * as path from 'path';
import {
  createDocumentContext,
  createFragmentEnv,
  DocumentContext,
  inPlaceFootnotes,
} from './documentFragments';

export type { DocumentContext } from './documentFragments';

/** A 0-based, end-exclusive range of source lines. */
export interface LineRange {
  readonly start: number;
  readonly end: number;
}

/** Source lines of a fragment whose blocks get a CSS class. */
export interface ChangeMarks {
  readonly lines: readonly number[];
  readonly className: string;
}

export interface MarkdownRenderer {
  render(markdown: string): string;
  renderWithBase(markdown: string, basePath: string): string;
  /** Collect the reference and footnote definitions of a whole document. */
  createDocumentContext(markdown: string): DocumentContext;
  /**
   * Render a part of a document like it renders inside the document: reference links and
   * footnotes resolve against `context`, footnote definitions stay in place. With `marks`, the
   * innermost blocks (table row, paragraph, list item, heading, code block, …) whose source
   * lines include one of the marked lines get the marks' class.
   */
  renderFragment(fragment: string, context: DocumentContext, marks?: ChangeMarks): string;
  /** Source line ranges of the top-level blocks (paragraph, table, list, fence, …). */
  topLevelBlockRanges(markdown: string): LineRange[];
}

type Token = ReturnType<MarkdownIt['parse']>[number];

/** Block tokens that can carry a change class, from the innermost level of a document. */
const MARKABLE_TOKEN_TYPES: ReadonlySet<string> = new Set([
  'tr_open',
  'heading_open',
  'paragraph_open',
  'fence',
  'code_block',
  'html_block',
  'hr',
]);

/** Rules whose default output ignores token attributes; they get a wrapping div instead. */
const WRAPPED_RULES = ['fence', 'html_block'] as const;

/**
 * Add `className` to the changed blocks of freshly parsed tokens. The tokens are local to one
 * render call, so this mutation does not leak.
 */
function applyChangedClass(
  tokens: readonly Token[],
  changedLines: ReadonlySet<number>,
  className: string,
): void {
  const openListItems: Token[] = [];
  for (const token of tokens) {
    if (token.type === 'list_item_open') {
      openListItems.push(token);
    } else if (token.type === 'list_item_close') {
      openListItems.pop();
    } else if (MARKABLE_TOKEN_TYPES.has(token.type) && touchesLines(token, changedLines)) {
      // Paragraphs of tight lists are not rendered as <p>; mark their list item instead
      const target = token.hidden ? openListItems[openListItems.length - 1] : token;
      addClassOnce(target, className);
    }
  }
}

function touchesLines(token: Token, lines: ReadonlySet<number>): boolean {
  if (!token.map) {
    return false;
  }
  for (let line = token.map[0]; line < token.map[1]; line++) {
    if (lines.has(line)) {
      return true;
    }
  }
  return false;
}

function addClassOnce(token: Token | undefined, className: string): void {
  const classes = token?.attrGet('class')?.split(' ') ?? [];
  if (token && !classes.includes(className)) {
    token.attrJoin('class', className);
  }
}

/**
 * Wrap fences and HTML blocks that carry a class in a div, because their default rules do not
 * render token attributes.
 */
function wrapClassedBlocks(md: MarkdownIt): void {
  for (const rule of WRAPPED_RULES) {
    const renderDefault = md.renderer.rules[rule];
    md.renderer.rules[rule] = (tokens, idx, options, env, self) => {
      const html = renderDefault ? renderDefault(tokens, idx, options, env, self) : '';
      const className = tokens[idx].attrGet('class');
      return className ? `<div class="${className}">${html}</div>\n` : html;
    };
  }
}

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

/** Escape text for use in HTML content and attribute values. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (char) => HTML_ESCAPES[char]);
}

export interface RendererOptions {
  gfm?: boolean;
  basePath?: string;
}

/**
 * Resolve relative image paths in markdown to workspace-relative paths.
 * Replaces src attributes like `./img.png` or `img.png` with paths resolved
 * against the provided basePath.
 */
function resolveImagePaths(html: string, basePath: string): string {
  // Match <img ... src="..." ...> tags and resolve relative src values
  return html.replace(
    /(<img\s[^>]*?\bsrc\s*=\s*")((?!https?:\/\/|data:|\/)[^"]*?)(")/gi,
    (_match, prefix: string, src: string, suffix: string) => {
      const resolved = path.posix.join(basePath, src);
      return `${prefix}${resolved}${suffix}`;
    },
  );
}

export function createRenderer(options?: RendererOptions): MarkdownRenderer {
  const gfm = options?.gfm !== false; // default to true

  function highlightCode(str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return (
          '<pre class="hljs"><code>' +
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
          '</code></pre>'
        );
      } catch {
        // fall through to default
      }
    }
    return '<pre class="hljs"><code>' + escapeHtml(str) + '</code></pre>';
  }

  const md = new MarkdownIt({
    html: true,
    linkify: gfm,
    typographer: gfm,
    breaks: false,
    highlight: highlightCode,
  });

  // Add GFM plugins
  md.use(taskLists, { enabled: false });
  md.use(footnote);
  md.use(inPlaceFootnotes);
  wrapClassedBlocks(md);

  return {
    render(markdown: string): string {
      if (!markdown) {
        return '';
      }
      return md.render(markdown);
    },

    renderWithBase(markdown: string, basePath: string): string {
      if (!markdown) {
        return '';
      }
      const html = md.render(markdown);
      return resolveImagePaths(html, basePath);
    },

    createDocumentContext(markdown: string): DocumentContext {
      return createDocumentContext(md, markdown);
    },

    renderFragment(fragment: string, context: DocumentContext, marks?: ChangeMarks): string {
      if (!fragment) {
        return '';
      }
      const env = createFragmentEnv(context);
      const tokens = md.parse(fragment, env);
      if (marks) {
        applyChangedClass(tokens, new Set(marks.lines), marks.className);
      }
      return md.renderer.render(tokens, md.options, env);
    },

    topLevelBlockRanges(markdown: string): LineRange[] {
      // Parse as a fragment so that footnote definitions stay in place with their lines
      return md
        .parse(markdown, createFragmentEnv())
        .flatMap((token) =>
          token.level === 0 && token.map ? [{ start: token.map[0], end: token.map[1] }] : [],
        );
    },
  };
}
