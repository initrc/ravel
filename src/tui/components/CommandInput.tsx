import { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { CommandDef } from "../commands.js";

interface OutputLine {
  text: string;
  highlight?: boolean;
}

interface CommandInputProps {
  output: OutputLine[];
  onCommand: (command: string) => void | Promise<void>;
  disableInput?: boolean;
  onAssignMode?: () => void;
  commands: CommandDef[];
}

export interface KeyLike {
  return?: boolean;
  backspace?: boolean;
  delete?: boolean;
  tab?: boolean;
  upArrow?: boolean;
  downArrow?: boolean;
  leftArrow?: boolean;
  rightArrow?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
}

export type InputAction =
  | { type: "submit"; value: string }
  | { type: "clear" }
  | { type: "assignMode" }
  | { type: "none" };

export function reduceInput(
  currentInput: string,
  char: string,
  key: KeyLike,
): { input: string; action: InputAction } {
  if (key.return) {
    const trimmed = currentInput.trim();
    if (trimmed) return { input: "", action: { type: "submit", value: trimmed } };
    return { input: currentInput, action: { type: "none" } };
  }

  if (key.backspace || key.delete) {
    return { input: currentInput.slice(0, -1), action: { type: "none" } };
  }

  // Ignore special keys (arrows, function keys, etc.)
  if (char.length === 0) return { input: currentInput, action: { type: "none" } };

  // Ignore tab
  if (key.tab) return { input: currentInput, action: { type: "none" } };

  // Trigger assign mode when "a" is pressed on empty input
  if (!currentInput && (char === "a" || char === "A")) {
    return { input: currentInput, action: { type: "assignMode" } };
  }

  // Accept printable characters
  return { input: currentInput + char, action: { type: "none" } };
}

export function CommandInput({ output, onCommand, disableInput, onAssignMode, commands }: CommandInputProps) {
  const [input, setInput] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const showDropdown = input.startsWith("/") && !input.includes(" ");
  const filteredCommands = showDropdown
    ? commands.filter((c) => c.name.startsWith(input))
    : [];

  useInput((char, key) => {
    if (disableInput) return;

    // Handle dropdown-specific keys when dropdown is visible and has matches
    if (filteredCommands.length > 0) {
      if (key.escape) {
        setInput("");
        setHighlightedIndex(0);
        return;
      }
      if (key.upArrow) {
        setHighlightedIndex((prev) => Math.max(0, prev - 1));
        return;
      }
      if (key.downArrow) {
        setHighlightedIndex((prev) => Math.min(filteredCommands.length - 1, prev + 1));
        return;
      }
      if (key.tab) {
        const match = filteredCommands[highlightedIndex];
        if (match) {
          setInput(match.name + (match.takesArg ? " " : ""));
        }
        setHighlightedIndex(0);
        return;
      }
      if (key.return) {
        const exactMatch = filteredCommands.find((c) => c.name === input);
        if (exactMatch && !exactMatch.takesArg) {
          void onCommand(input);
          setInput("");
        } else if (exactMatch && exactMatch.takesArg) {
          setInput(exactMatch.name + " ");
        } else {
          const match = filteredCommands[highlightedIndex];
          if (match) {
            setInput(match.name + (match.takesArg ? " " : ""));
          }
        }
        setHighlightedIndex(0);
        return;
      }
    }

    // Normal input handling
    const result = reduceInput(input, char, key);
    if (result.action.type === "submit") {
      void onCommand(result.action.value);
    } else if (result.action.type === "assignMode") {
      onAssignMode?.();
    }
    setInput(result.input);
    setHighlightedIndex(0);
  });

  return (
    <Box flexDirection="column" paddingTop={1}>
      {output.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          {output.map((line, i) => (
            <Text key={i} dimColor={!line.highlight}>
              {line.text}
            </Text>
          ))}
        </Box>
      )}
      {showDropdown && filteredCommands.length > 0 && (
        <Box
          borderStyle="round"
          borderColor="cyan"
          flexDirection="column"
          paddingX={1}
          marginBottom={1}
        >
          {filteredCommands.map((cmd, i) => (
            <Box key={cmd.name} flexDirection="row" gap={2}>
              <Text color={i === highlightedIndex ? "cyan" : undefined} bold={i === highlightedIndex}>
                {cmd.name}
              </Text>
              <Text dimColor={i !== highlightedIndex}>
                {cmd.description}
              </Text>
            </Box>
          ))}
        </Box>
      )}
      <Box>
        <Text color="cyan" bold>
          {'> '}
        </Text>
        {input ? (
          <Text>{input}█</Text>
        ) : (
          <Text dimColor>a assign  / commands  ↑↓ scroll event log  PgUp/PgDn page</Text>
        )}
      </Box>
    </Box>
  );
}
