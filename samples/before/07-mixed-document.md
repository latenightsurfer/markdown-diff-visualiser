# Markdown Diff Visualiser Guide

This guide explains how to review documentation changes.

## Installation

Install the extension from the [marketplace][marketplace] or from a `.vsix` file.

## Usage

1. Open a markdown file in a git repository.
2. Run **Show Changes** from the command palette.
3. Pick the versions to compare in the toolbar.

The left pane shows the old version, the right pane the new version.

## Comparison modes

| Mode                  | Use it for                    |
| --------------------- | ----------------------------- |
| Committed vs Unstaged | reviewing your current edits  |
| Committed vs Staged   | checking what you will commit |
| Staged vs Unstaged    | edits made after staging      |

## Troubleshooting

> If nothing is highlighted, make sure the file is tracked by git.

Rendering problems can be reported on GitHub.[^issues]

## Example configuration

```json
{
  "markdownDiffVisualiser.theme": "auto",
  "markdownDiffVisualiser.wordDiff": true
}
```

## License

MIT

[marketplace]: https://marketplace.visualstudio.com/vscode

[^issues]: Please include the markdown that fails to render.
