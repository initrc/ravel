import { CheckItem, CheckLevel } from "../check.js";

export const tmuxCheck = new CheckItem(
  "tmux",
  CheckLevel.Recommended,
  "tmux",
  ["-V"],
);
