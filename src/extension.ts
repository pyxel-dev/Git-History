import * as vscode from "vscode";
import { GitHistoryProvider } from "./provider";
import { GitHistoryManager } from "./git-history-manager";
import { GitBlameDecorator } from "./git-blame-decorator";
import { SourceControlHistoryProvider } from "./source-control-history-provider";
import * as path from "path";

export function activate(context: vscode.ExtensionContext) {
  console.log("Git History extension Activated");

  const gitHistoryManager = new GitHistoryManager();
  const gitHistoryProvider = new GitHistoryProvider();
  const gitBlameDecorator = new GitBlameDecorator();
  const sourceControlHistoryProvider = new SourceControlHistoryProvider();

  // Register the Git history content provider
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      "git-history",
      gitHistoryProvider
    )
  );

  // Register a command to show Git history
  const showFileHistoryCommand = vscode.commands.registerCommand(
    "git-history.showFileHistory",
    async (uri?: vscode.Uri) => {
      await gitHistoryManager.showFileHistory(uri);
    }
  );

  // Register a command to navigate previous commit
  const navigatePreviousCommand = vscode.commands.registerCommand(
    "git-history.navigatePrevious",
    async () => {
      await gitHistoryManager.navigatePrevious();
    }
  );

  // Register a command to navigate next commit
  const navigateNextCommand = vscode.commands.registerCommand(
    "git-history.navigateNext",
    async () => {
      await gitHistoryManager.navigateNext();
    }
  );

  // Register TreeView for source control file history
  const treeView = vscode.window.createTreeView(
    "git-history.sourceControlFileHistory",
    {
      treeDataProvider: sourceControlHistoryProvider,
      showCollapseAll: false,
    }
  );

  // Register command to show commit diff from tree item
  const showCommitDiffCommand = vscode.commands.registerCommand(
    "git-history.showCommitDiff",
    async (
      filePath: string,
      workspaceRoot: string,
      commit: { hash: string; author: string; date: string; message: string },
      index: number,
      totalCommits: number
    ) => {
      const relativePath = path.relative(workspaceRoot, filePath);
      const previousCommitHash =
        index < totalCommits - 1 ? `${commit.hash}~1` : `${commit.hash}~1`;

      const leftUri = vscode.Uri.parse(
        `git-history:${relativePath}?ref=${previousCommitHash}&path=${workspaceRoot}`
      );
      const rightUri = vscode.Uri.parse(
        `git-history:${relativePath}?ref=${commit.hash}&path=${workspaceRoot}`
      );

      const title = `${path.basename(filePath)} - ${commit.hash.substring(
        0,
        7
      )} - ${commit.message}`;

      await vscode.commands.executeCommand(
        "vscode.diff",
        leftUri,
        rightUri,
        title
      );
    }
  );

  // Register command to refresh the tree view
  const refreshHistoryCommand = vscode.commands.registerCommand(
    "git-history.refreshSourceControlHistory",
    () => {
      sourceControlHistoryProvider.refresh();
    }
  );

  context.subscriptions.push(
    showFileHistoryCommand,
    navigatePreviousCommand,
    navigateNextCommand,
    treeView,
    showCommitDiffCommand,
    refreshHistoryCommand,
    gitBlameDecorator
  );
}
