"use client";

import { Clock, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type ScanItem = {
  id: number;
  type: string;
  score: number | null;
  originalContent: string;
};

type RecentScansProps = {
  scans: ScanItem[] | undefined;
  isLoading: boolean;
};

export function RecentScans({ scans, isLoading }: RecentScansProps) {
  return (
    <Card className="panel-glow border-border/50 bg-card/75">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-sm font-semibold uppercase tracking-widest font-display">
            Recent Scans
          </CardTitle>
          <CardDescription className="text-xs">
            Previously analyzed artifacts.
          </CardDescription>
        </div>
        <Badge variant="outline" className="gap-1 text-[10px]">
          <Clock className="size-3" />
          History
        </Badge>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border/40 bg-background/40 p-3">
                <Skeleton className="mb-2 h-4 w-1/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="mt-1 h-3 w-2/3" />
              </div>
            ))}
          </div>
        ) : scans && scans.length > 0 ? (
          <div className="max-h-56 overflow-y-auto">
            <ul className="grid gap-2 text-sm">
              {scans.map((scan) => (
                <li
                  key={scan.id}
                  className="group rounded-lg border border-border/40 bg-background/40 p-3 transition-all duration-200 hover:border-primary/40 hover:shadow-[0_0_16px_-8px_color-mix(in_oklch,var(--primary),transparent_60%)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 font-medium text-xs">
                      <Sparkles className="size-3 text-primary/70" />
                      <span className="uppercase tracking-wider font-mono text-[10px]">{scan.type}</span>
                    </p>
                    <Badge
                      variant={scan.score !== null && scan.score >= 70 ? "default" : "secondary"}
                      className="text-[10px] font-mono"
                    >
                      {scan.score ?? "n/a"}
                    </Badge>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                    {scan.originalContent}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground/60 italic">No scans yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
