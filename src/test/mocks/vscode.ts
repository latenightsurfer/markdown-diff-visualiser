/**
 * Mock for the 'vscode' module used in unit tests.
 *
 * Provides stubs for the VS Code APIs used by webviewPanelManager.ts,
 * including WebviewPanel, ExtensionContext, Uri, and window APIs.
 */

import * as sinon from 'sinon';

// --- Uri mock ---

export class Uri {
  readonly scheme: string;
  readonly path: string;

  private constructor(scheme: string, path: string) {
    this.scheme = scheme;
    this.path = path;
  }

  static file(path: string): Uri {
    return new Uri('file', path);
  }

  static joinPath(base: Uri, ...pathSegments: string[]): Uri {
    const joined = [base.path, ...pathSegments].join('/');
    return new Uri(base.scheme, joined);
  }

  toString(): string {
    return `${this.scheme}://${this.path}`;
  }
}

// --- Enums ---

export enum ViewColumn {
  One = 1,
  Two = 2,
  Three = 3,
}

export enum ColorThemeKind {
  Light = 1,
  Dark = 2,
  HighContrast = 3,
  HighContrastLight = 4,
}

// --- Shared mock types ---

export type Listener = (...args: unknown[]) => void;

export interface Disposable {
  dispose(): unknown;
}

/** Callback signature of `child_process.execFile`, as used by the code under test. */
export type ExecFileCallback = (error: Error | null, stdout: string, stderr: string) => void;

export interface MockWebview {
  html: string;
  options: Record<string, unknown>;
  cspSource: string;
  onDidReceiveMessage: sinon.SinonStub;
  postMessage: sinon.SinonStub;
  asWebviewUri: sinon.SinonStub;
}

export interface MockWebviewPanel {
  viewType: string;
  title: string;
  webview: MockWebview;
  visible: boolean;
  viewColumn: ViewColumn;
  onDidDispose: sinon.SinonStub;
  reveal: sinon.SinonStub;
  dispose: sinon.SinonStub;
  /** Test helper to access dispose listeners */
  _onDidDisposeListeners: Listener[];
}

export interface MockMemento {
  get: sinon.SinonStub;
  update: sinon.SinonStub;
}

export interface MockExtensionContext {
  extensionUri: Uri;
  extensionPath: string;
  subscriptions: Disposable[];
  workspaceState: MockMemento;
  globalState: MockMemento;
  storagePath: string;
  globalStoragePath: string;
  logPath: string;
}

export interface MockOutputChannel {
  appendLine: sinon.SinonStub;
  dispose: sinon.SinonStub;
}

export interface MockTextEditor {
  document: { uri: { fsPath: string }; languageId: string };
}

export interface MockWorkspace {
  workspaceFolders: { uri: { fsPath: string }; name: string; index: number }[];
  fs: { readFile: sinon.SinonStub };
  createFileSystemWatcher: sinon.SinonStub;
}

export interface MockCommands {
  registerCommand: sinon.SinonStub;
}

/** The extension module as loaded through proxyquire with the mocks above. */
export interface ExtensionModule {
  activate(context: MockExtensionContext): void;
  deactivate(): void;
}

/** Shape of the `GitError` class that tests inject in place of the real one. */
export type GitErrorConstructor = new (message: string, code: string) => Error & { code: string };

/**
 * Register a listener and its disposable, mimicking VS Code's `onDid…` event functions.
 */
function registerListener(
  listeners: Listener[],
  listener: Listener,
  disposables?: Disposable[],
): Disposable {
  listeners.push(listener);
  const disposable = { dispose: sinon.stub() };
  disposables?.push(disposable);
  return disposable;
}

// --- Webview mock ---

export function createMockWebview(): MockWebview {
  return {
    html: '',
    options: {},
    cspSource: 'mock-csp-source',
    onDidReceiveMessage: sinon.stub().returns({ dispose: sinon.stub() }),
    postMessage: sinon.stub().resolves(true),
    asWebviewUri: sinon.stub().callsFake((uri: Uri) => uri),
  };
}

// --- WebviewPanel mock ---

export function createMockWebviewPanel(): MockWebviewPanel {
  const onDidDisposeListeners: Listener[] = [];

  return {
    viewType: 'markdownDiffVisualiser',
    title: '',
    webview: createMockWebview(),
    visible: true,
    viewColumn: ViewColumn.One,
    onDidDispose: sinon
      .stub()
      .callsFake((listener: Listener, _thisArg?: unknown, disposables?: Disposable[]) =>
        registerListener(onDidDisposeListeners, listener, disposables),
      ),
    reveal: sinon.stub(),
    dispose: sinon.stub().callsFake(() => {
      // Trigger onDidDispose listeners when panel is disposed
      onDidDisposeListeners.forEach((fn) => fn());
    }),
    _onDidDisposeListeners: onDidDisposeListeners,
  };
}

// --- ExtensionContext mock ---

export function createMockExtensionContext(): MockExtensionContext {
  return {
    extensionUri: Uri.file('/mock/extension'),
    extensionPath: '/mock/extension',
    subscriptions: [],
    workspaceState: {
      get: sinon.stub(),
      update: sinon.stub(),
    },
    globalState: {
      get: sinon.stub(),
      update: sinon.stub(),
    },
    storagePath: '/mock/storage',
    globalStoragePath: '/mock/global-storage',
    logPath: '/mock/log',
  };
}

// --- Theme change listener tracking ---

let themeChangeListeners: Listener[] = [];

export function _getThemeChangeListeners(): Listener[] {
  return themeChangeListeners;
}

export function _resetThemeChangeListeners(): void {
  themeChangeListeners = [];
}

// --- window mock ---

export const window = {
  createWebviewPanel: sinon.stub(),
  onDidChangeActiveColorTheme: sinon
    .stub()
    .callsFake((listener: Listener, _thisArg?: unknown, disposables?: Disposable[]) =>
      registerListener(themeChangeListeners, listener, disposables),
    ),
  showErrorMessage: sinon.stub(),
  showInformationMessage: sinon.stub(),
  showWarningMessage: sinon.stub(),
};
