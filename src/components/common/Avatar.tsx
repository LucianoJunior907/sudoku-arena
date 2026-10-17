"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

/** Deterministic geometric avatar generated from a seed string. */
export function Avatar({
  seed,
  className,
  size = 64,
}: {
  seed: string;
  className?: string;
  size?: number;
}) {
  const data = useMemo(() => generateAvatar(seed), [seed]);
  const colors = [
    "var(--primary)",
    "var(--warning)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--success)",
    "var(--chart-3)",
  ];

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn("rounded-md", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`bg-${data.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colors[data.c1]} stopOpacity="0.9" />
          <stop offset="100%" stopColor={colors[data.c2]} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="20" fill={`url(#bg-${data.id})`} />
      {data.shapes.map((s, i) => (
        <shape key={i} shape={s} color={colors[(data.c1 + i + 1) % colors.length]} />
      ))}
    </svg>
  );
}

function shape({ shape, color }: { shape: Shape; color: string }) {
  switch (shape.t) {
    case "circle":
      return <circle cx={shape.x} cy={shape.y} r={shape.r} fill={color} opacity={0.85} />;
    case "rect":
      return <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.r} fill={color} opacity={0.85} />;
    case "tri":
      return (
        <polygon
          points={`${shape.x},${shape.y} ${shape.x + shape.s / 2},${shape.y + shape.s} ${shape.x - shape.s / 2},${shape.y + shape.s}`}
          fill={color}
          opacity={0.85}
        />
      );
  }
}

type Shape =
  | { t: "circle"; x: number; y: number; r: number }
  | { t: "rect"; x: number; y: number; w: number; h: number; r: number }
  | { t: "tri"; x: number; y: number; s: number };

function generateAvatar(seed: string): {
  id: string;
  c1: number;
  c2: number;
  shapes: Shape[];
} {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rng = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const c1 = Math.floor(rng() * 6);
  const c2 = Math.floor(rng() * 6);
  const shapes: Shape[] = [];
  const count = 3 + Math.floor(rng() * 2);
  for (let i = 0; i < count; i++) {
    const kind = Math.floor(rng() * 3);
    const x = 20 + rng() * 60;
    const y = 20 + rng() * 60;
    if (kind === 0) {
      shapes.push({ t: "circle", x, y, r: 6 + rng() * 14 });
    } else if (kind === 1) {
      const w = 10 + rng() * 20;
      shapes.push({ t: "rect", x: x - w / 2, y: y - w / 2, w, h: w, r: 3 + rng() * 5 });
    } else {
      shapes.push({ t: "tri", x, y, s: 12 + rng() * 16 });
    }
  }
  return { id: seed.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "avatar", c1, c2, shapes };
}
