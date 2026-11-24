# Clean Code Rules

Binding coding guideline for this repository (TypeScript, VS Code extension). Adapted from a
C# / .NET clean-code guideline to the structure and idioms of this project. Applies to every
change made by humans and AI agents.

New and changed code must follow these rules. Existing code that does not is cleaned up only
within the scope of a change (see Boy Scout Rule), larger clean-ups become their own task.

## 0. Architecture of this repository

The extension follows a ports-and-adapters split. Keep it that way.

| Layer             | Modules                                                                                                                                    | May import `vscode`, `child_process`, `fs`? |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| Core (pure logic) | `diffParser.ts`, `diffHighlighter.ts`, `markdownRenderer.ts`, `blockAlignment.ts`, `wordDiff.ts`, `documentFragments.ts`, `lineEndings.ts` | No                                          |
| Adapters (I/O)    | `gitService.ts` (git), `webviewPanelManager.ts` (webview)                                                                                  | Yes                                         |
| Controller        | `extension.ts` (command registration, orchestration)                                                                                       | Yes                                         |
| Webview runtime   | `src/webview/main.js`, `styles.css` (runs in the browser)                                                                                  | No, communicates only via `postMessage`     |

- Core modules are pure: string and data in, string and data out. They are testable without the
  VS Code mock.
- Adapters expose an `interface` (the port, e.g. `GitService`, `PanelManager`) and a `create…`
  factory function that returns it. Callers depend on the interface, not on the implementation.
- `extension.ts` wires adapters and core together. Business logic does not belong there; move it
  into a core module.

## 1. SOLID

- **SRP**: a module or function has one reason to change. Describe it in one sentence without
  "and". Not "one function per file": cohesive operations stay together.
- **OCP**: open for extension, closed for modification. For a growing set of variants prefer a
  lookup (`Record<DiffMode, …>`, a list of handlers) over a central `switch` that every new variant
  has to edit. A `switch` over a discriminated union is fine when it is exhaustive (`never` check in
  `default`).
- **LSP**: every implementation of an interface is substitutable for it, including test doubles.
- **ISP**: small interfaces. A function receives only what it uses (pass `string[]` lines, not the
  whole `DiffResult`, when it only needs lines).
- **DIP**: depend on interfaces (`GitService`, `PanelManager`, `MarkdownRenderer`), not on
  concrete implementations. Pass collaborators in as parameters.
- **Composition over inheritance (mandatory)**: no class hierarchies or abstract base classes to
  share our own logic. Share behaviour through a passed-in collaborator or a small helper function.
  Inheritance only where the platform requires it (e.g. `class GitError extends Error`).

## 2. Pattern roles: one function, one role

| Role      | Does                                                           | Naming                                      | Must not                                                  |
| --------- | -------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------- |
| Factory   | builds a new object or service (defaults, several inputs)      | `create<Product>` (`createRenderer`)        | change an existing object, convert 1:1 (that is a mapper) |
| Mapper    | translates one value 1:1 into another shape; pure, no I/O      | `to<Target>`, `map<Source>To<Target>`       | change its input, make business decisions, do I/O         |
| Mutator   | changes an existing mutable object in place                    | `apply…`, `set…`, `remove…`, returns `void` | exist in core modules (core returns new values instead)   |
| Data type | carries data (`interface` / `type`: `DiffHunk`, `PreviewData`) | noun                                        | contain methods, mapping or initialization logic          |

If code does not fit a well-known pattern, do not use the pattern's name.

## 3. DRY

Every piece of knowledge has one unambiguous representation. One helper for one concern, reused
everywhere (e.g. a single `escapeHtml`, a single line-ending normalisation), not copies per module.

## 4. KISS

The simplest solution that correctly solves the problem is the right one.

## 5. YAGNI

Implement only what is needed now. No speculative abstractions, options or configuration settings.

## 6. Additional principles

- **Separation of Concerns**: git access, file access, markdown rendering, diff computation,
  webview messaging and UI code live in separate modules (see section 0).
- **Law of Demeter**: talk only to immediate collaborators (parameters, locals, own module, injected
  dependencies). No `a.getB().getC().doD()`. Exempt: fluent builders, array method chains
  (`map`/`filter`/`reduce`) and VS Code API namespaces (`vscode.workspace.fs.readFile`).
- **Principle of Least Astonishment**: names and signatures do not hide side effects. `get…` does
  not mutate, `is…`/`has…` return `boolean` without side effects, `try…` does not throw for its
  expected failure case (return `undefined` or a result object). No behaviour-switching `boolean`
  parameters: use a string-literal union or two functions.
- **Boy Scout Rule**: leave code cleaner than found, but only small, safe improvements within the
  scope of the current change. Larger clean-ups become their own task.
- **CUPID** (design smell check, not a checklist): Composable, Unix philosophy (one thing well),
  Predictable, Idiomatic (repo conventions), Domain-based names (hunk, block, version, diff mode).
- **GRASP**: Information Expert (the module that owns the data does the work), Creator (the owner
  of objects creates them), Controller (`extension.ts` coordinates requests), Low Coupling / High
  Cohesion.

## 7. Function design

- One thing per function, at most 20–25 lines. Extract when longer.
- Guard clauses: return early on invalid input, avoid deep nesting.
- Prefer a parameter object over more than three positional parameters.

## 8. No magic numbers or strings

Named module-level constants in `UPPER_SNAKE_CASE` instead of inline literals, as in
`const LARGE_FILE_LINE_THRESHOLD = 50_000;`. CSS class names shared between extension and webview
are defined once and reused.

## 9. Immutability

| Use case                     | Form                                                            |
| ---------------------------- | --------------------------------------------------------------- |
| Data types, value objects    | `interface` / `type` with `readonly` properties where practical |
| Lists passed between modules | `readonly T[]`; never mutate a parameter                        |
| Constant tables              | `as const`                                                      |
| State change                 | return a new value (`{ ...block, type: 'modified' }`)           |

Local mutation inside a function (building an array with `push`) is fine as long as it does not
leak. Module-level mutable state is limited to the controller (`extension.ts`) and adapters.

## 10. Helper functions instead of extension methods

No prototype extension. Pure transformations are plain exported functions in a core module, without
I/O or `vscode` dependencies.

## 11. Delete, don't deprecate

Never add `@deprecated` tags, "legacy" markers or commented-out code. Unused function or type:
delete it and its tests. Changing a signature: migrate every caller in the same change, then delete
the old one. User-facing contracts (command IDs and menus in `package.json`, the webview message
protocol between `extension.ts` and `main.js`) are changed in both places in the same change.
Renaming a command ID breaks user keybindings: ask first.

## 12. Errors, types and lint

- `strict` TypeScript. No `any` (use `unknown` and narrow), no non-null assertion `!` to silence
  the compiler, no null checks the type system already rules out.
- `catch (error)` treats `error` as `unknown` and narrows with `instanceof`.
- Catch broadly only at boundaries (command handlers, webview message handlers): log to the
  "Markdown Diff Visualiser" output channel and show a user message. Do not silently swallow errors
  deeper down; if a fallback is intended, log it.
- If an operation receives a `CancellationToken`, let cancellation propagate instead of catching it.
- Every `eslint-disable` comment names the rule and a justification on the same line.

## 13. Project-specific rules

- Git is called only through `child_process.execFile`, never `exec` (no shell injection).
- Text read from different sources (git blobs, working tree) is normalised before comparison
  (line endings `\r\n` → `\n`).
- HTML built from markdown or user content is escaped; the webview keeps its Content Security
  Policy.
- Every VS Code `Disposable` is registered with `context.subscriptions`.
- `npm test`, `npm run lint` and `npm run format:check` pass before every commit.

## 14. Testing

Every change is covered by automated tests (Mocha + Chai, `src/test/**/*.test.ts`, all run with
`npm test`). Every bug fix gets a regression test that fails without the fix.

### Test levels

Many fast unit tests at the bottom, fewer integration tests, very few end-to-end tests.

| Level       | Scope                                                                 | Real                         | Replaced                                | File name                          |
| ----------- | --------------------------------------------------------------------- | ---------------------------- | --------------------------------------- | ---------------------------------- |
| Unit        | one module through its exported functions                             | only the module under test   | collaborators (`sinon`), VS Code (mock) | `<module>.test.ts`                 |
| Property    | invariants of one core function over generated input                  | the function under test      | nothing (pure core)                     | `<module>.<rule>.property.test.ts` |
| Integration | several modules together plus real git and file system                | modules, git, temp directory | only the VS Code API (mock) and webview | `<feature>.integration.test.ts`    |
| End-to-end  | the bundled extension inside a real VS Code (`@vscode/test-electron`) | everything                   | nothing                                 | introduced when first needed       |

- **Unit**: the default. Every new or changed function gets tests for its normal case, edge cases
  (empty input, first/last line, single line) and error case. No real git, file system, network or
  VS Code; the VS Code API comes from `src/test/mocks/vscode.ts` via `proxyquire`.
- **Property**: for invariants such as "output never contains `\r`" or "every table is rendered as
  `<table>`", using `fast-check`.
- **Integration**: for behaviour that only shows up when real pieces work together, e.g. git
  line-ending conversion (`core.autocrlf`) or the full pipeline from git to rendered HTML. Each test
  creates its own temporary git repository (`fs.mkdtempSync(os.tmpdir())`), sets every git config
  it relies on locally (`user.name`, `user.email`, `core.autocrlf`), and deletes the directory in
  `after`/`afterEach`. Assertions go against the data passed to the webview port
  (`PanelManager.showPreview`), not against the DOM.
- **End-to-end**: only for things the other levels cannot reach (command and menu contributions,
  webview scripts). Not set up yet; add it with the first test that needs it (YAGNI).
- **Manual check**: changes to the webview UI are additionally checked in the packaged `.vsix`.

### Rules for all tests

- **Core first**: logic lives in pure core modules (section 0) so it can be unit-tested with plain
  inputs and outputs. If a unit test needs many mocks, move the logic out of the adapter.
- **Structure**: one `describe` per function or feature, one behaviour per `it`, named as a
  sentence (`it('renders a table whose middle row changed as one table')`). Arrange, act, assert,
  separated by a blank line. No logic (loops, conditionals) in tests beyond building input data.
- **Assertions**: assert on observable behaviour (returned values, rendered HTML, calls to a port),
  not on private helpers or implementation details.
- **Independent and deterministic**: tests share no mutable state, restore stubs in `afterEach`,
  and do not depend on time, order, network, global git config or the machine's line-ending
  settings.
- **Fast**: a unit test runs in milliseconds; an integration test stays well below a second. Slow
  tests are a design smell.
- **Test code is code**: the rules of this guideline apply, with small named helpers for building
  input data (e.g. `makeHunk`, `createTempRepo`).
