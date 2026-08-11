import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeClipboard } from "./clipboard.js";

const { writeMock } = vi.hoisted(() => ({ writeMock: vi.fn() }));

vi.mock("clipboardy", () => ({
  default: { write: writeMock },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("writeClipboard", () => {
  it("writes the provided text to the clipboard", async () => {
    await writeClipboard("task prompt");

    expect(writeMock).toHaveBeenCalledOnce();
    expect(writeMock).toHaveBeenCalledWith("task prompt");
  });
});
