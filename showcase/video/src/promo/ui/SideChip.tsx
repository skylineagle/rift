import { Server, Usb } from "lucide-react";
import type { FC } from "react";

import { color, font } from "../tokens";

export type SideChipProps = { side: "A" | "B" };

export const SideChip: FC<SideChipProps> = ({ side }) => {
  const tint = side === "A" ? color.amber : color.cyan;
  const Icon = side === "A" ? Server : Usb;
  return (
    <span data-target={`chip-${side}`} style={{ position: "relative", display: "grid", width: 32, height: 32, flex: "none", placeItems: "center", borderRadius: 8, background: side === "A" ? color.amberSoft : color.cyanSoft, color: tint }}>
      <Icon size={18} />
      <sup
        style={{
          position: "absolute",
          top: -5,
          [side === "A" ? "right" : "left"]: -5,
          borderRadius: 4,
          border: `1px solid ${color.line2}`,
          background: color.surface,
          padding: "2px 3px",
          fontFamily: font.mono,
          fontSize: 9.5,
          lineHeight: 1,
          fontWeight: 700,
          color: tint,
        }}
      >
        {side}
      </sup>
    </span>
  );
};
