import type { FC } from "react";

import { ReceiveBorder } from "@/components/ReceiveBorder";
import { EndpointFields } from "@/components/EndpointFields";
import { SideTraffic } from "@/components/SideTraffic";
import { EndpointSelector } from "@/components/EndpointSelector";
import { useStore } from "@/hooks/useStore";
import { SideToggle } from "@/components/SideToggle";
import { StatusPill } from "@/components/StatusPill";
import { useBridge } from "@/hooks/useBridge";
import {
  endpointAddress,
  endpointKindMeta,
} from "@/lib/endpointKinds";
import { sideDetail } from "@/lib/sideStatus";
import type { Endpoint, SideName } from "@/lib/types";
import { cn } from "@/lib/utils";
import { profilesStore, updateEndpoint } from "@/stores/profilesStore";

export type SideCardProps = {
  profileName: string;
  side: SideName;
  endpoint: Endpoint;
};

export const SideCard: FC<SideCardProps> = ({ profileName, side, endpoint }) => {
  const bridge = useBridge(profileName);
  const runtime = bridge.sides[side];
  const enabled = bridge.running && runtime.status !== "disabled" && runtime.status !== "idle";
  const pending = useStore(profilesStore, (state) => state.pendingSides.some((key) => key.startsWith(`${profileName}:`)));
  const edited = useStore(profilesStore, (state) => state.editedSides.includes(`${profileName}:${side}`));
  const counters = bridge.counters[side];
  const KindIcon = endpointKindMeta(endpoint.kind).icon;
  const mirrored = side === "B";

  return (
    <section
      aria-label={`Side ${side}${edited ? ", edited. Press Play to apply changes" : ""}`}
      className={cn(
        "side-card relative flex min-w-0 flex-col gap-2.5 rounded-xl border bg-surface-2 p-3",
      )}
      data-side={side}
      data-edited={edited || undefined}
    >
      <ReceiveBorder profileName={profileName} side={side} />
      <header
        className={cn("flex min-w-0 items-center gap-2.5", mirrored && "flex-row-reverse")}
      >
        <span
          className={cn(
            "relative grid size-8 flex-none place-items-center rounded-lg",
            mirrored
              ? "bg-[color-mix(in_srgb,var(--ba)_14%,transparent)] text-ba"
              : "bg-[color-mix(in_srgb,var(--ab)_14%,transparent)] text-ab",
          )}
        >
          <KindIcon className="size-[18px]" />
          <sup
            className={cn(
              "absolute -top-[5px] rounded-[4px] border border-line-2 bg-surface px-[3px] py-0.5 font-mono text-[9.5px] leading-none font-bold",
              mirrored ? "-left-[5px] text-ba" : "-right-[5px] text-ab",
            )}
          >
            {side}
          </sup>
        </span>
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col leading-[1.3]",
            mirrored && "text-right",
          )}
        >
          <b className="truncate font-mono text-[13px] font-medium">
            {endpointAddress(endpoint)}
          </b>
        </div>
        {edited && <span className={cn("text-[11px] font-medium", mirrored ? "text-ba" : "text-ab")}>Edited</span>}
        <StatusPill kind={endpoint.kind} status={runtime.status} />
        {(endpoint.kind === "tcp-server" || endpoint.kind === "websocket-server") && runtime.status === "connected" && <span className="shrink-0 rounded-md bg-[color-mix(in_srgb,var(--ok)_14%,transparent)] px-1.5 py-1 text-[10px] text-ok">● <strong className="text-[11px] font-bold">{runtime.peers.length}</strong> {runtime.peers.length === 1 ? "client" : "clients"}</span>}
        <SideToggle profileName={profileName} side={side} enabled={enabled} pending={pending} />
      </header>
      <div
        className="flex min-w-0 flex-1 flex-col gap-2.5"
      >
        <EndpointSelector key={profileName} profileName={profileName} side={side} kind={endpoint.kind} />
        <div
          key={endpoint.kind}
          className="grid min-h-24 animate-in grid-cols-2 content-start gap-x-2.5 gap-y-[9px] duration-150 fade-in-0"
        >
          <EndpointFields
            endpoint={endpoint}
            onChange={(next) => updateEndpoint(profileName, side, next)}
          />
        </div>
        <footer
          className={cn(
            "mt-auto flex min-w-0 items-center gap-2.5 border-t border-line pt-[9px] text-[11.5px]",
            mirrored && "flex-row-reverse",
          )}
        >
          <span
            data-selectable
            className={cn(
              "min-w-0 flex-1 truncate text-fg-3",
              mirrored && "text-right",
              runtime.status === "error" && "text-err",
            )}
          >
            {sideDetail(endpoint.kind, runtime, bridge.running)}
          </span>
          <SideTraffic side={side} counters={counters} rates={bridge.sideRates[side]} />
        </footer>
      </div>
    </section>
  );
};
