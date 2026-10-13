// Adapted from shadcn/ui's official new-york-v4 Sonner component (MIT):
// https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/sonner.tsx
// Extension pages provide their theme explicitly rather than using next-themes.
import type { CSSProperties } from "react";
import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

export const notificationDuration = { normal: 4000, success: 4000, error: 8000 } as const;

export function Toaster({
  theme = "light", position = "bottom-right", offset = 16, mobileOffset = 16,
  visibleToasts = 1, closeButton = true, hotkey = [], icons, style, toastOptions, ...props
}: ToasterProps) {
  return <Sonner
    theme={theme}
    position={position}
    offset={offset}
    mobileOffset={mobileOffset}
    visibleToasts={visibleToasts}
    closeButton={closeButton}
    hotkey={hotkey}
    className="toaster group"
    icons={{
      success: <CircleCheckIcon size={16} className="size-4 text-[var(--notification-success-icon)]" aria-hidden="true" />,
      info: <InfoIcon size={16} className="size-4" aria-hidden="true" />,
      warning: <TriangleAlertIcon size={16} className="size-4" aria-hidden="true" />,
      error: <OctagonXIcon size={16} className="size-4 text-[var(--notification-error-icon)]" aria-hidden="true" />,
      loading: <Loader2Icon size={16} className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />,
      ...icons,
    }}
    style={{
      "--normal-bg": "var(--popover)",
      "--normal-text": "var(--popover-foreground)",
      "--normal-border": "var(--border)",
      "--border-radius": "var(--radius)",
      ...style,
    } as CSSProperties}
    toastOptions={{ duration: notificationDuration.normal, ...toastOptions }}
    {...props}
  />;
}

export { toast } from "sonner";
