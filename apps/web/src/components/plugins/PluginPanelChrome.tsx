import type { PluginPanelAction, PluginPanelActionVariant, PluginPanelChrome, PluginPanelToolbarItem } from "@edgeever/plugin-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const actionVariant = (variant?: PluginPanelActionVariant): "outline" | "solid" | "ghost" => {
  if (variant === "primary") return "solid";
  if (variant === "ghost") return "ghost";
  return "outline";
};

const ActionButton = ({ action, onAction }: { action: PluginPanelAction; onAction?: (id: string) => void }) => (
  <Button
    type="button"
    size="sm"
    variant={actionVariant(action.variant)}
    disabled={action.disabled}
    onClick={() => onAction?.(action.id)}
  >
    {action.label}
  </Button>
);

const ToolbarItem = ({ item, onAction, onChange }: {
  item: PluginPanelToolbarItem;
  onAction?: (id: string) => void;
  onChange?: (key: string, value: string) => void;
}) => {
  if (item.type === "search") {
    return (
      <Input
        type="search"
        value={item.value ?? ""}
        placeholder={item.placeholder}
        aria-label={item.placeholder ?? item.key}
        className="h-9 min-w-[12rem] flex-1"
        onChange={(event) => onChange?.(item.key, event.target.value)}
      />
    );
  }
  if (item.type === "tabs") {
    return (
      <div className="flex flex-wrap gap-1" role="tablist">
        {item.options.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={item.value === option.value ? "solid" : "outline"}
            className="h-8 px-2.5 text-xs"
            aria-selected={item.value === option.value}
            onClick={() => onChange?.(item.key, option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    );
  }
  if (item.type === "select") {
    return (
      <label className="flex min-w-[9rem] items-center gap-2 text-xs text-slate-500">
        {item.label ? <span className="shrink-0">{item.label}</span> : null}
        <Select value={item.value} onValueChange={(value) => onChange?.(item.key, value)}>
          <SelectTrigger className="h-9 w-[9.5rem]" aria-label={item.label ?? item.key}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {item.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    );
  }
  return <ActionButton action={{ id: item.key, label: item.label, variant: item.variant, disabled: item.disabled }} onAction={onAction} />;
};

export const PluginPanelHeaderActions = ({ chrome }: { chrome: PluginPanelChrome }) => {
  const actions = chrome.header?.actions ?? [];
  if (!actions.length) return null;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {actions.map((action) => <ActionButton key={action.id} action={action} onAction={chrome.onAction} />)}
    </div>
  );
};

export const PluginPanelToolbar = ({ chrome }: { chrome: PluginPanelChrome }) => {
  if (!chrome.toolbar?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chrome.toolbar.map((item) => (
        <ToolbarItem key={`${item.type}:${item.key}`} item={item} onAction={chrome.onAction} onChange={chrome.onChange} />
      ))}
    </div>
  );
};

export const PluginPanelEmpty = ({ chrome }: { chrome: PluginPanelChrome }) => {
  if (!chrome.empty) return null;
  return (
    <div className="flex min-h-40 flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <p className="text-sm font-medium text-slate-800">{chrome.empty.title}</p>
      {chrome.empty.description ? <p className="max-w-md text-sm text-slate-500">{chrome.empty.description}</p> : null}
      {chrome.empty.action ? <ActionButton action={chrome.empty.action} onAction={chrome.onAction} /> : null}
    </div>
  );
};
