# Sample files

Prepared markdown changes for checking the extension by hand (see "Manual check" in
[docs/clean-code.md](../docs/clean-code.md)). `before/` holds the committed version, `after/`
the edited version of each file.

## Create the sample repository

```powershell
./scripts/create-sample-repo.ps1
code ../markdown-diff-samples
```

The script creates a git repository next to this one, commits `before/` and copies `after/`
over it. Open a file there and run **Markdown Diff Visualiser: Show Changes**.

## What to look for

| File                        | Change                                                               | Expected                                                                                                       |
| --------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `01-paragraphs.md`          | edited words, bold text and link text; replaced paragraph            | changed paragraphs filled, changed words marked, markup intact                                                 |
| `02-tables.md`              | one changed cell, one added row, one removed row, header             | every table rendered as a table; only the changed rows marked; changed cells marked word by word               |
| `03-lists.md`               | changed item, inserted step, checked task, nested items              | one list per side; only the changed items marked                                                               |
| `04-code-blocks.md`         | line added and line changed inside fenced code blocks                | one code block per side, marked as a whole, syntax highlighting intact                                         |
| `05-quotes-and-headings.md` | changed paragraph inside a blockquote, renamed heading               | only the changed quote paragraph and heading marked                                                            |
| `06-crlf-line-endings.md`   | one paragraph; working tree written with CRLF (issue #8)             | only that paragraph marked, not the whole file                                                                 |
| `07-mixed-document.md`      | small changes spread over the document, footnote, table, link target | several separate changes, footnote numbered and its definition marked, changed link definition shown as source |
| `08-new-file.md`            | file does not exist in the last commit                               | whole file shown as added                                                                                      |
