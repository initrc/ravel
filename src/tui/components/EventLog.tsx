import { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { LogEvent } from "../app.js";

interface EventLogProps {
  events: LogEvent[];
}

export function EventLog({ events }: EventLogProps) {
  const [scrollOffset, setScrollOffset] = useState(0);
  const visibleCount = 15;
  const maxOffset = Math.max(0, events.length - visibleCount);

  useInput((_input, key) => {
    if (key.upArrow) {
      setScrollOffset((prev) => Math.min(maxOffset, prev + 1));
    } else if (key.downArrow) {
      setScrollOffset((prev) => Math.max(0, prev - 1));
    } else if (key.pageUp) {
      setScrollOffset((prev) => Math.min(maxOffset, prev + visibleCount));
    } else if (key.pageDown) {
      setScrollOffset((prev) => Math.max(0, prev - visibleCount));
    }
  });

  const endIndex = events.length - 1 - scrollOffset;
  const startIndex = Math.max(0, endIndex - (visibleCount - 1));
  const visible = events.slice(startIndex, endIndex + 1);

  const hasNewer = scrollOffset > 0;
  const hasOlder = scrollOffset < maxOffset;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      flexGrow={1}
    >
      <Box justifyContent="space-between">
        <Text bold>Events</Text>
        <Text dimColor>
          {events.length === 0
            ? "waiting for events..."
            : `${events.length} events${hasOlder || hasNewer ? ` (${startIndex + 1}-${endIndex + 1})` : ""}`}
        </Text>
      </Box>
      {hasOlder && <Text dimColor> ▲ scroll up for older</Text>}
      {visible.map((e, i) => (
        <Text key={`${startIndex + i}`} wrap="truncate">
          {e.message}
        </Text>
      ))}
      {hasNewer && <Text dimColor> ▼ scroll down for newer</Text>}
    </Box>
  );
}
