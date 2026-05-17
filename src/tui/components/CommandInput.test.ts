import { describe, it, expect } from "vitest";
import { reduceInput } from "./CommandInput.js";
import type { KeyLike } from "./CommandInput.js";

function key(overrides: Partial<KeyLike> = {}): KeyLike {
  return overrides;
}

describe("reduceInput", () => {
  describe("return key", () => {
    it("submits and clears input when non-empty", () => {
      const result = reduceInput("assign T0042", "", key({ return: true }));
      expect(result.input).toBe("");
      expect(result.action).toEqual({ type: "submit", value: "assign T0042" });
    });

    it("trims whitespace before submitting", () => {
      const result = reduceInput("  hello  ", "", key({ return: true }));
      expect(result.input).toBe("");
      expect(result.action).toEqual({ type: "submit", value: "hello" });
    });

    it("does nothing when input is empty", () => {
      const result = reduceInput("", "", key({ return: true }));
      expect(result.input).toBe("");
      expect(result.action).toEqual({ type: "none" });
    });

    it("does nothing when input is only whitespace", () => {
      const result = reduceInput("   ", "", key({ return: true }));
      expect(result.input).toBe("   ");
      expect(result.action).toEqual({ type: "none" });
    });
  });

  describe("backspace / delete", () => {
    it("removes the last character on backspace", () => {
      const result = reduceInput("hello", "", key({ backspace: true }));
      expect(result.input).toBe("hell");
      expect(result.action).toEqual({ type: "none" });
    });

    it("handles backspace on empty input", () => {
      const result = reduceInput("", "", key({ backspace: true }));
      expect(result.input).toBe("");
    });

    it("removes the last character on delete", () => {
      const result = reduceInput("hello", "", key({ delete: true }));
      expect(result.input).toBe("hell");
    });
  });

  describe("special keys", () => {
    it("ignores arrow keys", () => {
      expect(reduceInput("test", "", key({ upArrow: true })).input).toBe("test");
      expect(reduceInput("test", "", key({ downArrow: true })).input).toBe("test");
      expect(reduceInput("test", "", key({ leftArrow: true })).input).toBe("test");
      expect(reduceInput("test", "", key({ rightArrow: true })).input).toBe("test");
    });

    it("ignores empty char (function keys, etc.)", () => {
      const result = reduceInput("test", "", {});
      expect(result.input).toBe("test");
      expect(result.action).toEqual({ type: "none" });
    });

    it("ignores tab key", () => {
      const result = reduceInput("test", "\t", key({ tab: true }));
      expect(result.input).toBe("test");
    });
  });

  describe("printable characters", () => {
    it("appends a character to input", () => {
      const result = reduceInput("hel", "l", {});
      expect(result.input).toBe("hell");
    });

    it("appends to empty input", () => {
      const result = reduceInput("", "/", {});
      expect(result.input).toBe("/");
    });

    it("builds a command character by character", () => {
      let state: { input: string; action: import("./CommandInput.js").InputAction } = {
        input: "",
        action: { type: "none" },
      };

      for (const ch of "/assign T0042") {
        state = reduceInput(state.input, ch, {});
      }

      expect(state.input).toBe("/assign T0042");
    });
  });

  describe("ctrl key combinations", () => {
    it("does not treat ctrl chars as printable", () => {
      // Ctrl+C sends char "\x03" in raw mode, but Ink may pass empty char
      // with ctrl flag set.
      const result = reduceInput("test", "", key({ ctrl: true }));
      expect(result.input).toBe("test");
    });
  });
});
