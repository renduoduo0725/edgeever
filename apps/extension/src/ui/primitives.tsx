import type { ComponentProps } from "react";
import { CheckCircle2, LoaderCircle, CircleAlert } from "lucide-react";
import { Button as SharedButton } from "../../../web/src/components/ui/button";
export { Input } from "../../../web/src/components/ui/input";

export function Button({ variant = "soft", className = "", ...props }: ComponentProps<typeof SharedButton>) {
  const styles = variant === "soft" || variant === "solid"
    ? "border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900"
    : "border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900";
  return <SharedButton variant={variant === "solid" ? "soft" : variant} className={`${styles} ${className}`} {...props} />;
}

export type Feedback = { message: string; kind?: "normal" | "success" | "error" };
export function Status({ message, kind = "normal", busy = false, id = "status" }: Feedback & { busy?: boolean; id?: string }) {
  const Icon = busy ? LoaderCircle : kind === "success" ? CheckCircle2 : kind === "error" ? CircleAlert : null;
  return <p id={id} role="status" aria-atomic="true" data-kind={kind} className={`flex items-start gap-2 text-xs leading-5 ${message ? "mt-3" : ""} ${kind === "error" ? "text-red-700" : "text-neutral-600"}`}>
    {message && Icon && <Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${busy ? "animate-spin motion-reduce:animate-none" : ""}`} />}{message}
  </p>;
}
