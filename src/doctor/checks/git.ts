import { CheckItem, CheckLevel } from "../check.js";

export const gitCheck = new CheckItem(
  "Git",
  CheckLevel.Recommended,
  "git",
  ["--version"],
);
