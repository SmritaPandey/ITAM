"use client";
import { useState, useEffect, useRef } from "react";
import { ResponsiveContainer } from "recharts";

/**
 * A wrapper around Recharts' ResponsiveContainer that only renders
 * after the parent container has measured, avoiding the "width(-1) height(-1)" warning.
 */
export default function SafeChart({
  children,
  height = 200,
}: {
  children: React.ReactNode;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Defer render to next frame so container has real dimensions
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div ref={ref} style={{ height, width: "100%" }}>
      {mounted && (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          {children as any}
        </ResponsiveContainer>
      )}
    </div>
  );
}
