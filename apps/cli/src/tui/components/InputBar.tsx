import React, { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";

interface InputBarProps {
  onSubmit: (text: string) => void;
  onQuit: () => void;
  onCycleAgent?: () => void;
  onOpenTerminal?: () => void;
  activeProvider?: string;
  disabled?: boolean;
}

export const InputBar: React.FC<InputBarProps> = ({
  onSubmit,
  onQuit,
  onCycleAgent,
  onOpenTerminal,
  activeProvider = "agy",
  disabled,
}) => {
  const [value, setValue] = useState("");
  const { exit } = useApp();

  const isAiMode = value.startsWith(">");
  const isCmdMode = value.startsWith("/");

  useInput((input, key) => {
    if (disabled) return;

    if (key.ctrl && input === "c") {
      onQuit();
      exit();
      return;
    }

    if (key.ctrl && (input === "o" || input === "t") && onOpenTerminal) {
      onOpenTerminal();
      return;
    }

    if (key.tab && onCycleAgent) {
      onCycleAgent();
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

    if (key.escape) {
      setValue("");
      return;
    }

    if (key.backspace || key.delete) {
      setValue((prev) => prev.slice(0, -1));
      return;
    }

    // Ignore up/down navigation for now
    if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow || key.pageDown || key.pageUp) {
      return;
    }

    if (input) {
      setValue((prev) => prev + input);
    }
  });

  let borderColor = "cyan";
  let modeBadge = "💬 CHAT";
  let modeColor = "cyan";

  if (isAiMode) {
    borderColor = "yellow";
    modeBadge = `🤖 AI (${activeProvider})`;
    modeColor = "yellow";
  } else if (isCmdMode) {
    borderColor = "magenta";
    modeBadge = "⚡ CMD";
    modeColor = "magenta";
  }

  return (
    <Box
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      flexDirection="row"
      justifyContent="space-between"
    >
      <Box flexDirection="row" flexGrow={1}>
        <Text bold color={modeColor}>
          {modeBadge} ❯{" "}
        </Text>
        <Text color={isAiMode ? "yellow" : "white"}>{value}</Text>
        <Text color="gray">█</Text>
        {value.length === 0 && (
          <Box marginLeft={2}>
            <Text color="gray">
              (Type message to chat │ &gt; &lt;prompt&gt; for AI │ /help for commands)
            </Text>
          </Box>
        )}
      </Box>

      <Box>
        <Text color="gray">[Ctrl+O: open real terminal │ Tab: switch agent]</Text>
      </Box>
    </Box>
  );
};
