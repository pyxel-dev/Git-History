import { execSync } from "child_process";
import * as vscode from "vscode";

export class GitHistoryProvider implements vscode.TextDocumentContentProvider {
  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const query = new URLSearchParams(uri.query);
    const ref = query.get("ref");
    const workspacePath = query.get("path");

    if (!ref || !workspacePath) {
      return "";
    }

    let commitInfo: string;

    try {
      const log = execSync(`git log -1 --format=%H|%an|%ai|%s ${ref}`, {
        cwd: workspacePath,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
      const [hash, author, date, ...messageParts] = log.trim().split("|");
      const message = messageParts.join("|").trim();
      commitInfo = `\n// ---\n// Commit: ${hash}\n// Auteur: ${author}\n// Date: ${new Date(
        date
      ).toLocaleString()}\n// Message: ${message}\n`;
    } catch (error) {
      commitInfo = "";
    }

    try {
      const content = execSync(`git show ${ref}:"${uri.path}"`, {
        cwd: workspacePath,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
      commitInfo += `\n${content}`;
    } catch (error) {
      return commitInfo;
    }

    return commitInfo;
  }
}
