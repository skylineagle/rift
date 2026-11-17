import type { FC, ReactNode } from "react";

import { color } from "../tokens";

export type SegmentedControlProps = { items: ReactNode[]; index: number; target?: string };

export const SegmentedControl: FC<SegmentedControlProps> = ({ items, index, target }) => (
  <span
    data-target={target}
    style={{
      position: "relative",
      display: "grid",
      gridAutoFlow: "column",
      gridAutoColumns: "1fr",
      flex: "none",
      borderRadius: 8,
      border: `1px solid ${color.line2}`,
      background: color.surface2,
      padding: 2,
    }}
  >
    <span
      style={{
        position: "absolute",
        top: 2,
        bottom: 2,
        left: 2,
        width: `calc((100% - 4px) / ${items.length})`,
        translate: `${index * 100}% 0`,
        borderRadius: 6,
        background: color.surface4,
        boxShadow: `0 1px 2px rgba(0,0,0,0.25), inset 0 0 0 1px ${color.line2}`,
      }}
    />
    {items.map((item, position) => (
      <span
        key={position}
        style={{
          position: "relative",
          display: "grid",
          height: 22,
          minWidth: 26,
          placeItems: "center",
          padding: "0 7px",
          fontSize: 12,
          fontWeight: 600,
          color: Math.round(index) === position ? color.fg : color.fg3,
        }}
      >
        {item}
      </span>
    ))}
  </span>
);
