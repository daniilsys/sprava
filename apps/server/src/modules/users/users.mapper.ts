// ─── Input types (duck-typed — work with any object that has these fields) ───

type UserSummaryInput = {
  id: string;
  username: string;
  avatar: string | null;
};

type ProfileInput = {
  bio: string | null;
  location: string | null;
  website: string | null;
};

type SettingsInput = {
  theme: string;
  language: string;
  showLocation: string;
  showActivity: string;
  showStatus: string;
  showEmail: string;
  showWebsite: string;
  dmPrivacy: string;
};

type UserFullInput = UserSummaryInput & {
  email: string;
  verified: boolean;
  createdAt: Date;
  profile?: ProfileInput | null;
  settings?: SettingsInput | null;
};

// ─── Mappers ─────────────────────────────────────────────────────────────────

/** Minimal user shape — used in message author fields, search results, etc. */
export function toUserSummary(user: UserSummaryInput) {
  return {
    id: user.id,
    username: user.username,
    avatar: user.avatar,
  };
}

/** Stripped profile — removes internal DB fields (userId, createdAt, updatedAt). */
export function toProfileResponse(profile: ProfileInput) {
  return {
    bio: profile.bio,
    location: profile.location,
    website: profile.website,
  };
}

/** Stripped settings — removes userId, createdAt, updatedAt. */
export function toSettingsResponse(settings: SettingsInput) {
  return {
    theme: settings.theme,
    language: settings.language,
    showLocation: settings.showLocation,
    showActivity: settings.showActivity,
    showStatus: settings.showStatus,
    showEmail: settings.showEmail,
    showWebsite: settings.showWebsite,
    dmPrivacy: settings.dmPrivacy,
  };
}

/** Full user — used for /me and public profiles. */
export function toUserResponse(user: UserFullInput) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    verified: user.verified,
    createdAt: user.createdAt,
    profile: user.profile ? toProfileResponse(user.profile) : null,
    settings: user.settings ? toSettingsResponse(user.settings) : null,
  };
}

// ─── Exported types ───────────────────────────────────────────────────────────

export type UserSummary = ReturnType<typeof toUserSummary>;
export type ProfileResponse = ReturnType<typeof toProfileResponse>;
export type SettingsResponse = ReturnType<typeof toSettingsResponse>;
export type UserResponse = ReturnType<typeof toUserResponse>;
