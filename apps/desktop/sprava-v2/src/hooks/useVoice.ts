import { useCallback } from "react";
import { useVoiceStore } from "../store/voice.store";
import { useAuthStore } from "../store/auth.store";
import { joinVoice, leaveVoice, produceVideo, stopVideoProducer, getLocalVideoStream } from "../lib/voice";

export function useVoice() {
  const currentRoomId = useVoiceStore((s) => s.currentRoomId);
  const currentRoomType = useVoiceStore((s) => s.currentRoomType);
  const currentContextId = useVoiceStore((s) => s.currentContextId);
  const peers = useVoiceStore((s) => s.peers);
  const speaking = useVoiceStore((s) => s.speaking);
  const mutedPeers = useVoiceStore((s) => s.mutedPeers);
  const deafenedPeers = useVoiceStore((s) => s.deafenedPeers);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const isDeafened = useVoiceStore((s) => s.isDeafened);
  const joining = useVoiceStore((s) => s.joining);
  const screenShareProducerId = useVoiceStore((s) => s.screenShareProducerId);
  const cameraProducerId = useVoiceStore((s) => s.cameraProducerId);
  const videoStreams = useVoiceStore((s) => s.videoStreams);

  const join = useCallback(
    async (contextId: string, type: "channel" | "dm") => {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) throw new Error("Not authenticated");
      await joinVoice(contextId, type, userId).catch((err) => {
        throw err;
      });
    },
    [],
  );

  const leave = useCallback(async () => {
    await leaveVoice();
  }, []);

  const toggleMute = useCallback(() => {
    useVoiceStore.getState().toggleMute();
  }, []);

  const toggleDeafen = useCallback(() => {
    useVoiceStore.getState().toggleDeafen();
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const store = useVoiceStore.getState();
    if (store.screenShareProducerId) {
      stopVideoProducer("screen");
      store.setScreenShareProducerId(null);
      const userId = useAuthStore.getState().user?.id;
      if (userId) store.removeVideoStream(userId, "screen");
    } else {
      const producerId = await produceVideo("screen");
      if (producerId) {
        store.setScreenShareProducerId(producerId);
        const userId = useAuthStore.getState().user?.id;
        const localStream = getLocalVideoStream("screen");
        if (userId) store.addVideoStream(userId, "screen", localStream ?? undefined);
      }
    }
  }, []);

  const toggleCamera = useCallback(async () => {
    const store = useVoiceStore.getState();
    if (store.cameraProducerId) {
      stopVideoProducer("camera");
      store.setCameraProducerId(null);
      const userId = useAuthStore.getState().user?.id;
      if (userId) store.removeVideoStream(userId, "camera");
    } else {
      const producerId = await produceVideo("camera");
      if (producerId) {
        store.setCameraProducerId(producerId);
        const userId = useAuthStore.getState().user?.id;
        const localStream = getLocalVideoStream("camera");
        if (userId) store.addVideoStream(userId, "camera", localStream ?? undefined);
      }
    }
  }, []);

  return {
    currentRoomId,
    currentRoomType,
    currentContextId,
    peers,
    speaking,
    mutedPeers,
    deafenedPeers,
    isMuted,
    isDeafened,
    joining,
    screenShareProducerId,
    cameraProducerId,
    videoStreams,
    join,
    leave,
    toggleMute,
    toggleDeafen,
    toggleScreenShare,
    toggleCamera,
    isConnected: currentRoomId !== null,
    isScreenSharing: screenShareProducerId !== null,
    isCameraOn: cameraProducerId !== null,
  };
}
