import React from "react";
import { Box, Text } from "ink";
import {
  colors,
  gradient,
  BANNER_LINES,
  BANNER_LINES_2,
  TAGLINE,
  VERSION,
} from "./theme.js";

export function Banner(): React.ReactNode {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box flexDirection="column">
        {BANNER_LINES.map((line, i) => (
          <Box key={i}>
            <Text color={gradient[i] ?? gradient[gradient.length - 1]} bold>
              {line}
            </Text>
            <Text> </Text>
            <Text color={gradient[i] ?? gradient[gradient.length - 1]} bold>
              {BANNER_LINES_2[i] ?? ""}
            </Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={0} marginLeft={1} gap={1}>
        <Text color={colors.accent}>{"*"}</Text>
        <Text color={colors.tertiary} italic>{TAGLINE}</Text>
        <Text color={colors.dim}>v{VERSION}</Text>
      </Box>
    </Box>
  );
}

export function Divider(): React.ReactNode {
  const left = "─".repeat(3);
  const mid = " * ";
  const right = "─".repeat(44);
  return (
    <Box marginY={0}>
      <Text color={colors.dim}>{left}</Text>
      <Text color={colors.accent}>{mid}</Text>
      <Text color={colors.dim}>{right}</Text>
    </Box>
  );
}

export function SectionTitle({ children }: { children: string }): React.ReactNode {
  return (
    <Box marginTop={1} marginBottom={0} gap={1}>
      <Text color={colors.primary} bold>
        {"//"}
      </Text>
      <Text color={colors.secondary} bold>
        {children.toUpperCase()}
      </Text>
    </Box>
  );
}

export function SuccessItem({ children }: { children: string }): React.ReactNode {
  return (
    <Box marginLeft={3}>
      <Text color={colors.success} bold>{"+ "}</Text>
      <Text>{children}</Text>
    </Box>
  );
}

export function SkipItem({ children }: { children: string }): React.ReactNode {
  return (
    <Box marginLeft={3}>
      <Text color={colors.warning}>{"~ "}</Text>
      <Text color={colors.muted}>{children}</Text>
    </Box>
  );
}

export function InfoItem({ children }: { children: string }): React.ReactNode {
  return (
    <Box marginLeft={3}>
      <Text color={colors.accent} bold>{"* "}</Text>
      <Text>{children}</Text>
    </Box>
  );
}

export function ErrorItem({ children }: { children: string }): React.ReactNode {
  return (
    <Box marginLeft={3}>
      <Text color={colors.error} bold>{"x "}</Text>
      <Text>{children}</Text>
    </Box>
  );
}

export function Hint({ children }: { children: string }): React.ReactNode {
  return (
    <Box marginTop={1} marginLeft={3}>
      <Text color={colors.tertiary}>{"? "}</Text>
      <Text color={colors.muted} italic>
        {children}
      </Text>
    </Box>
  );
}

export function NextStep({ children }: { children: string }): React.ReactNode {
  return (
    <Box marginTop={1} marginLeft={1}>
      <Text color={colors.accent} bold>{">> "}</Text>
      <Text color={colors.tertiary}>{children}</Text>
    </Box>
  );
}

export function PromptBox({ children }: { children: string }): React.ReactNode {
  return (
    <Box
      borderStyle="round"
      borderColor={colors.secondary}
      paddingX={2}
      paddingY={1}
      marginY={1}
      marginX={1}
    >
      <Text color={colors.tertiary}>{children}</Text>
    </Box>
  );
}

export function Badge({
  label,
  color,
}: {
  label: string;
  color: string;
}): React.ReactNode {
  return (
    <Text color={color} bold>
      {`[${label}]`}
    </Text>
  );
}

export function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}): React.ReactNode {
  return (
    <Box gap={1}>
      <Text color={colors.dim}>{label}</Text>
      <Text color={color ?? colors.primary} bold>
        {String(value)}
      </Text>
    </Box>
  );
}

export function StatusBar({
  items,
}: {
  items: { label: string; value: string | number; color: string }[];
}): React.ReactNode {
  return (
    <Box
      marginLeft={1}
      marginTop={1}
      borderStyle="single"
      borderColor={colors.dim}
      paddingX={2}
      paddingY={0}
      gap={3}
    >
      {items.map((item, i) => (
        <Box key={i} gap={1}>
          <Text color={colors.muted}>{item.label}</Text>
          <Text color={item.color} bold>
            {String(item.value)}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
