const BRANCH_REF_PREFIX = "refs/heads/";

export class GitWorktree {
  constructor(
    readonly path: string,
    readonly branch?: string,
  ) {}

  hasBranch(branchName: string): boolean {
    return this.branch === `${BRANCH_REF_PREFIX}${branchName}`;
  }
}

/** Preserves Git's worktree order because its first record is the primary checkout. */
export class GitWorktreeRegistry {
  constructor(readonly worktrees: readonly GitWorktree[]) {
    if (worktrees.length === 0) {
      throw new Error("Git did not report a primary worktree.");
    }
  }

  /**
   * Parses records such as
   * `worktree /repo\0HEAD abc123\0branch refs/heads/main\0\0`
   * into `new GitWorktree("/repo", "refs/heads/main")`.
   */
  static parse(porcelain: string): GitWorktreeRegistry {
    const worktrees: GitWorktree[] = [];
    let worktreePath: string | undefined;
    let branch: string | undefined;

    const finishRecord = (): void => {
      if (worktreePath !== undefined) {
        worktrees.push(new GitWorktree(worktreePath, branch));
      }
      worktreePath = undefined;
      branch = undefined;
    };

    for (const field of porcelain.split("\0")) {
      if (field === "") {
        // Git separates porcelain records with an empty NUL-delimited field.
        finishRecord();
        continue;
      }

      const separator = field.indexOf(" ");
      const key = separator === -1 ? field : field.slice(0, separator);
      const value = separator === -1 ? "" : field.slice(separator + 1);
      if (key === "worktree") {
        worktreePath = value;
      } else if (key === "branch") {
        branch = value;
      }
    }
    // Also accept a final record without Git's usual empty record separator.
    finishRecord();

    return new GitWorktreeRegistry(worktrees);
  }

  get primary(): GitWorktree {
    return this.worktrees[0];
  }

  findBranch(branchName: string): GitWorktree | undefined {
    return this.worktrees.find((worktree) => worktree.hasBranch(branchName));
  }
}
