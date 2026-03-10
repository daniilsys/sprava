import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../ui/Modal";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { useFriendsStore } from "../../store/friends.store";
import { useAppStore } from "../../store/app.store";
import { useUIStore } from "../../store/ui.store";
import { useAuthStore } from "../../store/auth.store";
import { api } from "../../lib/api";
import type { DmConversation } from "../../types/models";

const MAX_GROUP_SIZE = 9;

export function NewDmButton() {
  const { t } = useTranslation("dm");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-1 text-text-muted hover:text-text-primary transition-colors"
        title={t("newDm.tooltip")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <NewDmModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function NewDmModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation("dm");
  const friends = useFriendsStore((s) => s.friends);
  const currentUserId = useAuthStore((s) => s.user?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const friendsList = useMemo(() => {
    return friends.map((f) =>
      f.sender.id === currentUserId ? f.receiver : f.sender,
    );
  }, [friends, currentUserId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return friendsList;
    const q = search.toLowerCase();
    return friendsList.filter((f) => f.username.toLowerCase().includes(q));
  }, [friendsList, search]);

  const toggleSelect = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else if (next.size < MAX_GROUP_SIZE) {
        next.add(userId);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (selected.size === 0) return;
    setLoading(true);
    try {
      const participantIds = [currentUserId, ...selected];
      const dm = (await api.dm.create({ participantIds })) as DmConversation;
      useAppStore.getState().addDm(dm);
      useUIStore.getState().navigateToDm(dm.id);
      handleClose();
    } catch {
      // DM might already exist for 1:1
      if (selected.size === 1) {
        const targetId = [...selected][0];
        const dms = useAppStore.getState().dms;
        for (const [id, dm] of dms) {
          if (dm.type !== "GROUP" && dm.participants?.some((p) => p.userId === targetId)) {
            useUIStore.getState().navigateToDm(id);
            handleClose();
            return;
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelected(new Set());
    setSearch("");
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={t("newDm.title")}>
      <p className="text-sm text-text-muted mb-3">
        {t("newDm.maxSize", { max: MAX_GROUP_SIZE })}{" "}
        {selected.size > 1 && t("newDm.groupHint")}
      </p>

      {/* Search */}
      <div className="relative mb-3">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted w-3.5 h-3.5"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("newDm.searchPlaceholder")}
          className="w-full h-9 pl-8 pr-3 text-sm bg-elevated border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50"
        />
      </div>

      {/* Selected chips */}
      {selected.size > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {[...selected].map((userId) => {
            const friend = friendsList.find((f) => f.id === userId);
            if (!friend) return null;
            return (
              <button
                key={userId}
                onClick={() => toggleSelect(userId)}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/15 text-primary text-xs hover:bg-primary/25 transition-colors"
              >
                <Avatar src={friend.avatar} name={friend.username} size="xs" />
                <span>{friend.username}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            );
          })}
        </div>
      )}

      {/* Friends list */}
      <div className="max-h-56 overflow-y-auto space-y-0.5">
        {filtered.map((friend) => {
          const isSelected = selected.has(friend.id);
          const isDisabled = !isSelected && selected.size >= MAX_GROUP_SIZE;
          return (
            <button
              key={friend.id}
              onClick={() => toggleSelect(friend.id)}
              disabled={isDisabled}
              className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-colors text-left disabled:opacity-40 ${
                isSelected
                  ? "bg-primary/10 hover:bg-primary/15"
                  : "hover:bg-elevated"
              }`}
            >
              <Avatar src={friend.avatar} name={friend.username} size="sm" />
              <span className="text-sm text-text-primary flex-1">{friend.username}</span>
              <div
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                  isSelected
                    ? "bg-primary border-primary"
                    : "border-border-strong"
                }`}
              >
                {isSelected && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
        {friends.length === 0 && (
          <p className="text-sm text-text-muted text-center py-4">
            {t("newDm.noFriends")}
          </p>
        )}
        {friends.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-text-muted text-center py-4">
            {t("newDm.noResults", { search })}
          </p>
        )}
      </div>

      {/* Create button */}
      <div className="flex justify-end mt-4 pt-3 border-t border-border-subtle">
        <Button
          onClick={handleCreate}
          loading={loading}
          disabled={selected.size === 0}
        >
          {selected.size > 1 ? t("newDm.createGroup") : t("newDm.createDm")}
        </Button>
      </div>
    </Modal>
  );
}
