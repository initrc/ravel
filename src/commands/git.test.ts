import { describe, it, expect, vi, beforeEach } from "vitest";
import { git } from "./git.js";

const { execFileMock } = vi.hoisted(() => {
  const fn = vi.fn(
    (
      _cmd: string,
      _args: string[],
      _opts: Record<string, unknown> | ((err: Error | null, result: { stdout: string; stderr: string }) => void),
      cb?: (err: Error | null, result: { stdout: string; stderr: string }) => void,
    ) => {
      const callback = (typeof _opts === "function" ? _opts : cb)!;
      callback(null, { stdout: "", stderr: "" });
      return {};
    },
  );
  return { execFileMock: fn };
});

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  execFileMock.mockImplementation(
    (
      _cmd: string,
      _args: string[],
      _opts: Record<string, unknown> | ((err: Error | null, result: { stdout: string; stderr: string }) => void),
      cb?: (err: Error | null, result: { stdout: string; stderr: string }) => void,
    ) => {
      const callback = (typeof _opts === "function" ? _opts : cb)!;
      callback(null, { stdout: "", stderr: "" });
      return {};
    },
  );
});

describe("git", () => {
  it("calls execFile with git and the provided args and cwd", async () => {
    execFileMock.mockImplementation(
      (_cmd, _args, _opts, cb) => {
        const callback = (typeof _opts === "function" ? _opts : cb)!;
        callback(null, { stdout: "output", stderr: "" });
        return {};
      },
    );

    const result = await git(["status", "--porcelain"], "/some/repo");

    expect(execFileMock).toHaveBeenCalledOnce();
    expect(execFileMock).toHaveBeenCalledWith(
      "git",
      ["status", "--porcelain"],
      { cwd: "/some/repo" },
      expect.any(Function),
    );
    expect(result).toBe("output");
  });

  it("returns stdout from git command", async () => {
    execFileMock.mockImplementation(
      (_cmd, _args, _opts, cb) => {
        const callback = (typeof _opts === "function" ? _opts : cb)!;
        callback(null, { stdout: "refs/heads/main\n", stderr: "" });
        return {};
      },
    );

    const result = await git(["branch"], "/repo");
    expect(result).toBe("refs/heads/main\n");
  });

  it("propagates errors from the git process", async () => {
    execFileMock.mockImplementation(
      (_cmd, _args, _opts, cb) => {
        const callback = (typeof _opts === "function" ? _opts : cb)!;
        callback(new Error("git: command not found"), { stdout: "", stderr: "git: command not found" });
        return {};
      },
    );

    await expect(git(["status"], "/repo")).rejects.toThrow("git: command not found");
  });
});
