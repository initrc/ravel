import { CheckItem, CheckLevel } from "../check.js";

export const workmuxCheck = new CheckItem(
  "workmux",
  CheckLevel.Recommended,
  "workmux",
  ["--version"],
);
