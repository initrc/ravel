import { useState } from "react";
import { Box, Text, useInput } from "ink";

interface OutputLine {
  text: string;
  highlight?: boolean;
}

interface CommandInputProps {
  output: OutputLine[];
  onCommand: (command: string) => void | Promise<void>;
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

  // Accept printable characters
  return { input: currentInput + char, action: { type: "none" } };
}

export function CommandInput({ output, onCommand }: CommandInputProps) {
  const [input, setInput] = useState("");

  useInput((char, key) => {
    const result = reduceInput(input, char, key);
    if (result.action.type === "submit") {
      void onCommand(result.action.value);
    }
    setInput(result.input);
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
      <Box>
        <Text color="cyan" bold>
          {'> '}
        </Text>
        {input ? (
          <Text>{input}█</Text>
        ) : (
          <Text dimColor>/ commands  ↑↓ scroll event log  PgUp/PgDn page</Text>
        )}
      </Box>
    </Box>
  );
}
