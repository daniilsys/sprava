import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { api } from "../../lib/api";
import { translateError } from "../../lib/errorMapping";
import { useAppStore } from "../../store/app.store";
import { useAuthStore } from "../../store/auth.store";
import { useMyHighestRolePosition } from "../../hooks/usePermission";
import { confirm } from "../ui/ConfirmDialog";
import type { Channel } from "../../types/models";

interface EditChannelModalProps {
  open: boolean;
  onClose: () => void;
  channel: Channel;
}

// Channel-relevant permissions (server-level admin perms don't apply per-channel)
const CHANNEL_PERMISSIONS: {
  key: string;
  bit: bigint;
  categoryKey: string;
}[] = [
  { key: "VIEW_CHANNEL", bit: 1n << 8n, categoryKey: "general" },
  { key: "READ_MESSAGES", bit: 1n << 9n, categoryKey: "text" },
  { key: "SEND_MESSAGES", bit: 1n << 10n, categoryKey: "text" },
  { key: "VIEW_HISTORY", bit: 1n << 11n, categoryKey: "text" },
  { key: "MANAGE_MESSAGES", bit: 1n << 12n, categoryKey: "text" },
  { key: "UPLOAD_FILES", bit: 1n << 13n, categoryKey: "text" },
  { key: "REACT", bit: 1n << 14n, categoryKey: "text" },
  { key: "MENTION_EVERYONE", bit: 1n << 15n, categoryKey: "text" },
  { key: "JOIN_VOICE", bit: 1n << 16n, categoryKey: "voice" },
  { key: "SPEAK", bit: 1n << 17n, categoryKey: "voice" },
  { key: "MUTE_MEMBERS", bit: 1n << 18n, categoryKey: "voice" },
  { key: "DEAFEN_MEMBERS", bit: 1n << 19n, categoryKey: "voice" },
];

type Tab = "general" | "permissions";

interface ChannelRule {
  id: string;
  channelId: string;
  roleId: string | null;
  memberId: string | null;
  allow: string;
  deny: string;
}

// Tri-state: inherit (neither allow nor deny), allow, deny
type PermState = "inherit" | "allow" | "deny";

function getPermState(allow: bigint, deny: bigint, bit: bigint): PermState {
  if ((allow & bit) !== 0n) return "allow";
  if ((deny & bit) !== 0n) return "deny";
  return "inherit";
}

function cyclePermState(current: PermState): PermState {
  if (current === "inherit") return "allow";
  if (current === "allow") return "deny";
  return "inherit";
}

function TriStateButton({
  state,
  onClick,
  stateLabels,
  disabled = false,
}: {
  state: PermState;
  onClick: () => void;
  stateLabels: { inherit: string; allowed: string; denied: string };
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold transition-all disabled:opacity-40 disabled:pointer-events-none ${!disabled ? "active:scale-90" : ""} ${
        state === "allow"
          ? "bg-success/20 text-success border border-success/30"
          : state === "deny"
            ? "bg-danger/20 text-danger border border-danger/30"
            : "bg-elevated-2 text-text-muted border border-border-subtle hover:border-border-strong"
      }`}
      title={
        state === "inherit"
          ? stateLabels.inherit
          : state === "allow"
            ? stateLabels.allowed
            : stateLabels.denied
      }
    >
      {state === "allow" ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : state === "deny" ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      ) : (
        <span className="text-[10px]">/</span>
      )}
    </button>
  );
}

function RuleEditor({
  rule,
  label,
  color,
  channelId,
  onUpdate,
  onDelete,
  readOnly = false,
}: {
  rule: ChannelRule;
  label: string;
  color?: string | null;
  channelId: string;
  onUpdate: (rule: ChannelRule) => void;
  onDelete: (ruleId: string) => void;
  readOnly?: boolean;
}) {
  const { t } = useTranslation(["server", "common"]);
  const [allow, setAllow] = useState(BigInt(rule.allow));
  const [deny, setDeny] = useState(BigInt(rule.deny));
  const [saving, setSaving] = useState(false);

  const hasChanges = allow !== BigInt(rule.allow) || deny !== BigInt(rule.deny);

  const handleToggle = (bit: bigint) => {
    const current = getPermState(allow, deny, bit);
    const next = cyclePermState(current);
    if (next === "allow") {
      setAllow((a) => a | bit);
      setDeny((d) => d & ~bit);
    } else if (next === "deny") {
      setAllow((a) => a & ~bit);
      setDeny((d) => d | bit);
    } else {
      setAllow((a) => a & ~bit);
      setDeny((d) => d & ~bit);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        allow: allow.toString(),
        deny: deny.toString(),
      };
      if (rule.roleId) body.roleId = rule.roleId;
      else body.memberId = rule.memberId;
      const updated = (await api.channels.upsertRule(
        channelId,
        body,
      )) as ChannelRule;
      onUpdate(updated);
    } catch (e) {
      console.error("Failed to save rule:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!(await confirm(t("server:editChannel.removeRuleConfirm", { name: label })))) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (rule.roleId) body.roleId = rule.roleId;
      else body.memberId = rule.memberId;
      await api.channels.deleteRule(channelId, body);
      onDelete(rule.id);
    } catch (e) {
      console.error("Failed to delete rule:", e);
    } finally {
      setSaving(false);
    }
  };

  // Group permissions by category
  const categories = CHANNEL_PERMISSIONS.reduce(
    (acc, p) => {
      if (!acc[p.categoryKey]) acc[p.categoryKey] = [];
      acc[p.categoryKey].push(p);
      return acc;
    },
    {} as Record<string, typeof CHANNEL_PERMISSIONS>,
  );

  const stateLabels = {
    inherit: t("server:editChannel.permState.inherit"),
    allowed: t("server:editChannel.permState.allowed"),
    denied: t("server:editChannel.permState.denied"),
  };

  return (
    <div className="animate-fade-slide-up">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {color && (
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
          )}
          <span className="text-sm font-medium text-text-primary">{label}</span>
        </div>
        {!readOnly && (
          <button
            onClick={handleRemove}
            disabled={saving}
            className="text-xs text-text-muted hover:text-danger transition-colors"
          >
            {t("server:editChannel.remove")}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {Object.entries(categories).map(([categoryKey, perms]) => (
          <div key={categoryKey}>
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1.5">
              {t(`server:editChannel.permGroup.${categoryKey}`)}
            </p>
            <div className="space-y-0.5">
              {perms.map((perm) => (
                <div
                  key={perm.key}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-elevated/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary">{t(`server:editChannel.perm.${perm.key}`)}</p>
                    <p className="text-[11px] text-text-muted">
                      {t(`server:editChannel.permDesc.${perm.key}`)}
                    </p>
                  </div>
                  <TriStateButton
                    state={getPermState(allow, deny, perm.bit)}
                    onClick={() => !readOnly && handleToggle(perm.bit)}
                    stateLabels={stateLabels}
                    disabled={readOnly}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {hasChanges && (
        <div className="flex justify-end mt-3 pt-3 border-t border-border-subtle animate-fade-slide-up">
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setAllow(BigInt(rule.allow));
                setDeny(BigInt(rule.deny));
              }}
            >
              {t("server:editChannel.reset")}
            </Button>
            <Button size="sm" onClick={handleSave} loading={saving}>
              {t("common:save")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PermissionsTab({ channel }: { channel: Channel }) {
  const { t } = useTranslation("server");
  const [rules, setRules] = useState<ChannelRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [addingType, setAddingType] = useState<"role" | "member" | null>(null);
  const [addRoleId, setAddRoleId] = useState("");

  // Role hierarchy
  const myHighestPos = useMyHighestRolePosition(channel.serverId);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const server = useAppStore((s) => s.servers.get(channel.serverId));
  const isOwner = server?.ownerId === currentUserId;

  // Fetch server roles from store
  const rolesMap = useAppStore((s) => s.roles);
  const serverRoles = useMemo(() => {
    return Array.from(rolesMap.values())
      .filter((r) => r.serverId === channel.serverId)
      .sort((a, b) => a.position - b.position);
  }, [rolesMap, channel.serverId]);

  // Fetch members from store
  const membersMap = useAppStore((s) => s.members.get(channel.serverId));

  useEffect(() => {
    loadRules();
  }, [channel.id]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const result = (await api.channels.getRules(channel.id)) as ChannelRule[];
      setRules(result);
      if (result.length > 0 && !selectedRuleId) {
        setSelectedRuleId(result[0].id);
      }
    } catch (e) {
      console.error("Failed to load rules:", e);
    } finally {
      setLoading(false);
    }
  };

  // Roles that don't have a rule yet — only roles strictly below my highest (or all if owner)
  const availableRoles = serverRoles.filter(
    (r) => !rules.some((rule) => rule.roleId === r.id) && (isOwner || r.isWorld || r.position > myHighestPos),
  );

  // Check if a rule's target role is editable (strictly below my highest role)
  const canEditRule = (rule: ChannelRule): boolean => {
    if (isOwner) return true;
    if (!rule.roleId) return true; // member rules — allowed if you have the perm
    const role = serverRoles.find((r) => r.id === rule.roleId);
    if (!role) return true;
    return role.isWorld || role.position > myHighestPos;
  };

  const handleAddRole = async () => {
    if (!addRoleId) return;
    try {
      const result = (await api.channels.upsertRule(channel.id, {
        roleId: addRoleId,
        allow: "0",
        deny: "0",
      })) as ChannelRule;
      setRules((prev) => [...prev, result]);
      setSelectedRuleId(result.id);
      setAddingType(null);
      setAddRoleId("");
    } catch (e) {
      console.error("Failed to add rule:", e);
    }
  };

  const handleUpdate = (updated: ChannelRule) => {
    setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  const handleDelete = (ruleId: string) => {
    setRules((prev) => {
      const remaining = prev.filter((r) => r.id !== ruleId);
      if (selectedRuleId === ruleId) {
        setSelectedRuleId(remaining.length > 0 ? remaining[0].id : null);
      }
      return remaining;
    });
  };

  const selectedRule = rules.find((r) => r.id === selectedRuleId);

  const getRuleLabel = (
    rule: ChannelRule,
  ): { label: string; color?: string | null } => {
    if (rule.roleId) {
      const role = serverRoles.find((r) => r.id === rule.roleId);
      return { label: role?.name ?? t("editChannel.unknownRole"), color: role?.color };
    }
    if (rule.memberId && membersMap) {
      const member = membersMap.get(rule.memberId);
      return {
        label: member
          ? `@${(member as any).username || rule.memberId}`
          : `User ${rule.memberId.slice(0, 8)}...`,
      };
    }
    return { label: t("editChannel.unknown") };
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="sm" />
      </div>
    );
  }

  return (
    <div className="flex gap-4 min-h-[340px]">
      {/* Left: rule list */}
      <div className="w-44 flex-shrink-0 flex flex-col">
        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2">
          {t("editChannel.rules")}
        </p>
        <div className="space-y-0.5 flex-1 overflow-y-auto">
          {rules.map((rule) => {
            const { label, color } = getRuleLabel(rule);
            const editable = canEditRule(rule);
            return (
              <button
                key={rule.id}
                onClick={() => setSelectedRuleId(rule.id)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                  selectedRuleId === rule.id
                    ? "bg-elevated-2 text-text-primary"
                    : "text-text-secondary hover:bg-elevated"
                }`}
              >
                {color && (
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                )}
                <span className="truncate flex-1">{label}</span>
                {!editable && (
                  <span className="flex-shrink-0 w-4 h-4 rounded flex items-center justify-center bg-warning/15">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-warning">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
          {rules.length === 0 && (
            <p className="text-xs text-text-muted px-2 py-4">{t("editChannel.noRules")}</p>
          )}
        </div>

        {/* Add rule */}
        {addingType === "role" ? (
          <div className="mt-2 space-y-1.5 animate-fade-slide-up">
            <select
              value={addRoleId}
              onChange={(e) => setAddRoleId(e.target.value)}
              className="w-full bg-elevated border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary outline-none"
            >
              <option value="">{t("editChannel.selectRole")}</option>
              {availableRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <div className="flex gap-1">
              <Button
                size="sm"
                onClick={handleAddRole}
                disabled={!addRoleId}
                className="flex-1"
              >
                {t("editChannel.add")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAddingType(null);
                  setAddRoleId("");
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setAddingType("role")}
            className="mt-2 w-full"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t("editChannel.addRule")}
          </Button>
        )}
      </div>

      {/* Right: rule editor */}
      <div className="flex-1 min-w-0 overflow-y-auto max-h-[400px] pr-1">
        {selectedRule ? (
          <RuleEditor
            key={selectedRule.id}
            rule={selectedRule}
            label={getRuleLabel(selectedRule).label}
            color={getRuleLabel(selectedRule).color}
            channelId={channel.id}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            readOnly={!canEditRule(selectedRule)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-text-muted">
            {rules.length === 0
              ? t("editChannel.noRulesDesc")
              : t("editChannel.selectRule")}
          </div>
        )}
      </div>
    </div>
  );
}

export function EditChannelModal({
  open,
  onClose,
  channel,
}: EditChannelModalProps) {
  const { t } = useTranslation(["server", "common"]);
  const [tab, setTab] = useState<Tab>("general");
  const [name, setName] = useState(channel.name);
  const [syncParentRules, setSyncParentRules] = useState(
    channel.syncParentRules ?? true,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Reset state when channel changes
  useEffect(() => {
    setName(channel.name);
    setSyncParentRules(channel.syncParentRules ?? true);
    setError("");
  }, [channel.id]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const changes: Record<string, unknown> = {};
    if (trimmed !== channel.name) changes.name = trimmed;
    if (
      channel.parentId &&
      syncParentRules !== (channel.syncParentRules ?? true)
    ) {
      changes.syncParentRules = syncParentRules;
    }

    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    setLoading(true);
    setError("");
    try {
      const updated = (await api.channels.update(
        channel.id,
        changes,
      )) as Channel;
      useAppStore.getState().updateChannel(updated);
      onClose();
    } catch (e: any) {
      setError(translateError(e));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const typeLabel = channel.type === "PARENT" ? t("server:createChannel.type.PARENT").toLowerCase() : t("server:editChannel.channel").toLowerCase();
    if (!(await confirm(t("server:editChannel.deleteConfirm", { type: typeLabel }))))
      return;
    setLoading(true);
    try {
      await api.channels.delete(channel.id);
      useAppStore.getState().removeChannel(channel.id, channel.serverId);
      onClose();
    } catch (e: any) {
      setError(translateError(e));
    } finally {
      setLoading(false);
    }
  };

  const tabDefs: { key: Tab; labelKey: string }[] = [
    { key: "general", labelKey: "editChannel.tabs.general" },
    { key: "permissions", labelKey: "editChannel.tabs.permissions" },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size={tab === "permissions" ? "lg" : "md"}
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-5">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-display font-bold truncate">
            {channel.type === "PARENT" ? t("server:editChannel.titleCategory") : t("server:editChannel.titleChannel")}
          </h2>
          <p className="text-xs text-text-muted mt-0.5 truncate">
            #{channel.name}
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-0.5 bg-elevated rounded-lg mb-5">
        {tabDefs.map((td) => (
          <button
            key={td.key}
            onClick={() => setTab(td.key)}
            className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${
              tab === td.key
                ? "bg-elevated-2 text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t(`server:${td.labelKey}`)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "general" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1 uppercase tracking-wider">
              {channel.type === "PARENT" ? t("server:editChannel.categoryName") : t("server:editChannel.channelName")}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              error={error}
            />
          </div>

          {/* Sync parent rules toggle — only for child channels */}
          {channel.parentId && (
            <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-elevated/50 border border-border-subtle cursor-pointer hover:bg-elevated transition-colors">
              <input
                type="checkbox"
                checked={syncParentRules}
                onChange={(e) => setSyncParentRules(e.target.checked)}
                className="w-4 h-4 rounded accent-primary"
              />
              <div>
                <p className="text-sm text-text-primary">
                  {t("server:editChannel.syncParent")}
                </p>
                <p className="text-xs text-text-muted">
                  {t("server:editChannel.syncParentDesc")}
                </p>
              </div>
            </label>
          )}

          {/* Channel type badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted uppercase tracking-wider">
              {t("server:editChannel.type")}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-elevated-2 text-text-secondary">
              {t(`server:createChannel.type.${channel.type}`)}
            </span>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="danger" onClick={handleDelete} loading={loading}>
              {t("server:editChannel.deleteLabel", { type: channel.type === "PARENT" ? t("server:createChannel.type.PARENT") : t("server:editChannel.channel") })}
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>
                {t("common:cancel")}
              </Button>
              <Button
                onClick={handleSave}
                loading={loading}
                disabled={!name.trim()}
              >
                {t("common:save")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {tab === "permissions" && <PermissionsTab channel={channel} />}
    </Modal>
  );
}
