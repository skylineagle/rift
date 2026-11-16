import { useMemo, useState, type FC } from "react";

import { JumpButton } from "@/components/JumpButton";
import { LogList } from "@/components/LogList";
import { LogToolbar } from "@/components/LogToolbar";
import type { PayloadView } from "@/components/PayloadText";
import { useStore } from "@/hooks/useStore";
import { formatInteger } from "@/lib/format";
import { exportRows } from "@/lib/logExport";
import { matchesFilter, type LogFilter } from "@/lib/logRows";
import { clearRows, logStore, selectRows } from "@/stores/logStore";

export type LogPanelProps = { profileName: string };

export const LogPanel: FC<LogPanelProps> = ({ profileName }) => {
  const rows = useStore(logStore, (state) => selectRows(state, profileName));
  const [filter, setFilter] = useState<LogFilter>({
    direction: "all",
    injectedOnly: false,
    query: "",
  });
  const [view, setView] = useState<PayloadView>("ascii");
  const [pausedAtId, setPausedAtId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [following, setFollowing] = useState(true);

  const matching = useMemo(
    () => rows.filter((row) => matchesFilter(row, filter)),
    [rows, filter],
  );
  const visible = useMemo(
    () =>
      pausedAtId === null ? matching : matching.filter((row) => row.id <= pausedAtId),
    [matching, pausedAtId],
  );
  const lastRowId = rows.at(-1)?.id ?? 0;
  const pending = matching.length - visible.length;

  const jumpLabel =
    pausedAtId !== null
      ? `Paused · ${formatInteger(pending)} new · Resume`
      : !following
        ? "Scroll to bottom"
        : null;

  const changeFollowing = (next: boolean) => {
    setFollowing(next);
  };

  const changePaused = (paused: boolean) => setPausedAtId(paused ? lastRowId : null);

  const toggleRow = (id: number) => {
    setExpandedId((current) => (current === id ? null : id));
    if (expandedId !== id && pausedAtId === null) setPausedAtId(lastRowId);
  };

  const jump = () => {
    if (pausedAtId !== null) setPausedAtId(null);
    setFollowing(true);
  };

  const clear = () => {
    clearRows(profileName);
    setPausedAtId(null);
    setExpandedId(null);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      <LogToolbar
        filter={filter}
        onDirectionChange={(direction) => setFilter({ ...filter, direction })}
        onQueryChange={(query) => setFilter({ ...filter, query })}
        view={view}
        onViewChange={setView}
        paused={pausedAtId !== null}
        onPausedChange={changePaused}
        totalEvents={rows.length}
        injectedOnly={filter.injectedOnly}
        onInjectedOnlyChange={(injectedOnly) => setFilter({ ...filter, injectedOnly })}
        onExport={() => exportRows(profileName, rows)}
        onClear={clear}
      />
      <div className="relative min-h-0 flex-1 border-t border-line">
        <LogList
          rows={visible}
          view={view}
          expandedId={expandedId}
          following={following && pausedAtId === null}
          onFollowingChange={changeFollowing}
          onToggleRow={toggleRow}
        />
        <JumpButton label={jumpLabel} onClick={jump} />
      </div>
    </div>
  );
};
