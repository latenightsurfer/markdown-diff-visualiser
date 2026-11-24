# Markdown Diff Visualiser Guide

This guide explains how to review documentation changes before you commit them.

## Installation

Install the extension from the [marketplace][marketplace] or from a `.vsix` file.

## Usage

1. Open a markdown file in a git repository.
2. Run **Show Changes** from the command palette or the editor title bar.
3. Pick the versions to compare in the toolbar.

The left pane shows the old version, the right pane the new version.

## Comparison modes

| Mode                  | Use it for                       |
| --------------------- | -------------------------------- |
| Committed vs Unstaged | reviewing your current edits     |
| Committed vs Staged   | checking what you are committing |
| Staged vs Unstaged    | edits made after staging         |

## Troubleshooting

> If nothing is highlighted, make sure the file is tracked by git.
>
> If the whole file is highlighted, check the line endings of the file.

Rendering problems can be reported on GitHub.[^issues]

## Example configuration

```json
{
  "markdownDiffVisualiser.theme": "dark",
  "markdownDiffVisualiser.wordDiff": true
}
```

## License

MIT

[marketplace]: https://marketplace.visualstudio.com/search?target=VSCode&term=markdown%20diff

[^issues]: Please include the markdown that fails to render and your VS Code version.
