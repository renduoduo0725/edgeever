import type { MemoListDensity } from "@/lib/app-helpers";

export const MEMO_LIST_VIRTUAL_OVERSCAN = 10;
export const MEMO_LIST_MOBILE_ITEM_GAP_PX = 12;

/** Initial row height before measureElement. Matches MemoCard min-heights. */
export const estimateMemoListItemSize = (density: MemoListDensity, isDesktop: boolean) => {
  if (density === "compact") {
    return isDesktop ? 80 : 96;
  }

  return isDesktop ? 140 : 148;
};
