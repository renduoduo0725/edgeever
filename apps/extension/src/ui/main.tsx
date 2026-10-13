import { createRoot } from "react-dom/client";
import { localizeDocument, t } from "../i18n";
import { Options } from "./options";
import { Popup } from "./popup";
import { Permission, type PermissionPage } from "./permission";
import "./theme.css";

const page = location.pathname.split("/").pop()?.replace(/\.html$/, "") ?? "popup";
const titles: Record<string, string> = { options: "optionsTitle", popup: "actionTitle", "image-save": "imageSaveWindowTitle", "tweet-save": "tweetSaveWindowTitle", "xhs-save": "xhsSaveWindowTitle", "zhihu-save": "zhihuSaveWindowTitle" };
localizeDocument();
document.title = t(titles[page] ?? "actionTitle");
const root = document.getElementById("root");
if (!root) throw new Error("Missing extension UI root");
createRoot(root).render(page === "options" ? <Options /> : page in titles && page !== "popup" ? <Permission page={page as PermissionPage} /> : <Popup />);
