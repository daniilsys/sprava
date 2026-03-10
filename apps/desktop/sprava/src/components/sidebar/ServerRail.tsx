import { useAppStore } from "../../store/app.store";
import { useUIStore } from "../../store/ui.store";
import { ServerIcon } from "./ServerIcon";
import { HomeIcon } from "./HomeIcon";
import { AddServerButton } from "./AddServerButton";
import { CreateServerModal } from "./CreateServerModal";
import { JoinServerModal } from "./JoinServerModal";
import { ScrollArea } from "../ui/ScrollArea";

export function ServerRail() {
  const servers = useAppStore((s) => s.servers);
  const modal = useUIStore((s) => s.modal);

  return (
    <>
      <ScrollArea className="flex-1">
        <div className="flex flex-col items-center gap-2 py-3">
          <HomeIcon />

          <div className="w-8 h-px bg-border mx-auto" />

          {Array.from(servers.values()).map((server) => (
            <ServerIcon key={server.id} server={server} />
          ))}

          <div className="w-8 h-px bg-border mx-auto" />

          <AddServerButton />
        </div>
      </ScrollArea>

      <CreateServerModal
        open={modal === "createServer"}
        onClose={() => useUIStore.getState().closeModal()}
      />
      <JoinServerModal
        open={modal === "joinServer"}
        onClose={() => useUIStore.getState().closeModal()}
      />
    </>
  );
}
