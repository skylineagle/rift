import { useRef, useState, type FC, type UIEvent } from "react";

import { DataRow } from "@/components/DataRow";
import { HexDump, dumpHeight } from "@/components/HexDump";
import type { PayloadView } from "@/components/PayloadText";
import { StatusRow } from "@/components/StatusRow";
import { useElementHeight } from "@/hooks/useElementHeight";
import type { LogRow } from "@/lib/logRows";

export type LogListProps = {
  rows: LogRow[];
  view: PayloadView;
  expandedId: number | null;
  following: boolean;
  onFollowingChange: (following: boolean) => void;
  onToggleRow: (id: number) => void;
};

const ROW_HEIGHT = 22;
const OVERSCAN_ROWS = 20;
const BOTTOM_PADDING = 34;
const FOLLOW_THRESHOLD = 28;

export const LogList: FC<LogListProps> = ({
  rows,
  view,
  expandedId,
  following,
  onFollowingChange,
  onToggleRow,
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const userScrolling = useRef(false);
  const previousScrollTop = useRef(0);
  const followEnabled = useRef(following);
  followEnabled.current = following;
  const { height, ref } = useElementHeight(600);

  const expandedIndex = rows.findIndex((row) => row.id === expandedId);
  const expandedRow = rows[expandedIndex];
  const extra =
    expandedRow?.type === "data" ? dumpHeight(expandedRow.bytes.length) : 0;
  const expandedAt = extra ? expandedIndex : -1;

  const offsetOf = (index: number) =>
    index * ROW_HEIGHT + (expandedAt >= 0 && index > expandedAt ? extra : 0);

  const indexAt = (offset: number) => {
    if (expandedAt < 0 || offset < (expandedAt + 1) * ROW_HEIGHT) {
      return Math.floor(offset / ROW_HEIGHT);
    }
    if (offset < (expandedAt + 1) * ROW_HEIGHT + extra) return expandedAt;
    return Math.floor((offset - extra) / ROW_HEIGHT);
  };

  const start = Math.max(0, indexAt(scrollTop) - OVERSCAN_ROWS);
  const end = Math.min(rows.length, indexAt(scrollTop + height) + OVERSCAN_ROWS + 1);
  const total = rows.length * ROW_HEIGHT + extra;

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    setScrollTop(element.scrollTop);
    const atEnd =
      element.scrollHeight - element.scrollTop - element.clientHeight < FOLLOW_THRESHOLD;
    if (userScrolling.current) {
      const next = atEnd || (element.scrollTop >= previousScrollTop.current && following);
      if (next !== followEnabled.current) {
        followEnabled.current = next;
        onFollowingChange(next);
      }
    }
    previousScrollTop.current = element.scrollTop;
  };

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      onScrollEnd={() => { userScrolling.current = false; }}
      onWheel={(event) => {
        userScrolling.current = true;
        if (event.deltaY < 0 && followEnabled.current) {
          followEnabled.current = false;
          onFollowingChange(false);
        }
      }}
      onTouchMove={() => { userScrolling.current = true; }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) userScrolling.current = true;
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) {
          userScrolling.current = true;
          if (["ArrowUp", "PageUp", "Home"].includes(event.key) && followEnabled.current) {
            followEnabled.current = false;
            onFollowingChange(false);
          }
        }
      }}
      tabIndex={0}
      className="absolute inset-0 overflow-auto font-mono text-xs leading-[22px] tabular-nums overscroll-contain"
    >
      <div style={{ height: offsetOf(start) }} />
      {rows.slice(start, end).map((row, offset) => (
        <div key={row.id}>
          {row.type === "status" ? (
            <StatusRow row={row} />
          ) : (
            <DataRow
              row={row}
              view={view}
              open={row.id === expandedId}
              fresh={start + offset >= rows.length - 50}
              onToggle={onToggleRow}
            />
          )}
          {row.id === expandedId && row.type === "data" && <HexDump bytes={row.bytes} />}
        </div>
      ))}
      <div style={{ height: Math.max(0, total - offsetOf(end)) + BOTTOM_PADDING }} />
      <div
        aria-hidden="true"
        ref={(sentinel) => {
          if (sentinel && following && followEnabled.current) {
            userScrolling.current = false;
            sentinel.scrollIntoView({ block: "end" });
          }
        }}
      />
    </div>
  );
};
