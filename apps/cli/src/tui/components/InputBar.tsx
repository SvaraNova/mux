import React, { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";

interface InputBarProps {
  onSubmit: (text: string) => void;
  onQuit: () => void;
  onCycleAgent?: () => void;
  onOpenTerminal?: () => void;
  activeProvider?: string;
  activeChannel?: string;
  disabled?: boolean;
  collabOnly?: boolean;
}

export const InputBar: React.FC<InputBarProps> = ({
  onSubmit,
  onQuit,
  onCycleAgent,
  onOpenTerminal,
  activeProvider = "agy",
  activeChannel = "general",
  disabled,
  collabOnly = false,
}) => {
  const [value, setValue] = useState("");
  const { exit } = useApp();

  const isAiMode = !collabOnly && value.startsWith(">");
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
  let modeColor = "cyan";

  let modeBadge: React.ReactNode;
  if (isAiMode) {
    borderColor = "yellow";
    modeColor = "yellow";
    modeBadge = <Text bold color="yellow">🤖 AI ({activeProvider}) ❯ </Text>;
  } else if (isCmdMode) {
    borderColor = "magenta";
    modeColor = "magenta";
    modeBadge = <Text bold color="magenta">⚡ CMD ❯ </Text>;
  } else {
    modeBadge = (
      <Text bold color="cyan">
        💬 <Text color="gray">#</Text>
        <Text color="cyan">{activeChannel}</Text>
        <Text color="cyan"> ❯ </Text>
      </Text>
    );
  }

  const hintText = collabOnly
    ? "(Type team chat message │ /msg @user text │ /ch <name>: switch channel │ /help)"
    : "(Type message to chat │ > <prompt> for AI │ /ch <name>: switch channel │ /help)";

  const shortcutText = collabOnly
    ? "[Ctrl+b ←: switch to agent pane │ Ctrl+C: quit]"
    : "[Ctrl+O: open real terminal │ Tab: switch agent]";

  return (
    <Box
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      flexDirection="row"
      justifyContent="space-between"
    >
      <Box flexDirection="row" flexGrow={1}>
        {modeBadge}
        <Text color={isAiMode ? "yellow" : "white"}>{value}</Text>
        <Text color="gray">█</Text>
        {value.length === 0 && (
          <Box marginLeft={2}>
            <Text color="gray">
              {hintText}
            </Text>
          </Box>
        )}
      </Box>

      <Box>
        <Text color="gray">{shortcutText}</Text>
      </Box>
    </Box>
  );
};
