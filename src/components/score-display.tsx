"use client";

import { useEffect, useState } from "react";
import { CircleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

type ScoreData = {
  score: number;
  provider: string;
  dimensions: {
    clarity: number;
    safety: number;
    tokenEfficiency: number;
    completeness: number;
  };
  warnings: string[];
};

type ScoreDisplayProps = {
  data: ScoreData | null;
  isLoading?: boolean;
};

function ScoreGauge({ score }: { score: number }) {
  const [mounted, setMounted] = useState(false);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 50);
    return () => window.clearTimeout(timer);
  }, []);

  const scoreColor =
    score >= 80 ? "text-chart-4" : score >= 50 ? "text-primary" : "text-destructive";

  return (
    <div className="relative flex items-center justify-center">
      <svg width="140" height="140" viewBox="0 0 128 128" className="animate-glow-pulse">
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-muted/50"
        />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          className={`score-ring ${scoreColor}`}
          strokeDasharray={circumference}
          strokeDashoffset={mounted ? offset : circumference}
          transform="rotate(-90 64 64)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold tabular-nums font-[family-name:var(--font-display)] ${scoreColor}`}>
          {score}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          / 100
        </span>
      </div>
    </div>
  );
}

function DimensionBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-mono font-medium">{value}</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}

export function ScoreDisplay({ data, isLoading }: ScoreDisplayProps) {
  if (isLoading) {
    return (
      <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="size-[140px] rounded-full" />
          <Skeleton className="h-5 w-14" />
        </div>
        <div className="flex flex-col gap-4">
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <Skeleton className="h-1.5 w-full" />
              </div>
            ))}
          </div>
          <Separator className="bg-border/40" />
          <div>
            <Skeleton className="mb-2 h-3 w-24" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border/40 bg-background/40 p-8 text-center">
        <p className="text-sm text-muted-foreground/60 italic">
          Run Analyze to view score breakdown and warnings.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-scale-in grid gap-5 sm:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-center gap-2">
        <ScoreGauge score={data.score} />
        <Badge variant="outline" className="text-[10px] font-mono">
          {data.provider}
        </Badge>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid gap-3">
          <DimensionBar label="Clarity" value={data.dimensions.clarity} />
          <DimensionBar label="Safety" value={data.dimensions.safety} />
          <DimensionBar label="Token Efficiency" value={data.dimensions.tokenEfficiency} />
          <DimensionBar label="Completeness" value={data.dimensions.completeness} />
        </div>

        <Separator className="bg-border/40" />

        <div>
          <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
            <CircleAlert className="size-3.5 text-primary" />
            Warnings
          </p>
          {data.warnings.length > 0 ? (
            <ul className="grid gap-1.5 text-xs text-muted-foreground">
              {data.warnings.map((warning) => (
                <li
                  key={warning}
                  className="rounded-md border border-destructive/25 bg-destructive/5 px-2.5 py-1.5"
                >
                  {warning}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground/60">No critical warnings.</p>
          )}
        </div>
      </div>
    </div>
  );
}
