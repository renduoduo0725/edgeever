import { useCallback, useState } from "react";
import { combineFontLoadStatus, type FontLoadStatus } from "./font-load-state";

export const useFontPreviewStatus = (key: string, contentStatus: FontLoadStatus) => {
  const [preview, setPreview] = useState<{ key: string; status: FontLoadStatus }>({ key: "", status: "idle" });
  const onPreviewStatus = useCallback((status: FontLoadStatus) => {
    setPreview(current => current.key === key && current.status === status ? current : { key, status });
  }, [key]);
  return { onPreviewStatus, status: combineFontLoadStatus(contentStatus, preview.key === key ? preview.status : "loading") };
};
