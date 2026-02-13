"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

type OutputPanelProps = {
  value: string;
  isLoading?: boolean;
};

export function OutputPanel({ value, isLoading }: OutputPanelProps) {
  return (
    <Card className="panel-glow border-border/50 bg-card/75">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-sm font-semibold uppercase tracking-[0.1em] font-[family-name:var(--font-display)]">
            Perfected Output
          </CardTitle>
          <CardDescription className="text-xs">
            Refined version from the judge.
          </CardDescription>
        </div>
        <Badge variant="outline" className="tabular-nums font-mono text-[10px]">
          {value.length.toLocaleString()} chars
        </Badge>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[380px] w-full rounded-lg border border-border/50 bg-background/60">
          {isLoading ? (
            <div className="flex flex-col gap-3 p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <pre
              data-testid="artifact-output"
              className="p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap"
            >
              {value || (
                <span className="text-muted-foreground/60 italic">
                  Run Analyze to generate the perfected artifact.
                </span>
              )}
            </pre>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
