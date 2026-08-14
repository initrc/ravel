import { CheckItem, CheckLevel } from "../check.js";

export const fzfCheck = new CheckItem(
  "fzf",
  CheckLevel.Mandatory,
  "fzf",
  ["--version"],
);
