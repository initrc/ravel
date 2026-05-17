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

export function CommandInput({ output, onCommand }: CommandInputProps) {
  const [input, setInput] = useState("");

  useInput((char, key) => {
    if (key.return) {
      const trimmed = input.trim();
      if (trimmed) {
        void onCommand(trimmed);
        setInput("");
      }
      return;
    }

    if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
      return;
    }

    // Ignore special keys (arrows, function keys, etc.)
    if (char.length === 0) return;

    // Ignore tab
    if (key.tab) return;

    // Accept printable characters
    setInput((prev) => prev + char);
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
        <Text>{input}</Text>
      </Box>
    </Box>
  );
}
