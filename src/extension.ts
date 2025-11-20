import * as vscode from "vscode";
import { GitHistoryProvider } from "./provider";
import { GitHistoryManager } from "./git-history-manager";

export function activate(context: vscode.ExtensionContext) {
  console.log("Git History extension Activated");

  const gitHistoryManager = new GitHistoryManager();
  const gitHistoryProvider = new GitHistoryProvider();

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

  context.subscriptions.push(showFileHistoryCommand);
}
