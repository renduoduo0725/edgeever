import { memo, useState } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { POSTER_GALLERY_TEMPLATES, posterGalleryTemplatesFor } from "@/lib/poster-template-previews";

type Template = (typeof POSTER_GALLERY_TEMPLATES)[number];
const Preview = memo(function Preview({
  template, zh, selected, onSelect, disabled,
}: {
  template: Template;
  zh: boolean;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  const url = zh ? template.thumbnails.zh : template.thumbnails.en;
  return (
    <button
      disabled={disabled}
      data-poster-template={template.id}
      aria-label={zh ? template.zh : template.en}
      aria-pressed={selected}
      onClick={onSelect}
      className={`group overflow-hidden rounded-lg border p-1.5 text-left transition disabled:opacity-50 ${selected ? "border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500" : "border-slate-200/80 bg-card hover:border-emerald-400"}`}
    >
      <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded bg-slate-100">
        <img
          src={url}
          alt={zh ? template.zh : template.en}
          width={480}
          height={640}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
        />
      </div>
      <div className="mt-2 truncate px-1 text-[11px] font-medium">
        {zh ? template.zh : template.en}
      </div>
    </button>
  );
});
export function PosterTemplatePanel({
  platformId,
  templateId,
  zh,
  disabled,
  onApply,
}: {
  platformId?: string;
  templateId?: string;
  zh: boolean;
  disabled: boolean;
  onApply: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState(""),
    [recommended, setRecommended] = useState(true);
  const templates = (
    recommended ? posterGalleryTemplatesFor(platformId) : POSTER_GALLERY_TEMPLATES
  ).filter((template) =>
    `${template.zh} ${template.en} ${template.zhUse} ${template.enUse}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-4 p-3">
      <div className="sticky -top-0.5 z-10 space-y-2 bg-card py-1">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold">
            {t("poster.templates")}{" "}
            <span className="font-normal text-slate-400">
              {templates.length}
            </span>
          </h3>
          <button
            className="text-[11px] text-emerald-600"
            onClick={() => setRecommended(!recommended)}
          >
            {t(
              recommended
                ? "poster.design.allTemplates"
                : "poster.design.recommended",
            )}
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            className="h-8 pl-8 text-xs"
            value={search}
            aria-label={t("poster.design.searchTemplates")}
            placeholder={t("poster.design.searchTemplates")}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {templates.map((template) => (
          <Preview
            key={template.id}
            template={template}
            zh={zh}
            selected={template.id === templateId}
            onSelect={() => onApply(template.id)}
            disabled={disabled}
          />
        ))}
      </div>
      <p className="text-[10px] leading-relaxed text-slate-400">
        {t("poster.design.templateCredit")}
      </p>
    </div>
  );
}
