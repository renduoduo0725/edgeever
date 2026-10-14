import { KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { InstanceUser, ResourceStorageSummary } from "@edgeever/shared";
import { Button } from "@/components/ui/button";
import { ButtonTooltip } from "@/components/ui/button-tooltip";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBytes } from "@/lib/format-bytes";

type UserManagementTableProps = {
  users: InstanceUser[];
  storageByUser: Map<string, ResourceStorageSummary>;
  demoMode: boolean;
  updating: boolean;
  locale: string;
  onResetPassword: (user: InstanceUser) => void;
  onDisabledChange: (userId: string, isDisabled: boolean) => void;
};

export const UserManagementTable = ({ users, storageByUser, demoMode, updating, locale, onResetPassword, onDisabledChange }: UserManagementTableProps) => {
  const { t } = useTranslation();
  const dateFormatter = new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" });
  const accountClass = "md:sticky md:left-0 md:z-10 md:bg-card";
  const actionsClass = "w-14 min-w-14 max-w-14 px-2 text-center md:sticky md:right-0 md:z-10 md:bg-card";

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200">
      <Table aria-label={t("users.title")} className="min-w-[900px]">
        <TableHeader className="bg-slate-50/70">
          <TableRow>
            <TableHead scope="col" className={accountClass}>{t("users.columns.account")}</TableHead>
            <TableHead scope="col">{t("users.columns.role")}</TableHead>
            <TableHead scope="col" className="text-right">{t("users.columns.storage")}</TableHead>
            <TableHead scope="col" className="text-right">{t("users.columns.files")}</TableHead>
            <TableHead scope="col">{t("users.columns.status")}</TableHead>
            <TableHead scope="col">{t("users.columns.created")}</TableHead>
            <TableHead scope="col">{t("users.columns.login")}</TableHead>
            <TableHead scope="col" className={actionsClass}>{t("users.columns.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const storage = storageByUser.get(user.id);
            const resetLabel = t("users.resetTitle", { username: user.username });
            return (
              <TableRow key={user.id} className="[&>td]:whitespace-nowrap">
                <TableCell className={accountClass}>
                  <div className="min-w-32 max-w-48">
                    <p className="truncate font-medium text-slate-800">{user.displayName || user.username}</p>
                    <p className="mt-1 truncate text-slate-500">@{user.username}</p>
                  </div>
                </TableCell>
                <TableCell>{t(`users.roles.${user.role}`)}</TableCell>
                <TableCell className="text-right tabular-nums">{storage ? formatBytes(storage.totalBytes) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{storage ? storage.totalCount.toLocaleString(locale) : "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{user.isDisabled ? t("users.disabled") : t("users.enabled")}</span>
                    {user.role !== "owner" ? (
                      <Switch
                        aria-label={t("users.toggleAccount", { username: user.username })}
                        checked={!user.isDisabled}
                        disabled={updating}
                        onCheckedChange={(checked) => onDisabledChange(user.id, !checked)}
                      />
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>{dateFormatter.format(new Date(user.createdAt))}</TableCell>
                <TableCell>{user.lastLoginAt ? dateFormatter.format(new Date(user.lastLoginAt)) : t("users.noLoginRecord")}</TableCell>
                <TableCell className={actionsClass}>
                  {demoMode && user.role === "owner" ? "—" : (
                    <ButtonTooltip title={resetLabel}>
                      <Button size="icon-sm" variant="ghost" aria-label={resetLabel} onClick={() => onResetPassword(user)}>
                        <KeyRound aria-hidden="true" className="h-3.5 w-3.5" />
                      </Button>
                    </ButtonTooltip>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
