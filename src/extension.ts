import * as vscode from "vscode";
import {
  refreshHistoryCommand,
  showCommitDiffCommand,
  treeView,
} from "./commands/scm.command";
import {
  navigateNextCommand,
  navigatePreviousCommand,
  showFileHistoryCommand,
} from "./commands/diff.command";
import { openDiffView } from "./workspace/text-document-content.workspace";
import { GitBlameDecorator } from "./decorators/git-blame.decorator";

export function activate(context: vscode.ExtensionContext) {
  console.log("Git History extension Activated");

  const gitBlameDecorator = new GitBlameDecorator();

  context.subscriptions.push(
    showFileHistoryCommand,
    navigatePreviousCommand,
    navigateNextCommand,
    treeView,
    showCommitDiffCommand,
    refreshHistoryCommand,
    gitBlameDecorator,
    openDiffView
  );
}
