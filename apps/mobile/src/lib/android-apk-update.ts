import type { MobileRelease } from "./mobile-release";

const APK_MIME_TYPE = "application/vnd.android.package-archive";
const ACTION_VIEW = "android.intent.action.VIEW";
const FLAG_GRANT_READ_URI_PERMISSION = 1;

export type AndroidApkDownloadProgress = {
  downloadedBytes: number;
  progress: number;
  totalBytes: number;
};

export const downloadAndInstallAndroidApk = async (
  release: MobileRelease,
  onProgress: (progress: AndroidApkDownloadProgress) => void,
  onDownloaded: () => void
) => {
  const [{ File, Paths }, LegacyFileSystem, IntentLauncher] = await Promise.all([
    import("expo-file-system"),
    import("expo-file-system/legacy"),
    import("expo-intent-launcher"),
  ]);
  const destination = new File(Paths.cache, release.fileName);

  try {
    const downloadedFile = await File.downloadFileAsync(release.downloadUrl, destination, {
      idempotent: true,
      onProgress: ({ bytesWritten, totalBytes }) => {
        const expectedBytes = totalBytes > 0 ? totalBytes : release.size;
        onProgress({
          downloadedBytes: bytesWritten,
          progress: expectedBytes > 0 ? Math.min(bytesWritten / expectedBytes, 1) : 0,
          totalBytes: expectedBytes,
        });
      },
    });

    if (downloadedFile.size !== release.size) {
      throw new Error(`Downloaded APK size mismatch: expected ${release.size}, received ${downloadedFile.size}`);
    }

    onProgress({ downloadedBytes: release.size, progress: 1, totalBytes: release.size });
    onDownloaded();
    const contentUri = await LegacyFileSystem.getContentUriAsync(downloadedFile.uri);
    await IntentLauncher.startActivityAsync(ACTION_VIEW, {
      data: contentUri,
      flags: FLAG_GRANT_READ_URI_PERMISSION,
      type: APK_MIME_TYPE,
    });
  } catch (error) {
    if (destination.exists) {
      destination.delete();
    }
    throw error;
  }
};
