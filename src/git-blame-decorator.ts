import * as vscode from "vscode";
import { execSync } from "child_process";
import * as path from "path";

interface BlameInfo {
  hash: string;
  fullHash: string;
  author: string;
  authorEmail: string;
  date: string;
  dateISO: string;
  message: string;
  committer: string;
  committerEmail: string;
}

export class GitBlameDecorator {
  private decorationType: vscode.TextEditorDecorationType;
  private blameCache: Map<string, Map<number, BlameInfo>> = new Map();
  private disposables: vscode.Disposable[] = [];
  private hoverProvider: vscode.Disposable | null = null;

  constructor() {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        margin: "0 0 0 3em",
        color: new vscode.ThemeColor("editorCodeLens.foreground"),
      },
    });

    // Listen for cursor position changes
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection((e) => {
        this.updateDecoration(e.textEditor);
      })
    );

    // Listen for active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          this.updateDecoration(editor);
        }
      })
    );

    // Listen for document changes to invalidate cache
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        const filePath = e.document.uri.fsPath;
        this.blameCache.delete(filePath);
      })
    );

    // Listen for document saves to refresh blame
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((document) => {
        const filePath = document.uri.fsPath;
        this.blameCache.delete(filePath);
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.uri.fsPath === filePath) {
          this.updateDecoration(editor);
        }
      })
    );

    // Initial decoration for the active editor
    if (vscode.window.activeTextEditor) {
      this.updateDecoration(vscode.window.activeTextEditor);
    }

    // Register hover provider
    this.hoverProvider = vscode.languages.registerHoverProvider(
      { scheme: "file" },
      {
        provideHover: (document, position) => {
          return this.provideHover(document, position);
        },
      }
    );
    this.disposables.push(this.hoverProvider);
  }

  private async updateDecoration(editor: vscode.TextEditor): Promise<void> {
    if (!editor || editor.document.uri.scheme !== "file") {
      return;
    }

    const document = editor.document;
    const filePath = document.uri.fsPath;

    // Get the current cursor position
    const selection = editor.selection;
    const currentLine = selection.active.line;

    try {
      const blameInfo = await this.getBlameForLine(filePath, currentLine);

      if (blameInfo) {
        const decoration: vscode.DecorationOptions = {
          range: new vscode.Range(
            currentLine,
            Number.MAX_VALUE,
            currentLine,
            Number.MAX_VALUE
          ),
          renderOptions: {
            after: {
              contentText: this.formatBlameText(blameInfo),
            },
          },
        };

        editor.setDecorations(this.decorationType, [decoration]);
      } else {
        editor.setDecorations(this.decorationType, []);
      }
    } catch (error) {
      // Silently fail - file might not be in git
      editor.setDecorations(this.decorationType, []);
    }
  }

  private async getBlameForLine(
    filePath: string,
    lineNumber: number
  ): Promise<BlameInfo | null> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(
      vscode.Uri.file(filePath)
    );

    if (!workspaceFolder) {
      return null;
    }

    const workspaceRoot = workspaceFolder.uri.fsPath;

    // Check cache
    if (!this.blameCache.has(filePath)) {
      await this.cacheBlameForFile(filePath, workspaceRoot);
    }

    const fileCache = this.blameCache.get(filePath);
    return fileCache?.get(lineNumber) || null;
  }

  private async cacheBlameForFile(
    filePath: string,
    workspaceRoot: string
  ): Promise<void> {
    const relativePath = path.relative(workspaceRoot, filePath);

    try {
      const gitOutput = execSync(
        `git blame --line-porcelain "${relativePath}"`,
        {
          cwd: workspaceRoot,
          encoding: "utf-8",
          maxBuffer: 10 * 1024 * 1024,
        }
      );

      const blameMap = this.parseBlameOutput(gitOutput);
      this.blameCache.set(filePath, blameMap);
    } catch (error) {
      // File might not be in git or other error
      this.blameCache.set(filePath, new Map());
    }
  }

  private parseBlameOutput(output: string): Map<number, BlameInfo> {
    const blameMap = new Map<number, BlameInfo>();
    const lines = output.split("\n");

    let currentFullHash = "";
    let currentHash = "";
    let currentAuthor = "";
    let currentAuthorEmail = "";
    let currentDate = "";
    let currentDateISO = "";
    let currentMessage = "";
    let currentCommitter = "";
    let currentCommitterEmail = "";
    let currentLineNumber = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.match(/^[0-9a-f]{40}/)) {
        // New commit hash line
        const parts = line.split(" ");
        currentFullHash = parts[0];
        currentHash = parts[0].substring(0, 8);
        currentLineNumber = parseInt(parts[2], 10) - 1; // Convert to 0-based
      } else if (line.startsWith("author ")) {
        currentAuthor = line.substring(7);
      } else if (line.startsWith("author-mail ")) {
        currentAuthorEmail = line.substring(13).replace(/[<>]/g, "");
      } else if (line.startsWith("author-time ")) {
        const timestamp = parseInt(line.substring(12), 10);
        const date = new Date(timestamp * 1000);
        currentDate = this.formatDate(date);
        currentDateISO = date.toISOString();
      } else if (line.startsWith("committer ")) {
        currentCommitter = line.substring(10);
      } else if (line.startsWith("committer-mail ")) {
        currentCommitterEmail = line.substring(16).replace(/[<>]/g, "");
      } else if (line.startsWith("summary ")) {
        currentMessage = line.substring(8);
      } else if (line.startsWith("\t")) {
        // This is the actual line content, save the blame info
        if (currentLineNumber >= 0) {
          blameMap.set(currentLineNumber, {
            hash: currentHash,
            fullHash: currentFullHash,
            author: currentAuthor,
            authorEmail: currentAuthorEmail,
            date: currentDate,
            dateISO: currentDateISO,
            message: currentMessage,
            committer: currentCommitter,
            committerEmail: currentCommitterEmail,
          });
        }
      }
    }

    return blameMap;
  }

  private formatDate(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return "just now";
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    } else if (diffInSeconds < 2592000) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? "s" : ""} ago`;
    } else if (diffInSeconds < 31536000) {
      const months = Math.floor(diffInSeconds / 2592000);
      return `${months} month${months > 1 ? "s" : ""} ago`;
    } else {
      const years = Math.floor(diffInSeconds / 31536000);
      return `${years} year${years > 1 ? "s" : ""} ago`;
    }
  }

  private formatBlameText(blameInfo: BlameInfo): string {
    // Format: author, time ago • commit message (hash)
    const author = blameInfo.author;
    const date = blameInfo.date;
    const message =
      blameInfo.message.length > 50
        ? blameInfo.message.substring(0, 50) + "..."
        : blameInfo.message;
    const hash = blameInfo.hash;

    return `${author}, ${date} • ${message} (${hash})`;
  }

  private async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Hover | null> {
    if (document.uri.scheme !== "file") {
      return null;
    }

    const filePath = document.uri.fsPath;
    const lineNumber = position.line;

    try {
      const blameInfo = await this.getBlameForLine(filePath, lineNumber);

      if (!blameInfo) {
        return null;
      }

      // Create a rich markdown hover with commit details
      const markdown = new vscode.MarkdownString();
      markdown.isTrusted = true;
      markdown.supportHtml = true;

      // Header with commit hash
      markdown.appendMarkdown(`### Commit: \`${blameInfo.fullHash}\`\n\n`);

      // Author information
      markdown.appendMarkdown(`**Author:** ${blameInfo.author}`);
      if (blameInfo.authorEmail) {
        markdown.appendMarkdown(` <${blameInfo.authorEmail}>`);
      }
      markdown.appendMarkdown(`\n\n`);

      // Date information
      const dateObj = new Date(blameInfo.dateISO);
      const formattedDate = dateObj.toLocaleString("fr-FR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      markdown.appendMarkdown(
        `**Date:** ${formattedDate} *(${blameInfo.date})*\n\n`
      );

      // Commit message
      markdown.appendMarkdown(`**Message:**\n\n`);
      markdown.appendMarkdown(`> ${blameInfo.message}\n\n`);

      // Committer if different from author
      if (blameInfo.committer && blameInfo.committer !== blameInfo.author) {
        markdown.appendMarkdown(`**Committer:** ${blameInfo.committer}`);
        if (blameInfo.committerEmail) {
          markdown.appendMarkdown(` <${blameInfo.committerEmail}>`);
        }
        markdown.appendMarkdown(`\n\n`);
      }

      // Add command link to show full history
      markdown.appendMarkdown(`---\n\n`);
      markdown.appendMarkdown(
        `[View File History](command:git-history.showFileHistory)`
      );

      return new vscode.Hover(markdown);
    } catch (error) {
      return null;
    }
  }

  public dispose(): void {
    this.decorationType.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
