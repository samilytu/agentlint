import React from "react";
import { Box, Text, useInput } from "ink";
import {
  colors,
  gradient,
  BANNER_LINES,
  BANNER_LINES_2,
  TAGLINE,
  VERSION,
} from "./theme.js";

function interpolateColor(c1: string, c2: string, t: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16);
  const g1 = parseInt(c1.slice(3, 5), 16);
  const b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16);
  const g2 = parseInt(c2.slice(3, 5), 16);
  const b2 = parseInt(c2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function getGradientColor(position: number, total: number, stops: readonly string[]): string {
  if (total <= 1) return stops[0];
  const t = position / (total - 1);
  const segment = t * (stops.length - 1);
  const i = Math.min(Math.floor(segment), stops.length - 2);
  const localT = segment - i;
  return interpolateColor(stops[i], stops[i + 1], localT);
}

function GradientText({ text, bold }: { text: string; bold?: boolean }): React.ReactNode {
  const chars = [...text];
  const totalLen = chars.length;
  const segments: { text: string; color: string }[] = [];
  for (let j = 0; j < chars.length; j++) {
    const color = getGradientColor(j, totalLen, gradient);
    if (segments.length > 0 && segments[segments.length - 1].color === color) {
      segments[segments.length - 1].text += chars[j];
    } else {
      segments.push({ text: chars[j], color });
    }
  }
  return (
    <>
      {segments.map((seg, j) => (
        <Text key={j} color={seg.color} bold={bold}>
          {seg.text}
        </Text>
      ))}
    </>
  );
}

export function Banner(): React.ReactNode {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box flexDirection="column">
        {BANNER_LINES.map((line, i) => {
          const fullLine = `${line} ${BANNER_LINES_2[i] ?? ""}`;
          return (
            <Box key={i}>
              <GradientText text={fullLine} bold />
            </Box>
          );
        })}
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

export function ContinuePrompt({
  onContinue,
  label = "Continue",
}: {
  onContinue: () => void;
  label?: string;
}): React.ReactNode {
  useInput((_input, key) => {
    if (key.return) {
      onContinue();
    }
  });

  return (
    <Box marginTop={1} marginLeft={1} flexDirection="column">
      <Box gap={1}>
        <Text color={colors.accent} bold>{">> "}</Text>
        <Text color={colors.tertiary} bold>{label}</Text>
      </Box>
      <Box marginLeft={4}>
        <Text color={colors.dim} italic>
          {"enter continue"}
        </Text>
      </Box>
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
