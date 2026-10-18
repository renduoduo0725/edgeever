import { ChevronDown, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/**
 * Scannable share link for opening a share on another device. Callers render it
 * only for links without a password, so the code never stands in for one.
 */
export const ShareQrCode = ({ url, hint }: { url: string; hint: string }) => {
  const { t } = useTranslation();

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="group -ml-2.5">
          <QrCode className="h-4 w-4" aria-hidden="true" />
          {t("sharing.qrCode")}
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <figure className="flex flex-col items-center gap-2">
          {/* Keep dark modules on white in every theme so phone cameras can read the code. */}
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <QRCodeSVG
              value={url}
              size={176}
              level="M"
              marginSize={0}
              bgColor="#ffffff"
              fgColor="#000000"
              role="img"
              aria-label={t("sharing.qrCodeLabel")}
            />
          </div>
          <figcaption className="text-center text-xs leading-5 text-muted-foreground">{hint}</figcaption>
        </figure>
      </CollapsibleContent>
    </Collapsible>
  );
};
