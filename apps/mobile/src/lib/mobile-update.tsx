import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Constants from "expo-constants";
import { AppState, Platform, type AppStateStatus } from "react-native";
import * as Updates from "expo-updates";
import { Alert } from "../components/LocalizedText";
import { useMobileLocale } from "./mobile-locale";
import { downloadAndInstallAndroidApk } from "./android-apk-update";
import { findNewerMobileRelease, type MobileRelease } from "./mobile-release";

const FOREGROUND_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

type MobileUpdateStatus = "idle" | "checking" | "available" | "downloading" | "ready" | "installing";
export type MobileUpdateKind = "install" | "ota";

type MobileUpdateContextValue = {
  checkForUpdate: () => Promise<void>;
  downloadProgress: number | null;
  hasUpdate: boolean;
  installedVersion: string | null;
  isSupported: boolean;
  openUpdate: () => Promise<void>;
  status: MobileUpdateStatus;
  updateKind: MobileUpdateKind | null;
};

const MobileUpdateContext = createContext<MobileUpdateContextValue>({
  checkForUpdate: async () => undefined,
  downloadProgress: null,
  hasUpdate: false,
  installedVersion: null,
  isSupported: false,
  openUpdate: async () => undefined,
  status: "idle",
  updateKind: null,
});

export const MobileUpdateProvider = ({ children }: { children: ReactNode }) => {
  const { resolvedLocale } = useMobileLocale();
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [installRelease, setInstallRelease] = useState<MobileRelease | null>(null);
  const [status, setStatus] = useState<MobileUpdateStatus>("idle");
  const [updateKind, setUpdateKind] = useState<MobileUpdateKind | null>(null);
  const activeCheckRef = useRef<Promise<void> | null>(null);
  const lastAutomaticCheckRef = useRef(0);
  const isSupported = !__DEV__ && Updates.isEnabled;
  const english = resolvedLocale === "en-US";
  const installedVersion = Updates.runtimeVersion ?? Constants.expoConfig?.version ?? null;

  const runCheck = useCallback((userInitiated: boolean) => {
    if (activeCheckRef.current) {
      return activeCheckRef.current;
    }

    if (!isSupported) {
      if (userInitiated) {
        Alert.alert(
          english ? "Updates unavailable" : "暂无法检查更新",
          english
            ? "Update checks are available in installed release builds, not Expo Go or development builds."
            : "检查更新仅适用于已安装的正式版，Expo Go 和开发版暂不支持。"
        );
      }
      return Promise.resolve();
    }

    const check = (async () => {
      try {
        setStatus("checking");

        if (Platform.OS === "android") {
          try {
            if (!installedVersion) {
              throw new Error("Installed app version is unavailable");
            }
            const release = await findNewerMobileRelease(installedVersion);
            if (release) {
              setInstallRelease(release);
              setUpdateKind("install");
              setStatus("available");
              return;
            }
          } catch {
            // Fall back to Expo's in-app update check when the release API is unavailable.
          }
        }

        const result = await Updates.checkForUpdateAsync();

        if (!result.isAvailable) {
          setInstallRelease(null);
          setUpdateKind(null);
          setStatus("idle");
          return;
        }

        setUpdateKind("ota");
        setStatus("available");
      } catch {
        setInstallRelease(null);
        setUpdateKind(null);
        setStatus("idle");
      }
    })();

    activeCheckRef.current = check;
    void check.finally(() => {
      activeCheckRef.current = null;
    });
    return check;
  }, [english, installedVersion, isSupported]);

  useEffect(() => {
    const attemptAutomaticCheck = () => {
      if (Date.now() - lastAutomaticCheckRef.current < FOREGROUND_CHECK_INTERVAL_MS) {
        return;
      }
      lastAutomaticCheckRef.current = Date.now();
      void runCheck(false);
    };
    const timer = setTimeout(attemptAutomaticCheck, 1_500);
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") {
        attemptAutomaticCheck();
      }
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [runCheck]);

  const openUpdate = useCallback(async () => {
    if (updateKind === "install") {
      if (Platform.OS !== "android" || !installRelease || status === "downloading" || status === "installing") {
        return;
      }
      const sizeMb = Math.max(1, Math.ceil(installRelease.size / 1024 / 1024));
      Alert.alert(
        english ? "Update available" : "发现新版本",
        english
          ? `EdgeEver ${installRelease.version} is available. Download ${sizeMb} MB and install it now?`
          : `EdgeEver ${installRelease.version} 已发布。是否立即下载 ${sizeMb} MB 安装包并更新？`,
        [
          {
            text: english ? "Cancel" : "取消",
            style: "cancel",
          },
          {
            text: english ? "Download & install" : "下载并安装",
            onPress: () => {
              setDownloadProgress(0);
              setStatus("downloading");
              void downloadAndInstallAndroidApk(
                installRelease,
                ({ progress }) => setDownloadProgress(progress),
                () => setStatus("installing")
              ).then(() => {
                setDownloadProgress(null);
                setStatus("available");
              }).catch(() => {
                setDownloadProgress(null);
                setStatus("available");
                Alert.alert(
                  english ? "Update failed" : "更新失败",
                  english
                    ? "Could not download or open the installer. Try again later."
                    : "无法下载安装包或打开系统安装器，请稍后重试。"
                );
              });
            },
          },
        ]
      );
      return;
    }

    if (updateKind !== "ota" || !isSupported) {
      return;
    }

    try {
      if (status === "ready") {
        await Updates.reloadAsync();
        return;
      }

      setStatus("downloading");
      const result = await Updates.fetchUpdateAsync();
      if (!result.isNew) {
        setUpdateKind(null);
        setStatus("idle");
        if (english) {
          Alert.alert("No update", "No downloadable in-app update was found.");
        } else {
          Alert.alert("暂无更新", "没有可下载的应用内更新。");
        }
        return;
      }

      setStatus("ready");
      Alert.alert(
        english ? "Update ready" : "更新已就绪",
        english ? "Restart now to apply the update." : "重启后即可应用更新。",
        [
          {
            text: english ? "Later" : "稍后",
            style: "cancel",
          },
          {
            text: english ? "Restart" : "立即重启",
            onPress: () => {
              void Updates.reloadAsync();
            },
          },
        ]
      );
    } catch {
      setStatus("available");
      Alert.alert(
        english ? "Update failed" : "更新失败",
        english
          ? "Could not download the in-app update. Try again later."
          : "无法下载应用内更新，请稍后再试。"
      );
    }
  }, [english, installRelease, isSupported, status, updateKind]);

  const value = useMemo<MobileUpdateContextValue>(
    () => ({
      checkForUpdate: () => {
        return runCheck(true);
      },
      downloadProgress,
      hasUpdate: status === "available" || status === "ready" || status === "downloading" || status === "installing",
      installedVersion,
      isSupported,
      openUpdate,
      status,
      updateKind,
    }),
    [downloadProgress, installedVersion, isSupported, openUpdate, runCheck, status, updateKind]
  );

  return <MobileUpdateContext.Provider value={value}>{children}</MobileUpdateContext.Provider>;
};

export const useMobileUpdate = () => useContext(MobileUpdateContext);
