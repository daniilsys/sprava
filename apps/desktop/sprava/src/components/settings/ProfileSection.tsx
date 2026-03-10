import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { useAuthStore } from "../../store/auth.store";
import { api } from "../../lib/api";
import { translateError } from "../../lib/errorMapping";
import { uploadAvatar } from "../../lib/upload";
import type { User, UserProfile } from "../../types/models";

export function ProfileSection() {
  const { t } = useTranslation("settings");
  const user = useAuthStore((s) => s.user);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Profile fields
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Track initial values to detect changes
  const [initial, setInitial] = useState({ bio: "", location: "", website: "" });

  useEffect(() => {
    loadProfile();
  }, []);

  // Clean up blob URL on unmount or when preview changes
  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const loadProfile = async () => {
    try {
      const me = (await api.users.getMe()) as UserProfile;
      const b = me.profile?.bio || "";
      const l = me.profile?.location || "";
      const w = me.profile?.website || "";
      setBio(b);
      setLocation(l);
      setWebsite(w);
      setInitial({ bio: b, location: l, website: w });
    } catch {
      // ignore
    } finally {
      setProfileLoading(false);
    }
  };

  const currentAvatar = avatarPreview ?? user?.avatar ?? null;

  const MAX_AVATAR_SIZE = 4 * 1024 * 1024; // 4 MB
  const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = "";

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(t("profile.avatarTypeError"));
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setError(t("profile.avatarSizeError", { size: (file.size / 1024 / 1024).toFixed(1) }));
      return;
    }

    // Show local preview only — don't upload yet
    if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarFailed(false);
    setPendingAvatarFile(file);
    setError("");
  };

  const handleCancelAvatar = () => {
    if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    setPendingAvatarFile(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      // Upload avatar if pending
      if (pendingAvatarFile) {
        const url = await uploadAvatar(pendingAvatarFile);
        const updated = (await api.users.updateAccount({ avatar: url })) as User;
        useAuthStore.getState().setUser(updated);
        setAvatarPreview(null);
        setPendingAvatarFile(null);
      }

      // Save profile fields
      await api.users.updateProfile({
        bio: bio.trim() || undefined,
        location: location.trim() || undefined,
        website: website.trim() || undefined,
      });
      const newInitial = { bio: bio.trim(), location: location.trim(), website: website.trim() };
      setInitial(newInitial);
      setBio(newInitial.bio);
      setLocation(newInitial.location);
      setWebsite(newInitial.website);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(translateError(e));
    } finally {
      setSaving(false);
    }
  };

  const hasProfileChanges =
    bio.trim() !== initial.bio ||
    location.trim() !== initial.location ||
    website.trim() !== initial.website;

  const hasChanges = hasProfileChanges || !!pendingAvatarFile;

  if (!user) return null;

  return (
    <div className="max-w-xl space-y-8">
      {/* Avatar */}
      <div>
        <label className="block text-xs font-medium text-text-muted mb-3 uppercase tracking-wider">
          {t("profile.avatar")}
        </label>
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative group w-20 h-20 rounded-full overflow-hidden flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            {currentAvatar && !avatarFailed ? (
              <img src={currentAvatar} alt={user.username} className="w-full h-full object-cover" onError={() => setAvatarFailed(true)} />
            ) : (
              <div className="w-full h-full bg-elevated-2 flex items-center justify-center text-xl font-medium text-text-secondary">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
            )}
            {/* Pending indicator */}
            {pendingAvatarFile && (
              <div className="absolute inset-0 rounded-full ring-2 ring-primary ring-offset-2 ring-offset-surface pointer-events-none" />
            )}
            {/* Hover overlay */}
            <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarSelect}
          />

          <div className="space-y-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              {t("profile.changeAvatar")}
            </Button>
            {pendingAvatarFile ? (
              <button
                onClick={handleCancelAvatar}
                className="block text-[11px] text-danger hover:text-danger-hover transition-colors"
              >
                {t("profile.cancelChange")}
              </button>
            ) : (
              <p className="text-[11px] text-text-muted">
                {t("profile.avatarHint")}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border-subtle" />

      {/* Profile fields */}
      {profileLoading ? (
        <div className="flex justify-center py-8">
          <Spinner size="sm" />
        </div>
      ) : (
        <>
          {/* Bio */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
              {t("profile.aboutMe")}
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none resize-none h-24 focus:border-primary transition-colors duration-150"
              placeholder={t("profile.aboutMePlaceholder")}
              maxLength={500}
            />
            <p className="text-[11px] text-text-muted mt-1 text-right">{bio.length}/500</p>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
              {t("profile.location")}
            </label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t("profile.locationPlaceholder")}
              maxLength={100}
            />
          </div>

          {/* Website */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
              {t("profile.website")}
            </label>
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              prefix={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              }
            />
          </div>

          {/* Error */}
          {error && <p className="text-sm text-danger">{error}</p>}

          {/* Save */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {saved && (
              <span className="text-sm text-live font-medium animate-in fade-in duration-150">
                {t("profile.changesSaved")}
              </span>
            )}
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={!hasChanges}
              variant={saved ? "success" : "primary"}
            >
              {saved ? t("common:saved") : t("common:saveChanges")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
