import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "./locales/en/common.json";
import enAuth from "./locales/en/auth.json";
import enChat from "./locales/en/chat.json";
import enServer from "./locales/en/server.json";
import enFriends from "./locales/en/friends.json";
import enDm from "./locales/en/dm.json";
import enVoice from "./locales/en/voice.json";
import enSettings from "./locales/en/settings.json";
import enErrors from "./locales/en/errors.json";

import frCommon from "./locales/fr/common.json";
import frAuth from "./locales/fr/auth.json";
import frChat from "./locales/fr/chat.json";
import frServer from "./locales/fr/server.json";
import frFriends from "./locales/fr/friends.json";
import frDm from "./locales/fr/dm.json";
import frVoice from "./locales/fr/voice.json";
import frSettings from "./locales/fr/settings.json";
import frErrors from "./locales/fr/errors.json";

const savedLang = localStorage.getItem("appLanguage") || "en";

i18next.use(initReactI18next).init({
  resources: {
    en: {
      common: enCommon,
      auth: enAuth,
      chat: enChat,
      server: enServer,
      friends: enFriends,
      dm: enDm,
      voice: enVoice,
      settings: enSettings,
      errors: enErrors,
    },
    fr: {
      common: frCommon,
      auth: frAuth,
      chat: frChat,
      server: frServer,
      friends: frFriends,
      dm: frDm,
      voice: frVoice,
      settings: frSettings,
      errors: frErrors,
    },
  },
  lng: savedLang,
  fallbackLng: "en",
  defaultNS: "common",
  interpolation: { escapeValue: false },
  initImmediate: false,
});

i18next.on("languageChanged", (lng) => localStorage.setItem("appLanguage", lng));

export default i18next;
