import * as vscode from "vscode";
import { execSync } from "child_process";
import * as path from "path";
import { CommitInfo } from "../models/commit-info.model";

enum MessageType {
  NO_FILE_SELECTED = "No file selected or open in the editor.",
  NOT_LOCAL_FILE = "The selected file is not a local file.",
  FILE_NOT_IN_WORKSPACE = "The selected file is not in a workspace.",
  FAILED_TO_GET_HISTORY = "Failed to get file history:",
}

export class GitHistoryManager {
  private currentCommitIndex: number = -1;
  private commits: CommitInfo[] = [];
  private currentFile?: string;
  private workspaceRoot?: string;

  public async showFileHistory(filePath?: vscode.Uri): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (!filePath && !editor) {
      vscode.window.showErrorMessage(MessageType.NO_FILE_SELECTED);
      return;
    }

    const uri = filePath || editor!.document.uri;

    if (uri.scheme !== "file") {
      vscode.window.showErrorMessage(MessageType.NOT_LOCAL_FILE);
      return;
    }

    this.currentFile = uri.fsPath;
    this.workspaceRoot = vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath;

    if (!this.workspaceRoot) {
      vscode.window.showErrorMessage(MessageType.FILE_NOT_IN_WORKSPACE);
      return;
    }

    // Get commit history for the file
    try {
      this.commits = await this.getFileCommits(
        this.currentFile,
        this.workspaceRoot
      );

      if (this.commits.length === 0) {
        vscode.window.showInformationMessage(
          "No Git history found for this file."
        );
        return;
      }

      this.currentCommitIndex = 0;
      await this.showCommitDiff();
    } catch (error) {
      vscode.window.showErrorMessage(
        `${MessageType.FAILED_TO_GET_HISTORY} ${error}`
      );
    }
  }

  public async navigatePrevious(): Promise<void> {
    if (this.currentCommitIndex < this.commits.length - 1) {
      this.currentCommitIndex++;
      await this.showCommitDiff();
    }
  }

  public async navigateNext(): Promise<void> {
    if (this.currentCommitIndex > 0) {
      this.currentCommitIndex--;
      await this.showCommitDiff();
    }
  }

  private async getFileCommits(
    filePath: string,
    workspaceRoot: string
  ): Promise<CommitInfo[]> {
    try {
      const relativePath = path.relative(workspaceRoot, filePath);

      const gitArgs = [
        "log",
        "--follow",
        "--format=%H|%an|%ai|%s",
        "--",
        relativePath,
      ];

      const gitOutput = execSync(
        `git ${gitArgs.map((a) => `'${a.replace(/'/g, "'''")}'`).join(" ")}`,
        {
          cwd: workspaceRoot,
          encoding: "utf-8",
          maxBuffer: 10 * 1024 * 1024,
        }
      );

      return gitOutput
        .trim()
        .split("\n")
        .map((line) => {
          const [hash, author, date, ...messageParts] = line.split("|");
          const message = messageParts.join("|");
          return { hash, author, date, message };
        });
    } catch (error) {
      vscode.window.showErrorMessage(
        `${MessageType.FAILED_TO_GET_HISTORY} ${error}`
      );
      return [];
    }
  }

  private async showCommitDiff(): Promise<void> {
    if (!this.currentFile || !this.workspaceRoot) {
      return;
    }

    const commit = this.commits[this.currentCommitIndex];
    const relativePath = path.relative(this.workspaceRoot, this.currentFile);

    try {
      // Create URIs for the current and previous commit versions of the file
      const previousCommitHash =
        this.currentCommitIndex < this.commits.length - 1
          ? this.commits[this.currentCommitIndex + 1].hash
          : `${commit.hash}~1`; // ^

      const leftUri = vscode.Uri.parse(
        `git-history:${relativePath}?ref=${previousCommitHash}&path=${this.workspaceRoot}`
      );
      const rightUri = vscode.Uri.parse(
        `git-history:${relativePath}?ref=${commit.hash}&path=${this.workspaceRoot}`
      );

      const title = `${path.basename(this.currentFile)} - ${commit.hash} (${
        this.currentCommitIndex + 1
      }/${this.commits.length})`;

      // Show the diff in a new editor tab
      await vscode.commands.executeCommand(
        "vscode.diff",
        leftUri,
        rightUri,
        title
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to show commit diff: ${error}`);
    }
  }
}
