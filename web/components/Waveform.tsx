"use client";

// A small VU-style bar meter. When `active`, bars react to `level` (0..1) with a
// per-bar animation offset; otherwise it renders a quiet static shape.

interface WaveformProps {
  active?: boolean;
  level?: number; // 0..1
  bars?: number;
  className?: string;
  colorClass?: string; // tailwind bg-* class
}

const BASE = [6, 11, 8, 13, 7, 12, 9, 14, 8, 10];

export function Waveform({
  active = false,
  level = 0,
  bars = 5,
  className = "",
  colorClass = "bg-mt-green",
}: WaveformProps) {
  const heights = BASE.slice(0, bars);
  return (
    <div className={`flex items-center gap-[3px] ${className}`} aria-hidden>
      {heights.map((h, i) => {
        const scale = active ? 0.4 + Math.min(1, level * 6) * (0.6 + 0.4 * Math.sin(i)) : 1;
        return (
          <span
            key={i}
            className={`w-[3px] rounded-full ${colorClass}`}
            style={{
              height: h,
              transform: `scaleY(${scale.toFixed(2)})`,
              transition: "transform 90ms ease-out",
            }}
          />
        );
      })}
    </div>
  );
}
