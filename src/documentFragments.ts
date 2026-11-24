/**
 * Document fragments - Lets a part of a markdown document render like it does inside the whole
 * document. The diff renders every changed block on its own, so reference links and footnotes
 * need the definitions of the whole document, and footnote definitions have to stay where they
 * are instead of moving to the end of each fragment.
 */

import MarkdownIt from 'markdown-it';

type Token = ReturnType<MarkdownIt['parse']>[number];

/** Definitions of a whole document that its fragments need for rendering. */
export interface DocumentContext {
  /** Reference link definitions, as markdown-it collects them. */
  readonly references: Readonly<Record<string, unknown>>;
  /** Footnote labels of the document, with their number if the document references them. */
  readonly footnotes: ReadonlyMap<string, number | undefined>;
}

/** One footnote that markdown-it-footnote collected while parsing. */
interface FootnoteNote {
  readonly label?: string;
  readonly tokens?: Token[];
}

/** The parts of the markdown-it environment this module reads or writes. */
interface MarkdownEnv {
  references?: Record<string, unknown>;
  footnotes?: { refs?: Record<string, number>; list?: FootnoteNote[] };
  fragmentOf?: DocumentContext;
}

const FOOTNOTE_LABEL_PREFIX = ':';
const DEFINITION_OPEN = 'footnote_definition_open';
const DEFINITION_CLOSE = 'footnote_definition_close';
const EMPTY_CONTEXT: DocumentContext = { references: {}, footnotes: new Map() };

/** Collect the definitions of a whole document. */
export function createDocumentContext(md: MarkdownIt, markdown: string): DocumentContext {
  const env: MarkdownEnv = {};
  md.parse(markdown, env);
  const footnotes = Object.entries(env.footnotes?.refs ?? {}).map(
    ([key, id]): [string, number | undefined] => [
      key.slice(FOOTNOTE_LABEL_PREFIX.length),
      id >= 0 ? id + 1 : undefined,
    ],
  );
  return { references: { ...env.references }, footnotes: new Map(footnotes) };
}

/** A fresh markdown-it environment for rendering one fragment of the given document. */
export function createFragmentEnv(context: DocumentContext = EMPTY_CONTEXT): object {
  const labels = [...context.footnotes.keys()];
  const env: MarkdownEnv = {
    references: { ...context.references },
    footnotes: {
      refs: Object.fromEntries(labels.map((label) => [FOOTNOTE_LABEL_PREFIX + label, -1])),
    },
    fragmentOf: context,
  };
  return env;
}

/**
 * Plugin for markdown-it with markdown-it-footnote: when parsing with a fragment environment,
 * footnote definitions render where they are, numbered like in the whole document.
 */
export function inPlaceFootnotes(md: MarkdownIt): void {
  md.core.ruler.before('footnote_tail', 'footnote_in_place', (state) => {
    const env = state.env as MarkdownEnv;
    if (env.fragmentOf) {
      keepDefinitionsInPlace(state.tokens, env.fragmentOf);
      keepInlineNotesOnly(state.tokens, env);
    }
  });
  md.renderer.rules[DEFINITION_OPEN] = (tokens, idx) => renderDefinitionOpen(tokens[idx]);
  md.renderer.rules[DEFINITION_CLOSE] = (tokens, idx) => renderDefinitionClose(tokens[idx]);
}

/**
 * Turn the definition tokens, which footnote_tail would move to the end, into tokens that stay
 * in place. They get the source lines of their content, and references get document numbers.
 */
function keepDefinitionsInPlace(tokens: readonly Token[], context: DocumentContext): void {
  const openDefinitions: Token[] = [];
  for (const token of tokens) {
    if (token.type === 'footnote_reference_open') {
      token.type = DEFINITION_OPEN;
      token.meta = { ...token.meta, number: context.footnotes.get(token.meta.label) };
      openDefinitions.push(token);
    } else if (token.type === 'footnote_reference_close') {
      token.type = DEFINITION_CLOSE;
      token.meta = openDefinitions.pop()?.meta;
    } else {
      extendMaps(openDefinitions, token);
      numberReferences(token.children ?? [], context);
    }
  }
}

function extendMaps(definitions: readonly Token[], token: Token): void {
  if (!token.map) {
    return;
  }
  for (const definition of definitions) {
    definition.map = [definition.map?.[0] ?? token.map[0], token.map[1]];
  }
}

function numberReferences(inlineTokens: readonly Token[], context: DocumentContext): void {
  for (const token of inlineTokens) {
    const number = token.type === 'footnote_ref' && context.footnotes.get(token.meta.label);
    if (number) {
      token.meta = { ...token.meta, id: number - 1 };
    }
  }
}

/**
 * Inline footnotes (`^[…]`) have no definition to keep in place, so footnote_tail still lists
 * them after the fragment. Remove the labelled footnotes from that list and renumber the rest.
 */
function keepInlineNotesOnly(tokens: readonly Token[], env: MarkdownEnv): void {
  const notes = env.footnotes?.list ?? [];
  const newIds = new Map<number, number>();
  notes.forEach((note, id) => {
    if (note.tokens) {
      newIds.set(id, newIds.size);
    }
  });
  for (const token of tokens.flatMap((block) => block.children ?? [])) {
    if (token.type === 'footnote_ref' && token.meta.label === undefined) {
      token.meta = { ...token.meta, id: newIds.get(token.meta.id) };
    }
  }
  if (env.footnotes) {
    const inlineNotes = notes.filter((note) => note.tokens);
    env.footnotes.list = inlineNotes.length > 0 ? inlineNotes : undefined;
  }
}

function renderDefinitionOpen(token: Token): string {
  const number: number | undefined = token.meta?.number;
  const list =
    number === undefined
      ? '<ul class="footnotes-list">'
      : `<ol class="footnotes-list" start="${number}">`;
  const id = number === undefined ? '' : ` id="fn${number}"`;
  return `<section class="footnotes">\n${list}\n<li${id} class="footnote-item">`;
}

function renderDefinitionClose(token: Token): string {
  const list = token.meta?.number === undefined ? 'ul' : 'ol';
  return `</li>\n</${list}>\n</section>\n`;
}
