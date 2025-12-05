import * as vscode from "vscode";
import { SourceControlHistoryProvider } from "../providers/source-control-history.provider";
import * as path from "path";

const sourceControlHistoryProvider = new SourceControlHistoryProvider();

// Register TreeView for source control file history
export const treeView = vscode.window.createTreeView(
  "git-history.sourceControlFileHistory",
  {
    treeDataProvider: sourceControlHistoryProvider,
    showCollapseAll: false,
  }
);

// Register command to show commit diff from tree item
export const showCommitDiffCommand = vscode.commands.registerCommand(
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
export const refreshHistoryCommand = vscode.commands.registerCommand(
  "git-history.refreshSourceControlHistory",
  () => {
    sourceControlHistoryProvider.refresh();
  }
);
