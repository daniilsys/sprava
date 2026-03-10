import { ServerRail } from "../sidebar/ServerRail";

export function ArcSidebar() {
  return (
    <div className="h-full w-[72px] bg-bg border-r border-border-subtle flex flex-col flex-shrink-0">
      <ServerRail />
    </div>
  );
}
