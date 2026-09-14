import React, { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";

interface InputBarProps {
  onSubmit: (text: string) => void;
  onQuit: () => void;
  disabled?: boolean;
}

export const InputBar: React.FC<InputBarProps> = ({ onSubmit, onQuit, disabled }) => {
  const [value, setValue] = useState("");
  const { exit } = useApp();

  useInput((input, key) => {
    if (disabled) return;

    if (key.ctrl && input === "c") {
      onQuit();
      exit();
      return;
    }

    if (key.return) {
      const trimmed = value.trim();
      if (trimmed === "/quit" || trimmed === "/exit") {
        onQuit();
        exit();
        return;
      }
      if (trimmed) {
        onSubmit(trimmed);
        setValue("");
      }
      return;
    }

    if (key.backspace || key.delete) {
      setValue((prev) => prev.slice(0, -1));
      return;
    }

    // Ignore other control keys
    if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow || key.pageDown || key.pageUp) {
      return;
    }

    if (input) {
      setValue((prev) => prev + input);
    }
  });

  return (
    <Box
      borderStyle="round"
      borderColor={value.startsWith(">") ? "yellow" : "cyan"}
      paddingX={1}
      flexDirection="row"
    >
      <Text bold color={value.startsWith(">") ? "yellow" : "cyan"}>
        {value.startsWith(">") ? "🤖 AI > " : "💬 > "}
      </Text>
      <Text color={value.startsWith(">") ? "yellow" : "white"}>{value}</Text>
      <Text color="gray">█</Text>
      {value.length === 0 && (
        <Box marginLeft={2}>
          <Text color="gray">
            (Chat: text | AI Agent: &gt; prompt e.g. &gt; inspect repo | /help, /quit)
          </Text>
        </Box>
      )}
    </Box>
  );
};
