import { useMemo, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAppStore } from "../../store/app.store";
import { useAuthStore } from "../../store/auth.store";
import { useUIStore } from "../../store/ui.store";
import { hasPermission, hasChannelPermission } from "../../store/permissions.store";
import { usePermissionsStore } from "../../store/permissions.store";
import { P } from "../../constants/permissions";
import { ChannelItem } from "./ChannelItem";
import { CreateChannelModal } from "./CreateChannelModal";
import { EditChannelModal } from "./EditChannelModal";
import { ServerHeader } from "./ServerHeader";
import { ScrollArea } from "../ui/ScrollArea";
import { CurrentUserBar } from "../user/CurrentUserBar";
import { ContextMenu, type ContextMenuEntry } from "../ui/ContextMenu";
import { confirm } from "../ui/ConfirmDialog";
import { Icons } from "../ui/icons";
import { api } from "../../lib/api";
import type { Channel } from "../../types/models";

interface ChannelSidebarProps {
  serverId: string;
}

interface SidebarEntry {
  channel: Channel;
  children: Channel[];
}

function buildTree(channels: Channel[]): SidebarEntry[] {
  const topLevel = channels
    .filter((c) => !c.parentId)
    .sort((a, b) => a.position - b.position);
  const byParent = new Map<string, Channel[]>();
  for (const c of channels) {
    if (c.parentId) {
      const list = byParent.get(c.parentId) ?? [];
      list.push(c);
      byParent.set(c.parentId, list);
    }
  }
  for (const list of byParent.values())
    list.sort((a, b) => a.position - b.position);

  return topLevel.map((ch) => ({
    channel: ch,
    children: ch.type === "PARENT" ? (byParent.get(ch.id) ?? []) : [],
  }));
}

/** Flatten the tree to an ordered list of IDs for SortableContext */
function flattenIds(tree: SidebarEntry[]): string[] {
  const ids: string[] = [];
  for (const entry of tree) {
    ids.push(entry.channel.id);
    for (const child of entry.children) ids.push(child.id);
  }
  return ids;
}

function computeReorderPayload(
  channels: Channel[],
): Array<{ id: string; position: number; parentId: string | null }> {
  const groups = new Map<string, Channel[]>();
  for (const c of channels) {
    const key = c.parentId ?? "__root";
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }
  const payload: Array<{
    id: string;
    position: number;
    parentId: string | null;
  }> = [];
  for (const [key, list] of groups) {
    list.sort((a, b) => a.position - b.position);
    list.forEach((c, i) => {
      payload.push({
        id: c.id,
        position: i,
        parentId: key === "__root" ? null : key,
      });
    });
  }
  return payload;
}

function hasChanges(a: Channel[], b: Channel[]): boolean {
  const map = new Map(a.map((c) => [c.id, c]));
  for (const ch of b) {
    const o = map.get(ch.id);
    if (!o) return true;
    if (
      o.position !== ch.position ||
      (o.parentId ?? null) !== (ch.parentId ?? null)
    )
      return true;
  }
  return false;
}

// ─── Sortable wrappers ───────────────────────────────────────────

function SortableChannelItem({
  channel,
  serverId,
  disabled,
}: {
  channel: Channel;
  serverId: string;
  disabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: channel.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ChannelItem channel={channel} serverId={serverId} />
    </div>
  );
}

function SortableCategory({
  entry,
  serverId,
  disabled,
  collapsed,
  onToggle,
  navigableChannels,
  focusedIndex,
  canManageChannels,
}: {
  entry: SidebarEntry;
  serverId: string;
  disabled: boolean;
  collapsed: boolean;
  onToggle: () => void;
  navigableChannels: Channel[];
  focusedIndex: number;
  canManageChannels: boolean;
}) {
  const cat = entry.channel;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cat.id, disabled });

  const { t } = useTranslation("server");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const handleDeleteCategory = async () => {
    if (!(await confirm(t("channel.deleteCategoryConfirm", { name: cat.name })))) return;
    try {
      await api.channels.delete(cat.id);
      useAppStore.getState().removeChannel(cat.id, serverId);
    } catch {
      // Ignore
    }
  };

  const menuItems: ContextMenuEntry[] = [
    ...(canManageChannels ? [
      { label: t("channel.createChannel"), icon: Icons.plus, onClick: () => setCreateOpen(true) },
      { separator: true } as ContextMenuEntry,
      { label: t("channel.editCategory"), icon: Icons.pencil, onClick: () => setEditOpen(true) },
    ] : []),
    { label: t("channel.copyCategoryId"), icon: Icons.copy, onClick: () => navigator.clipboard.writeText(cat.id) },
    ...(canManageChannels ? [
      { separator: true } as ContextMenuEntry,
      { label: t("channel.deleteCategory"), icon: Icons.trash, onClick: handleDeleteCategory, variant: "danger" as const },
    ] : []),
  ];

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        {...attributes}
        {...listeners}
        className="flex items-center gap-1 px-1 pt-4 pb-1 cursor-pointer select-none group"
        onClick={onToggle}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          className={`text-text-muted transition-transform ${collapsed ? "-rotate-90" : ""}`}
        >
          <path
            d="M2 3l3 3 3-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted truncate flex-1">
          {cat.name}
        </span>
      </div>

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} items={menuItems} onClose={() => setContextMenu(null)} />
      )}

      <CreateChannelModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        serverId={serverId}
        parentId={cat.id}
      />

      <EditChannelModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        channel={cat}
      />

      {!collapsed &&
        entry.children.map((ch) => {
          const navIdx = navigableChannels.indexOf(ch);
          return (
            <div
              key={ch.id}
              role="option"
              aria-selected={useUIStore.getState().activeChannelId === ch.id}
              className={`ml-2 ${navIdx === focusedIndex ? "ring-2 ring-primary/50 rounded-lg" : ""}`}
            >
              <SortableChannelItem
                channel={ch}
                serverId={serverId}
                disabled={disabled}
              />
            </div>
          );
        })}
    </div>
  );
}

const ROOT_DROP_ID = "__root_drop";

function RootDropZone({ isDragging }: { isDragging: boolean }) {
  const { t } = useTranslation("server");
  const { setNodeRef, isOver } = useDroppable({ id: ROOT_DROP_ID });

  if (!isDragging) return null;

  return (
    <div
      ref={setNodeRef}
      className={`h-6 rounded-md mb-1 flex items-center justify-center text-[10px] uppercase tracking-wider transition-colors ${
        isOver
          ? "bg-primary/20 border border-primary/40 text-primary"
          : "border border-dashed border-border-subtle text-text-muted"
      }`}
    >
      {t("channel.dropHereNoCategory")}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────

export function ChannelSidebar({ serverId }: ChannelSidebarProps) {
  const channels = useAppStore((s) => s.channels);
  const server = useAppStore((s) => s.servers.get(serverId));
  const roles = useAppStore((s) => s.roles);
  const currentUserId = useAuthStore((s) => s.user?.id);

  // Subscribe to permission store state for reactivity
  const myRoleIds = usePermissionsStore((s) => s.myRoleIds.get(serverId));
  const channelRules = usePermissionsStore((s) => s.channelRules);

  const canManageChannels = useMemo(() => {
    if (!currentUserId) return false;
    if (server?.ownerId === currentUserId) return true;
    return hasPermission(serverId, P.CONFIGURE_CHANNELS);
  }, [serverId, currentUserId, server?.ownerId, myRoleIds, roles]);

  const serverChannels = useMemo(
    () =>
      Array.from(channels.values()).filter((c) => c.serverId === serverId),
    [channels, serverId],
  );

  // Filter channels by VIEW_CHANNEL permission
  const visibleChannels = useMemo(() => {
    return serverChannels.filter((c) => {
      if (c.type === "PARENT") return true; // filter parents later based on children
      return hasChannelPermission(serverId, c.id, P.VIEW_CHANNEL);
    });
  }, [serverChannels, serverId, myRoleIds, channelRules, roles]);

  const [localItems, setLocalItems] = useState<Channel[] | null>(null);
  const [originalItems, setOriginalItems] = useState<Channel[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(),
  );

  // When dragging, use all server channels (unfiltered) for correct reorder;
  // otherwise use visibility-filtered list
  const displayChannels = localItems ?? visibleChannels;
  const tree = useMemo(() => {
    const raw = buildTree(displayChannels);
    // Hide PARENT categories if ALL their children are filtered out
    return raw.filter((entry) => {
      if (entry.channel.type !== "PARENT") return true;
      return entry.children.length > 0;
    });
  }, [displayChannels]);
  const sortableIds = useMemo(() => flattenIds(tree), [tree]);

  // Flatten navigable (non-PARENT) channels for keyboard navigation
  const navigableChannels = useMemo(() => {
    const result: Channel[] = [];
    for (const entry of tree) {
      if (entry.channel.type !== "PARENT") {
        result.push(entry.channel);
      } else if (!collapsedCategories.has(entry.channel.id)) {
        result.push(...entry.children);
      }
    }
    return result;
  }, [tree, collapsedCategories]);

  const [focusedIndex, setFocusedIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (navigableChannels.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((i) => (i < navigableChannels.length - 1 ? i + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => (i > 0 ? i - 1 : navigableChannels.length - 1));
      } else if (e.key === "Enter" && focusedIndex >= 0 && focusedIndex < navigableChannels.length) {
        e.preventDefault();
        const ch = navigableChannels[focusedIndex];
        useUIStore.getState().navigateToChannel(serverId, ch.id);
      }
    },
    [navigableChannels, focusedIndex, serverId],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const toggleCategory = useCallback((categoryId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }, []);

  const channelMap = useMemo(
    () => new Map(displayChannels.map((c) => [c.id, c])),
    [displayChannels],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setActiveId(event.active.id as string);
      setOriginalItems(serverChannels);
      setLocalItems(serverChannels);
    },
    [serverChannels],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      setLocalItems((prev) => {
        if (!prev) return prev;

        const activeChannel = prev.find((c) => c.id === active.id);
        if (!activeChannel) return prev;

        // Special: dragging over the root drop zone
        if (over.id === ROOT_DROP_ID) {
          if (activeChannel.type === "PARENT") return prev; // already root
          const oldParentId = activeChannel.parentId ?? null;
          if (oldParentId === null) return prev; // already root

          // Move to root, position 0
          const rootGroup = prev
            .filter((c) => !c.parentId && c.id !== active.id)
            .sort((a, b) => a.position - b.position);
          rootGroup.unshift(activeChannel);

          const sourceGroup = prev
            .filter(
              (c) =>
                (c.parentId ?? null) === oldParentId && c.id !== active.id,
            )
            .sort((a, b) => a.position - b.position);

          const byId = new Map(prev.map((c) => [c.id, { ...c }]));
          rootGroup.forEach((c, i) => {
            byId.set(c.id, {
              ...byId.get(c.id)!,
              position: i,
              parentId: null,
            });
          });
          sourceGroup.forEach((c, i) => {
            byId.set(c.id, { ...byId.get(c.id)!, position: i });
          });
          return Array.from(byId.values());
        }

        const overChannel = prev.find((c) => c.id === over.id);
        if (!overChannel) return prev;

        // Determine destination parentId
        let newParentId: string | null;
        if (activeChannel.type === "PARENT") {
          // Categories always stay top-level
          newParentId = null;
        } else if (overChannel.type === "PARENT") {
          // Dragging a channel over a category → put it inside
          newParentId = overChannel.id;
        } else {
          // Dragging over another channel → same parent as that channel
          newParentId = overChannel.parentId ?? null;
        }

        const oldParentId = activeChannel.parentId ?? null;

        // Build destination group without the active channel
        const destGroup = prev
          .filter(
            (c) =>
              (c.parentId ?? null) === newParentId && c.id !== active.id,
          )
          .sort((a, b) => a.position - b.position);

        // Find insert position
        let insertIdx: number;
        if (overChannel.type === "PARENT" && activeChannel.type !== "PARENT") {
          // Dropping into category → append at end
          insertIdx = destGroup.length;
        } else {
          const overIdx = destGroup.findIndex((c) => c.id === over.id);
          insertIdx = overIdx >= 0 ? overIdx : destGroup.length;
        }
        destGroup.splice(insertIdx, 0, activeChannel);

        // Build source group if parent changed
        const sourceGroup =
          oldParentId !== newParentId
            ? prev
                .filter(
                  (c) =>
                    (c.parentId ?? null) === oldParentId &&
                    c.id !== active.id,
                )
                .sort((a, b) => a.position - b.position)
            : null;

        // Clone and update
        const byId = new Map(prev.map((c) => [c.id, { ...c }]));
        destGroup.forEach((c, i) => {
          byId.set(c.id, {
            ...byId.get(c.id)!,
            position: i,
            parentId: newParentId,
          });
        });
        if (sourceGroup) {
          sourceGroup.forEach((c, i) => {
            byId.set(c.id, { ...byId.get(c.id)!, position: i });
          });
        }

        return Array.from(byId.values());
      });
    },
    [],
  );

  const handleDragEnd = useCallback(
    async (_event: DragEndEvent) => {
      setActiveId(null);
      const final = localItems;
      const original = originalItems;

      setLocalItems(null);
      setOriginalItems(null);

      if (!final || !original) return;
      if (!hasChanges(original, final)) return;

      // Commit to store
      const allChannels = useAppStore.getState().channels;
      const newChannels = new Map(allChannels);
      for (const ch of final) newChannels.set(ch.id, ch);
      useAppStore.setState({ channels: newChannels });

      // API call
      const payload = computeReorderPayload(final);
      try {
        await api.channels.reorder(serverId, payload);
      } catch (err) {
        console.error("Failed to reorder channels:", err);
        const revertMap = new Map(allChannels);
        for (const ch of original) revertMap.set(ch.id, ch);
        useAppStore.setState({ channels: revertMap });
      }
    },
    [serverId, localItems, originalItems],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setLocalItems(null);
    setOriginalItems(null);
  }, []);

  if (!server) return null;

  const activeChannel = activeId ? channelMap.get(activeId) : null;

  return (
    <div className="w-60 bg-surface border-r border-border-subtle flex flex-col flex-shrink-0">
      <ServerHeader server={server} />
      <ScrollArea className="flex-1 px-2 py-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={sortableIds}
            strategy={verticalListSortingStrategy}
          >
            <div
              ref={listRef}
              role="listbox"
              tabIndex={0}
              aria-label="Channel list"
              onKeyDown={handleListKeyDown}
              className="flex flex-col gap-0.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-lg"
            >
              <RootDropZone isDragging={!!activeId} />
              {tree.map((entry) => {
                const { channel: cat } = entry;

                if (cat.type !== "PARENT") {
                  const navIdx = navigableChannels.indexOf(cat);
                  return (
                    <div
                      key={cat.id}
                      role="option"
                      aria-selected={useUIStore.getState().activeChannelId === cat.id}
                      className={navIdx === focusedIndex ? "ring-2 ring-primary/50 rounded-lg" : ""}
                    >
                      <SortableChannelItem
                        channel={cat}
                        serverId={serverId}
                        disabled={!canManageChannels}
                      />
                    </div>
                  );
                }

                return (
                  <SortableCategory
                    key={cat.id}
                    entry={entry}
                    serverId={serverId}
                    disabled={!canManageChannels}
                    collapsed={collapsedCategories.has(cat.id)}
                    onToggle={() => toggleCategory(cat.id)}
                    navigableChannels={navigableChannels}
                    focusedIndex={focusedIndex}
                    canManageChannels={canManageChannels}
                  />
                );
              })}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeChannel ? (
              <div className="opacity-80 bg-surface rounded-lg shadow-lg">
                <ChannelItem channel={activeChannel} serverId={serverId} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </ScrollArea>
      <CurrentUserBar />
    </div>
  );
}
