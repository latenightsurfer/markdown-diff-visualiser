# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Security

- Update `markdown-it` to 14.3.3 and `linkify-it` to 5.0.2, which ship in the extension: fixes
  several denial-of-service issues (quadratic parsing time on crafted markdown).
- Update build and test tooling (`esbuild`, `eslint`, `typescript-eslint`, `js-yaml`,
  `serialize-javascript`, `minimatch`, `brace-expansion`) to versions without known
  vulnerabilities. `npm audit` reports no vulnerabilities.

## [0.1.0] - 2026-11-24

First release of this fork of
[arjuntic/markdown-diff-visualiser](https://github.com/arjuntic/markdown-diff-visualiser).

### Fixed

- Whole file highlighted as changed when the working tree uses CRLF line endings
  (`core.autocrlf=true`) ([#8]). Also fixed in `scripts/preview-diff.js`.
- Tables, lists and code blocks broke apart when only part of them changed ([#9]).
- Word highlights broke markup (`|`, `**`, list markers) and HTML entities; they now work inside
  tables, lists and formatted text.
- Footnote references and reference-style links in a changed block were shown as source text.
- Changed footnote and link definitions were invisible.
- Table row striping hid row highlights; minimap markers for table rows pointed to the wrong place.

### Changed

- Inside a table, list or blockquote only the changed rows, items or paragraphs are highlighted.
- Lines that differ only in whitespace (e.g. a re-padded table) or in list numbering count as
  unchanged.
- Footnote definitions are shown where they are in the source, numbered like in the document.
- A changed link definition (`[ref]: url`) is shown as source with the changed part marked.
- Repository, issue and homepage links point to this fork.

### Added

- Coding and testing guideline in `docs/clean-code.md`.
- Sample changes in `samples/` and `scripts/create-sample-repo.ps1` for manual checks.
- Integration tests against temporary git repositories; formatting check in CI.

## [0.0.1] - 2025-01-01

### Added

- Initial release
- Side-by-side rendered markdown diff preview
- Block-level and word-level diff highlighting
- Three comparison modes (committed vs unstaged, committed vs staged, staged vs unstaged)
- Scrollbar minimap with change markers
- Aligned scrolling between panes
- Full GFM support (tables, task lists, code blocks, footnotes)
- Image and video rendering in preview
- Theme-aware styling (light/dark/high-contrast)
- Right-click context menu support (editor, explorer, SCM)

[0.1.0]: https://github.com/latenightsurfer/markdown-diff-visualiser/releases/tag/v0.1.0
[#8]: https://github.com/arjuntic/markdown-diff-visualiser/issues/8
[#9]: https://github.com/arjuntic/markdown-diff-visualiser/issues/9
