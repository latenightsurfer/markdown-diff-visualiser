/**
 * Integration Tests for the "Show Changes" command (committed vs unstaged).
 *
 * Runs the real pipeline: git, file system, diff library, parser, block alignment, renderer and
 * highlighter. Only the VS Code API and the webview panel are replaced; assertions are made on
 * the HTML handed to the panel (PanelManager.showPreview).
 *
 * Covers issue #8 (CRLF working tree with core.autocrlf) and issue #9 (partially changed tables).
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as sinon from 'sinon';
import { createMockExtensionContext } from './mocks/vscode';
import { commitFile, createTempRepo, git, removeTempRepo } from './helpers/gitRepo';
import { countOccurrences } from './helpers/highlight';

const proxyquire = require('proxyquire');

const SHOW_CHANGES_COMMAND = 'markdownDiffVisualiser.showChanges';

interface ShownPreview {
  oldHtml: string;
  newHtml: string;
}

/**
 * Load the real extension with a minimal VS Code API that reads files from disk, run the
 * "Show Changes" command for the file and return what was shown in the panel.
 */
async function showChanges(filePath: string): Promise<ShownPreview> {
  const commands: Record<string, (uri: { fsPath: string }) => Promise<void>> = {};
  const showPreview = sinon.stub();
  const noopDisposable = { dispose: sinon.stub() };
  const vscodeMock = {
    window: {
      createOutputChannel: sinon
        .stub()
        .returns({ appendLine: sinon.stub(), dispose: sinon.stub() }),
      showErrorMessage: sinon.stub(),
      showInformationMessage: sinon.stub(),
      showWarningMessage: sinon.stub(),
    },
    commands: {
      registerCommand: (id: string, handler: (uri: { fsPath: string }) => Promise<void>) => {
        commands[id] = handler;
        return noopDisposable;
      },
    },
    workspace: {
      fs: { readFile: async (uri: { path: string }) => fs.promises.readFile(uri.path) },
      createFileSystemWatcher: () => ({
        onDidChange: sinon.stub(),
        onDidCreate: sinon.stub(),
        dispose: sinon.stub(),
      }),
    },
    Uri: { file: (fsPath: string) => ({ path: fsPath, fsPath }) },
    RelativePattern: class {},
    '@noCallThru': true,
  };
  const extension = proxyquire('../extension', {
    vscode: vscodeMock,
    './webviewPanelManager': {
      createPanelManager: () => ({ showPreview, postMessage: sinon.stub(), dispose: sinon.stub() }),
      '@noCallThru': true,
    },
  });

  extension.activate(createMockExtensionContext());
  await commands[SHOW_CHANGES_COMMAND]({ fsPath: filePath });
  extension.deactivate();

  expect(showPreview.calledOnce, 'panel should show exactly one preview').to.be.true;
  return showPreview.firstCall.args[0];
}

function paragraphs(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `Paragraph ${index + 1}.`);
}

describe('Integration: Show Changes (committed vs unstaged)', function () {
  let repoDir: string;

  beforeEach(function () {
    repoDir = createTempRepo();
  });

  afterEach(function () {
    removeTempRepo(repoDir);
  });

  it('highlights only the changed paragraph when the working tree uses CRLF (#8)', async function () {
    git(repoDir, 'config', 'core.autocrlf', 'true');
    const committed = ['# Title', ...paragraphs(5)];
    const filePath = commitFile(repoDir, 'doc.md', committed.join('\n\n') + '\n');
    const edited = committed.map((line) => (line === 'Paragraph 3.' ? 'Paragraph three.' : line));
    fs.writeFileSync(filePath, edited.join('\r\n\r\n') + '\r\n');

    const preview = await showChanges(filePath);

    expect(countOccurrences(preview.oldHtml, 'diff-removed-block')).to.equal(1);
    expect(countOccurrences(preview.newHtml, 'diff-added-block')).to.equal(1);
    expect(preview.newHtml).to.match(/<div class="diff-added-block"><p>Paragraph <span[^>]*>three/);
    expect(preview.newHtml).to.not.include('\r');
  });

  it('renders a table with one changed row as one table (#9)', async function () {
    const table = (value: string) =>
      `# Title\n\n| Name | Value |\n|---|---|\n| a | 1 |\n| b | ${value} |\n| c | 3 |\n\nAfter.\n`;
    const filePath = commitFile(repoDir, 'table.md', table('2'));
    fs.writeFileSync(filePath, table('20'));

    const preview = await showChanges(filePath);

    expect(countOccurrences(preview.oldHtml, '<table>')).to.equal(1);
    expect(countOccurrences(preview.newHtml, '<table>')).to.equal(1);
    expect(countOccurrences(preview.newHtml, '<tr class="diff-added-part">')).to.equal(1);
    expect(preview.newHtml).to.not.include('| b');
  });
});
