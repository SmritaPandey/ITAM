"use client";
import { useState, useEffect, useRef } from "react";
import { ResponsiveContainer } from "recharts";

/**
 * Wrapper around Recharts ResponsiveContainer that only mounts after
 * the parent has a positive measured size (avoids width(-1)/height(-1)).
 */
export default function SafeChart({
  children,
  height = 200,
}: {
  children: React.ReactNode;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const w = Math.floor(el.getBoundingClientRect().width);
      if (w > 0) setWidth((prev) => (prev === w ? prev : w));
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    const t0 = window.setTimeout(measure, 0);
    const t1 = window.setTimeout(measure, 100);
    const raf = requestAnimationFrame(measure);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(t0);
      clearTimeout(t1);
    };
  }, [height]);

  // Numeric width/height — percentage sizing still yields -1 in hidden/flex parents
  const ready = width >= 8;

  return (
    <div ref={ref} style={{ height, width: "100%", minWidth: 0, minHeight: height, position: "relative" }}>
      {ready ? (
        <ResponsiveContainer width={width} height={height} debounce={50}>
          {children as React.ReactElement}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
