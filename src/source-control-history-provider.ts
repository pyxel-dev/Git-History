import * as vscode from "vscode";
import { execSync } from "child_process";
import * as path from "path";
import { CommitInfo } from "./model";

export class SourceControlHistoryProvider
  implements vscode.TreeDataProvider<CommitTreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    CommitTreeItem | undefined | null | void
  > = new vscode.EventEmitter<CommitTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    CommitTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private currentFile?: string;
  private workspaceRoot?: string;
  private commits: CommitInfo[] = [];

  constructor() {
    // Listen to active editor changes
    vscode.window.onDidChangeActiveTextEditor(() => {
      this.refresh();
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CommitTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: CommitTreeItem): Promise<CommitTreeItem[]> {
    if (element) {
      return [];
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.scheme !== "file") {
      return [];
    }

    this.currentFile = editor.document.uri.fsPath;
    this.workspaceRoot = vscode.workspace.getWorkspaceFolder(
      editor.document.uri
    )?.uri.fsPath;

    if (!this.workspaceRoot) {
      return [];
    }

    try {
      this.commits = await this.getFileCommits(
        this.currentFile,
        this.workspaceRoot
      );

      return this.commits.map(
        (commit, index) =>
          new CommitTreeItem(
            commit,
            this.currentFile!,
            this.workspaceRoot!,
            index,
            this.commits.length
          )
      );
    } catch (error) {
      return [];
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
        .filter((line) => line.trim())
        .map((line) => {
          const [hash, author, date, ...messageParts] = line.split("|");
          const message = messageParts.join("|");
          return { hash, author, date, message };
        });
    } catch (error) {
      return [];
    }
  }
}

export class CommitTreeItem extends vscode.TreeItem {
  constructor(
    public readonly commit: CommitInfo,
    public readonly filePath: string,
    public readonly workspaceRoot: string,
    public readonly index: number,
    public readonly totalCommits: number
  ) {
    super(commit.message, vscode.TreeItemCollapsibleState.None);

    this.tooltip = `${commit.hash}\n${commit.author}\n${new Date(
      commit.date
    ).toLocaleString()}\n\n${commit.message}`;

    this.description = `${commit.author} - ${this.formatDate(commit.date)}`;

    this.iconPath = new vscode.ThemeIcon("git-commit");

    this.command = {
      command: "git-history.showCommitDiff",
      title: "Show Commit Diff",
      arguments: [
        this.filePath,
        this.workspaceRoot,
        this.commit,
        this.index,
        this.totalCommits,
      ],
    };
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 30) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
}
