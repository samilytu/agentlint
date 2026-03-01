import React from "react";
import { Box, Text } from "ink";
import { colors, BANNER, TAGLINE, VERSION } from "./theme.js";

export function Banner(): React.ReactNode {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={colors.primary} bold>
        {BANNER}
      </Text>
      <Box marginTop={0} marginLeft={3}>
        <Text color={colors.tertiary}>{TAGLINE}</Text>
        <Text color={colors.dim}> v{VERSION}</Text>
      </Box>
    </Box>
  );
}

export function Divider(): React.ReactNode {
  return (
    <Box marginY={0}>
      <Text color={colors.dim}>{"─".repeat(50)}</Text>
    </Box>
  );
}

export function SectionTitle({ children }: { children: string }): React.ReactNode {
  return (
    <Box marginTop={1} marginBottom={0}>
      <Text color={colors.secondary} bold>
        {"▸ "}
      </Text>
      <Text color={colors.secondary} bold>
        {children}
      </Text>
    </Box>
  );
}

export function SuccessItem({ children }: { children: string }): React.ReactNode {
  return (
    <Box marginLeft={2}>
      <Text color={colors.success}>{"✔ "}</Text>
      <Text>{children}</Text>
    </Box>
  );
}

export function SkipItem({ children }: { children: string }): React.ReactNode {
  return (
    <Box marginLeft={2}>
      <Text color={colors.warning}>{"‣ "}</Text>
      <Text color={colors.muted}>{children}</Text>
    </Box>
  );
}

export function InfoItem({ children }: { children: string }): React.ReactNode {
  return (
    <Box marginLeft={2}>
      <Text color={colors.accent}>{"◆ "}</Text>
      <Text>{children}</Text>
    </Box>
  );
}

export function ErrorItem({ children }: { children: string }): React.ReactNode {
  return (
    <Box marginLeft={2}>
      <Text color={colors.error}>{"✖ "}</Text>
      <Text>{children}</Text>
    </Box>
  );
}

export function Hint({ children }: { children: string }): React.ReactNode {
  return (
    <Box marginTop={1} marginLeft={2}>
      <Text color={colors.dim}>{"💡 "}</Text>
      <Text color={colors.dim} italic>
        {children}
      </Text>
    </Box>
  );
}

export function NextStep({ children }: { children: string }): React.ReactNode {
  return (
    <Box marginTop={1}>
      <Text color={colors.tertiary}>{"→ "}</Text>
      <Text color={colors.tertiary}>{children}</Text>
    </Box>
  );
}

export function PromptBox({ children }: { children: string }): React.ReactNode {
  return (
    <Box
      borderStyle="round"
      borderColor={colors.primary}
      paddingX={2}
      paddingY={1}
      marginY={1}
    >
      <Text>{children}</Text>
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
      {` ${label} `}
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
      <Text color={colors.dim}>{label}:</Text>
      <Text color={color ?? colors.primary} bold>
        {String(value)}
      </Text>
    </Box>
  );
}
