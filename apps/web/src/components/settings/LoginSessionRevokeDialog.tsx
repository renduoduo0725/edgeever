import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type LoginSessionRevokeTarget =
  | { type: "session"; sessionId: string }
  | { type: "others" };

interface LoginSessionRevokeDialogProps {
  target: LoginSessionRevokeTarget | null;
  isPending: boolean;
  isError: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export const LoginSessionRevokeDialog = ({
  target,
  isPending,
  isError,
  onOpenChange,
  onConfirm,
}: LoginSessionRevokeDialogProps) => {
  const { t } = useTranslation();
  const revokeOthers = target?.type === "others";

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t(revokeOthers ? "loginDevices.revokeOthersTitle" : "loginDevices.revokeDeviceTitle")}
          </DialogTitle>
          <DialogDescription>
            {t(revokeOthers ? "loginDevices.revokeOthersDescription" : "loginDevices.revokeDeviceDescription")}
          </DialogDescription>
        </DialogHeader>
        {isError ? <p className="text-xs font-medium leading-5 text-rose-600" role="alert">{t("loginDevices.revokeFailed")}</p> : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>{t("common.cancel")}</Button>
          </DialogClose>
          <Button variant="danger" disabled={isPending} onClick={onConfirm}>
            {isPending ? t("loginDevices.revoking") : t("loginDevices.revokeConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
