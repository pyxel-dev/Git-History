import * as vscode from "vscode";
import { GitHistoryProvider } from "../providers/text-document-content.provider";

const gitHistoryProvider = new GitHistoryProvider();

export const openDiffView =
  vscode.workspace.registerTextDocumentContentProvider(
    "git-history",
    gitHistoryProvider
  );
