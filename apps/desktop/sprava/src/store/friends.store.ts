import { create } from "zustand";
import { api } from "../lib/api";
import type { Friendship } from "../types/models";

interface FriendsState {
  friends: Friendship[];
  blocked: Friendship[];
  pendingIncoming: Friendship[];
  pendingSent: Friendship[];

  hydrate(friendships: Friendship[], currentUserId: string): void;
  addFriendship(friendship: Friendship, currentUserId: string): void;
  removeFriendshipById(friendshipId: string): void;
  updateFriendshipStatus(friendship: Friendship, currentUserId: string): void;
  sendRequest(username: string): Promise<void>;
  acceptRequest(userId: string): Promise<void>;
  rejectRequest(userId: string): Promise<void>;
  cancelRequest(userId: string): Promise<void>;
  removeFriend(userId: string): Promise<void>;
  blockUser(userId: string): Promise<void>;
  unblockUser(userId: string): Promise<void>;
  reload(): Promise<void>;
}

export const useFriendsStore = create<FriendsState>((set, get) => ({
  friends: [],
  blocked: [],
  pendingIncoming: [],
  pendingSent: [],

  hydrate(friendships, currentUserId) {
    const friends: Friendship[] = [];
    const blocked: Friendship[] = [];
    const pendingIncoming: Friendship[] = [];
    const pendingSent: Friendship[] = [];

    for (const f of friendships) {
      if (f.status === "ACCEPTED") friends.push(f);
      else if (f.status === "BLOCKED") blocked.push(f);
      else if (f.status === "PENDING") {
        if (f.sender.id === currentUserId) pendingSent.push(f);
        else pendingIncoming.push(f);
      }
    }

    set({ friends, blocked, pendingIncoming, pendingSent });
  },

  addFriendship(friendship, currentUserId) {
    set((s) => {
      if (friendship.status === "ACCEPTED") {
        return { friends: [...s.friends, friendship] };
      }
      if (friendship.status === "BLOCKED") {
        return { blocked: [...s.blocked, friendship] };
      }
      if (friendship.status === "PENDING") {
        if (friendship.sender.id === currentUserId) {
          return { pendingSent: [...s.pendingSent, friendship] };
        }
        return { pendingIncoming: [...s.pendingIncoming, friendship] };
      }
      return {};
    });
  },

  removeFriendshipById(friendshipId) {
    set((s) => ({
      friends: s.friends.filter((f) => f.id !== friendshipId),
      blocked: s.blocked.filter((f) => f.id !== friendshipId),
      pendingIncoming: s.pendingIncoming.filter((f) => f.id !== friendshipId),
      pendingSent: s.pendingSent.filter((f) => f.id !== friendshipId),
    }));
  },

  updateFriendshipStatus(friendship, currentUserId) {
    // Remove from all lists first, then re-add to the correct one
    set((s) => {
      const state = {
        friends: s.friends.filter((f) => f.id !== friendship.id),
        blocked: s.blocked.filter((f) => f.id !== friendship.id),
        pendingIncoming: s.pendingIncoming.filter((f) => f.id !== friendship.id),
        pendingSent: s.pendingSent.filter((f) => f.id !== friendship.id),
      };
      if (friendship.status === "ACCEPTED") state.friends.push(friendship);
      else if (friendship.status === "BLOCKED") state.blocked.push(friendship);
      else if (friendship.status === "PENDING") {
        if (friendship.sender.id === currentUserId) state.pendingSent.push(friendship);
        else state.pendingIncoming.push(friendship);
      }
      return state;
    });
  },

  async sendRequest(username) {
    await api.friendships.sendRequest(username);
    await get().reload();
  },

  async acceptRequest(userId) {
    await api.friendships.update({ status: "ACCEPTED", receiverId: userId });
    await get().reload();
  },

  async rejectRequest(userId) {
    await api.friendships.rejectRequest(userId);
    await get().reload();
  },

  async cancelRequest(userId) {
    await api.friendships.cancelRequest(userId);
    await get().reload();
  },

  async removeFriend(userId) {
    await api.friendships.remove(userId);
    await get().reload();
  },

  async blockUser(userId) {
    await api.friendships.update({ status: "BLOCKED", receiverId: userId });
    await get().reload();
  },

  async unblockUser(userId) {
    await api.friendships.unblock(userId);
    await get().reload();
  },

  async reload() {
    const [friends, blocked, incoming, sent] = await Promise.all([
      api.friendships.getFriends() as Promise<Friendship[]>,
      api.friendships.getBlocked() as Promise<Friendship[]>,
      api.friendships.getRequests() as Promise<Friendship[]>,
      api.friendships.getSentRequests() as Promise<Friendship[]>,
    ]);
    set({
      friends,
      blocked,
      pendingIncoming: incoming,
      pendingSent: sent,
    });
  },
}));
