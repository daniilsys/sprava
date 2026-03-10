import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { api } from "../../lib/api";
import { confirm } from "../ui/ConfirmDialog";
import { useAppStore } from "../../store/app.store";
import { useMyHighestRolePosition } from "../../hooks/usePermission";
import { useAuthStore } from "../../store/auth.store";
import type { Role } from "../../types/models";

interface RoleEditorProps {
  serverId: string;
}

interface PermDef {
  key: string;
  bit: bigint;
}

const PERMISSION_GROUPS: { labelKey: string; perms: PermDef[] }[] = [
  {
    labelKey: "admin",
    perms: [
      { key: "ADMINISTRATOR", bit: 1n << 0n },
      { key: "MANAGE_SERVER", bit: 1n << 1n },
      { key: "MANAGE_CHANNELS", bit: 1n << 2n },
      { key: "MANAGE_ROLES", bit: 1n << 3n },
    ],
  },
  {
    labelKey: "moderation",
    perms: [
      { key: "KICK_MEMBERS", bit: 1n << 4n },
      { key: "BAN_MEMBERS", bit: 1n << 5n },
      { key: "UNBAN_MEMBERS", bit: 1n << 6n },
      { key: "MANAGE_MESSAGES", bit: 1n << 12n },
    ],
  },
  {
    labelKey: "general",
    perms: [
      { key: "GENERATE_INVITE", bit: 1n << 7n },
      { key: "VIEW_CHANNELS", bit: 1n << 8n },
      { key: "MENTION_EVERYONE", bit: 1n << 15n },
    ],
  },
  {
    labelKey: "text",
    perms: [
      { key: "READ_MESSAGES", bit: 1n << 9n },
      { key: "SEND_MESSAGES", bit: 1n << 10n },
      { key: "VIEW_HISTORY", bit: 1n << 11n },
      { key: "UPLOAD_FILES", bit: 1n << 13n },
      { key: "REACT", bit: 1n << 14n },
    ],
  },
  {
    labelKey: "voice",
    perms: [
      { key: "JOIN_VOICE", bit: 1n << 16n },
      { key: "SPEAK", bit: 1n << 17n },
      { key: "MUTE_MEMBERS", bit: 1n << 18n },
      { key: "DEAFEN_MEMBERS", bit: 1n << 19n },
    ],
  },
];

function SortableRoleItem({
  role,
  isSelected,
  onSelect,
  canDrag,
  canEdit,
}: {
  role: Role;
  isSelected: boolean;
  onSelect: () => void;
  canDrag: boolean;
  canEdit: boolean;
}) {
  const { t } = useTranslation("server");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: role.id, disabled: !canDrag });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <button
        onClick={onSelect}
        className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${
          isSelected
            ? "bg-elevated-2 text-text-primary"
            : "text-text-secondary hover:bg-elevated"
        }`}
      >
        {canDrag ? (
          <span
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-text-muted hover:text-text-secondary flex-shrink-0"
            title={t("roles.dragToReorder")}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="6" r="2" />
              <circle cx="15" cy="6" r="2" />
              <circle cx="9" cy="12" r="2" />
              <circle cx="15" cy="12" r="2" />
              <circle cx="9" cy="18" r="2" />
              <circle cx="15" cy="18" r="2" />
            </svg>
          </span>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        {role.color && (
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: role.color }} />
        )}
        <span className="truncate flex-1">{role.name}</span>
        {!canEdit && (
          <span className="flex-shrink-0 w-5 h-5 rounded-md bg-warning/15 flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-warning">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </span>
        )}
      </button>
    </div>
  );
}

export function RoleEditor({ serverId }: RoleEditorProps) {
  const { t } = useTranslation(["server", "common"]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editPerms, setEditPerms] = useState(0n);
  const [editSeparate, setEditSeparate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");

  const myHighestPos = useMyHighestRolePosition(serverId);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const server = useAppStore((s) => s.servers.get(serverId));
  const isOwner = server?.ownerId === currentUserId;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  useEffect(() => {
    loadRoles();
  }, [serverId]);

  const loadRoles = async () => {
    try {
      const result = (await api.roles.list(serverId)) as Role[];
      setRoles(result);
    } catch {
      // Ignore
    }
  };

  const selected = roles.find((r) => r.id === selectedId);
  // Can only edit roles strictly below my highest role (lower position = higher rank)
  // Owner can edit all roles. @world role can always have its permissions edited.
  const canEditSelected = isOwner || !selected || selected.isWorld || selected.position > myHighestPos;

  const selectRole = (role: Role) => {
    setSelectedId(role.id);
    setEditName(role.name);
    setEditColor(role.color || "");
    setEditPerms(BigInt(role.permissions));
    setEditSeparate(role.separate ?? false);
    setSaved(false);
  };

  const hasChanges = useMemo(() => {
    if (!selected) return false;
    return (
      editName !== selected.name ||
      editColor !== (selected.color || "") ||
      editPerms !== BigInt(selected.permissions) ||
      editSeparate !== (selected.separate ?? false)
    );
  }, [selected, editName, editColor, editPerms, editSeparate]);

  const togglePerm = (bit: bigint) => {
    setEditPerms((prev) => (prev & bit) ? prev & ~bit : prev | bit);
  };

  const handleSave = async () => {
    if (!selectedId || !selected) return;
    setLoading(true);
    setSaved(false);
    try {
      // @world: only permissions and separate can change
      if (!selected.isWorld) {
        await api.roles.update(serverId, selectedId, {
          name: editName,
          color: editColor || null,
          separate: editSeparate,
        });
      } else {
        // For @world only send separate
        if (editSeparate !== (selected.separate ?? false)) {
          await api.roles.update(serverId, selectedId, { separate: editSeparate });
        }
      }
      if (editPerms !== BigInt(selected.permissions)) {
        await api.roles.updatePermissions(serverId, selectedId, {
          permissions: editPerms.toString(),
        });
      }
      // Update local + global state directly to avoid flicker from loadRoles
      const updatedRole = {
        ...selected,
        ...(selected.isWorld ? {} : { name: editName, color: editColor || null }),
        permissions: editPerms.toString(),
        separate: editSeparate,
      };
      setRoles((prev) => prev.map((r) => (r.id === selectedId ? updatedRole : r)));
      useAppStore.getState().updateRole(updatedRole);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("Failed to save role:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const n = newRoleName.trim();
    if (!n) return;
    setLoading(true);
    try {
      const created = await api.roles.create(serverId, { name: n }) as Role;
      useAppStore.getState().addRole(created);
      setNewRoleName("");
      await loadRoles();
    } catch (e) {
      console.error("Failed to create role:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!(await confirm(t("server:roles.deleteConfirm")))) return;
    setLoading(true);
    try {
      await api.roles.delete(serverId, selectedId);
      useAppStore.getState().removeRole(selectedId);
      setSelectedId(null);
      await loadRoles();
    } catch (e) {
      console.error("Failed to delete role:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = roles.findIndex((r) => r.id === active.id);
    const newIndex = roles.findIndex((r) => r.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Don't allow dragging @world or dropping onto @world's position
    const draggedRole = roles[oldIndex];
    const targetRole = roles[newIndex];
    if (draggedRole.isWorld || targetRole.isWorld) return;

    // Non-owner can only reorder roles strictly below their highest role
    if (!isOwner && (draggedRole.position <= myHighestPos || targetRole.position <= myHighestPos)) return;

    // Optimistic update
    const reordered = arrayMove(roles, oldIndex, newIndex);
    setRoles(reordered);

    // Update positions on server
    try {
      await Promise.all(
        reordered.map((role, i) =>
          role.position !== i
            ? api.roles.update(serverId, role.id, { position: i })
            : null,
        ),
      );
      await loadRoles();
    } catch (e) {
      console.error("Failed to reorder roles:", e);
      await loadRoles(); // revert
    }
  };

  const roleIds = roles.map((r) => r.id);

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* Role list */}
      <div className="w-48 flex-shrink-0 space-y-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={roleIds} strategy={verticalListSortingStrategy}>
            {roles.map((role) => {
              const editable = isOwner || role.isWorld || role.position > myHighestPos;
              return (
                <SortableRoleItem
                  key={role.id}
                  role={role}
                  isSelected={selectedId === role.id}
                  onSelect={() => selectRole(role)}
                  canDrag={!role.isWorld && editable}
                  canEdit={editable}
                />
              );
            })}
          </SortableContext>
        </DndContext>
        <div className="flex items-start gap-1 mt-2">
          <div className="flex-1 min-w-0">
            <Input
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder={t("server:roles.namePlaceholder")}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <Button size="sm" onClick={handleCreate} disabled={!newRoleName.trim()} className="flex-shrink-0 h-[38px]">+</Button>
        </div>
      </div>

      {/* Role editor */}
      {selected ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Hierarchy warning */}
          {!canEditSelected && (
            <div className="flex-shrink-0 px-3 py-2 mb-3 rounded-lg bg-warning/10 border border-warning/20 text-xs text-warning">
              {t("server:roles.cannotEditHigherRole")}
            </div>
          )}
          {/* Fixed top: Name + Color */}
          <div className="flex-shrink-0 pb-4">
            {selected.isWorld ? (
              <p className="text-sm text-text-muted">
                {t("server:roles.worldDesc")}
              </p>
            ) : (
              <div className={`flex items-end gap-3 ${!canEditSelected ? "opacity-50 pointer-events-none" : ""}`}>
                <div className="flex-1 min-w-0">
                  <label className="block text-xs font-medium text-text-muted mb-1 uppercase tracking-wider">{t("server:roles.name")}</label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} disabled={!canEditSelected} />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-medium text-text-muted mb-1 uppercase tracking-wider">{t("server:roles.color")}</label>
                  <div className="flex items-center gap-2">
                    <label
                      className="w-[38px] h-[38px] rounded-lg border border-border-subtle cursor-pointer flex-shrink-0 transition-colors hover:border-text-muted"
                      style={{ backgroundColor: editColor || "var(--color-elevated-2)" }}
                    >
                      <input
                        type="color"
                        value={editColor || "#99AAB5"}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="sr-only"
                        disabled={!canEditSelected}
                      />
                    </label>
                    {editColor && (
                      <button
                        onClick={() => setEditColor("")}
                        disabled={!canEditSelected}
                        className="w-[38px] h-[38px] rounded-lg border border-border-subtle flex items-center justify-center text-text-muted hover:text-text-primary hover:border-text-muted transition-colors"
                        title={t("server:roles.removeColor")}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Scrollable: Permissions + Settings */}
          <div className={`flex-1 overflow-y-auto min-h-0 ${!canEditSelected ? "opacity-50 pointer-events-none" : ""}`}>
            {/* Separate toggle */}
            {!selected.isWorld && (
              <div className="mb-4">
                <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-elevated cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editSeparate}
                    onChange={(e) => setEditSeparate(e.target.checked)}
                    disabled={!canEditSelected}
                    className="w-4 h-4 rounded accent-primary"
                  />
                  <div>
                    <p className="text-sm text-text-primary">{t("server:roles.displaySeparately")}</p>
                    <p className="text-xs text-text-muted">{t("server:roles.displaySeparatelyDesc")}</p>
                  </div>
                </label>
              </div>
            )}

            <label className="block text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">{t("server:roles.permissions")}</label>
            <div className="space-y-4">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.labelKey}>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1 px-3">{t(`server:roles.permGroup.${group.labelKey}`)}</p>
                  <div className="space-y-1">
                    {group.perms.map((perm) => (
                      <label key={perm.key} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${canEditSelected ? "hover:bg-elevated cursor-pointer" : "cursor-not-allowed"}`}>
                        <input
                          type="checkbox"
                          checked={(editPerms & perm.bit) !== 0n}
                          onChange={() => canEditSelected && togglePerm(perm.bit)}
                          disabled={!canEditSelected}
                          className="w-4 h-4 rounded accent-primary"
                        />
                        <div>
                          <p className="text-sm text-text-primary">{t(`server:roles.perm.${perm.key}`)}</p>
                          <p className="text-xs text-text-muted">{t(`server:roles.permDesc.${perm.key}`)}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fixed bottom: Actions */}
          <div className={`flex-shrink-0 flex ${selected.isWorld ? "justify-end" : "justify-between"} pt-4 border-t border-border-subtle mt-4`}>
            {!selected.isWorld && canEditSelected && (
              <Button variant="danger" onClick={handleDelete} loading={loading}>{t("server:roles.deleteRole")}</Button>
            )}
            {canEditSelected && (
              <Button
                onClick={handleSave}
                loading={loading}
                variant={saved ? "success" : "primary"}
                disabled={!hasChanges && !saved}
              >
                {saved ? t("server:roles.applied") : t("common:saveChanges")}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
          {t("server:roles.selectToEdit")}
        </div>
      )}
    </div>
  );
}
