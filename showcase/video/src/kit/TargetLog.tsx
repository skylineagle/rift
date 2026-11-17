import { useLayoutEffect, useRef, type FC } from "react";

export const TargetLog: FC = () => {
  const ref = useRef<HTMLPreElement>(null);
  useLayoutEffect(() => {
    const top = document.querySelector("[data-remotion-canvas]")?.getBoundingClientRect().top ?? -1_000_000;
    const lines = Array.from(document.querySelectorAll("[data-target]"), (element) => {
      const box = element.getBoundingClientRect();
      return `${element.getAttribute("data-target")} x=${Math.round(box.x + box.width / 2)} y=${Math.round(box.y - top + box.height / 2)} w=${Math.round(box.width)} h=${Math.round(box.height)}`;
    });
    if (ref.current) ref.current.textContent = lines.join("\n");
  });
  return (
    <pre ref={ref} style={{ position: "absolute", left: 10, top: 10, margin: 0, padding: 12, background: "#000", color: "#0f0", fontSize: 22, fontFamily: "monospace", zIndex: 100 }} />
  );
};
