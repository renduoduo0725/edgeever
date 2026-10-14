import { Copy, ExternalLink, Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  onCopy?: () => void;
  copyLabel?: string;
  onOpen: () => void;
  onManage: () => void;
};

export const ShareManagementActions = ({ onCopy, copyLabel, onOpen, onManage }: Props) => {
  const { t } = useTranslation();
  const copyText = copyLabel ?? t("sharing.copy");

  return (
    <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
      {onCopy ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" aria-label={copyText} onClick={onCopy}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{copyText}</TooltipContent>
        </Tooltip>
      ) : null}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" aria-label={t("sharing.open")} onClick={onOpen}>
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("sharing.open")}</TooltipContent>
      </Tooltip>
      <Button size="sm" variant="outline" className="ml-1" onClick={onManage}>
        <Settings2 className="h-3.5 w-3.5" />{t("sharing.manage")}
      </Button>
      <span className="sr-only" role="status">{copyLabel}</span>
    </div>
  );
};
