import { useEffect, useRef, useState } from "react";
import type { AiDiscoveredModel } from "@edgeever/shared";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export function AiModelIdInput({ value, onValueChange, models, placeholder }: {
  value: string;
  onValueChange: (value: string) => void;
  models: AiDiscoveredModel[];
  placeholder: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const commandRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !commandRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);
  const customId = value.trim();
  const selectModel = (modelId: string) => {
    onValueChange(modelId);
    setOpen(false);
  };

  return (
    <Command
      ref={commandRef}
      label={placeholder}
      data-state={open ? "open" : "closed"}
      className="relative overflow-visible"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        } else if (event.key === "Enter") {
          if (!open) event.stopPropagation();
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          setOpen(true);
        }
      }}
    >
      <div className="relative rounded-md border border-slate-200 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/10 [&_[cmdk-input-wrapper]]:rounded-md [&_[cmdk-input-wrapper]]:border-0 [&_[cmdk-input-wrapper]>svg]:hidden">
        <CommandInput
          asChild
          ref={inputRef}
          value={value}
          onValueChange={(nextValue) => { onValueChange(nextValue); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="pr-9"
        >
          <input aria-expanded={open} />
        </CommandInput>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1"
          aria-label={placeholder}
          aria-expanded={open}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => { inputRef.current?.focus(); setOpen(true); }}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
      <CommandList
        hidden={!open}
        className="absolute top-full z-50 mt-1 max-h-60 w-full rounded-md border border-slate-200 bg-card shadow-md"
        onMouseDown={(event) => event.preventDefault()}
      >
        <CommandGroup>
          {models.map((model) => (
            <CommandItem className="text-xs" key={model.modelId} value={model.modelId} keywords={[model.displayName]} onSelect={selectModel}>
              <span className="min-w-0 break-all">{model.displayName}</span>
            </CommandItem>
          ))}
          {customId && !models.some((model) => model.modelId === customId) ? (
            <CommandItem className="text-xs" value={customId} onSelect={selectModel}><span className="break-all">{customId}</span></CommandItem>
          ) : null}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
