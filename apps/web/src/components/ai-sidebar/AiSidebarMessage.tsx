import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { memo } from "react";
import { Streamdown } from "streamdown";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";

const sidebarStreamdownPlugins = { cjk, code, mermaid, math };

export const AiSidebarMessage = memo(
  ({ className, ...props }: { children: string; className?: string; isAnimating?: boolean }) => (
    <Streamdown
      className={cn("size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}
      plugins={sidebarStreamdownPlugins}
      {...props}
    />
  ),
  (prev, next) => prev.children === next.children && prev.isAnimating === next.isAnimating,
);

AiSidebarMessage.displayName = "AiSidebarMessage";
