import * as vscode from "vscode";
import { GitHistoryManager } from "../managers/git-history.manager";

const gitHistoryManager = new GitHistoryManager();

// Register a command to show Git history
export const showFileHistoryCommand = vscode.commands.registerCommand(
  "git-history.showFileHistory",
  async (uri?: vscode.Uri) => {
    await gitHistoryManager.showFileHistory(uri);
  }
);

// Register a command to navigate previous commit
export const navigatePreviousCommand = vscode.commands.registerCommand(
  "git-history.navigatePrevious",
  async () => {
    await gitHistoryManager.navigatePrevious();
  }
);

// Register a command to navigate next commit
export const navigateNextCommand = vscode.commands.registerCommand(
  "git-history.navigateNext",
  async () => {
    await gitHistoryManager.navigateNext();
  }
);
