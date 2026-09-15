import { enUS, ja, zhCN } from "@edgeever/shared/i18n";
import { resolveSupportedLocale } from "@edgeever/shared/i18n/locales";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  readMobileLocalePreference,
  writeMobileLocalePreference,
  type MobileLocalePreference,
} from "./preferences";

type SupportedMobileLocale = "zh-CN" | "en-US" | "ja";
type MobileLocaleContextValue = {
  preference: MobileLocalePreference;
  resolvedLocale: SupportedMobileLocale;
  setPreference: (preference: MobileLocalePreference) => void;
  translate: (value: string) => string;
};

type TranslationPair = { source: string; target: string; pattern?: RegExp; placeholders?: string[] };

const mobileOnlyTranslations = new Map<string, string>([
  ["返回", "Back"],
  ["关闭对话框", "Close dialog"],
  ["切换到深色模式", "Switch to dark mode"],
  ["切换到浅色模式", "Switch to light mode"],
  ["完成编辑", "Finish editing"],
  ["完成新建笔记", "Finish creating note"],
  ["Markdown 源代码编辑", "Edit Markdown source"],
  ["资源", "Resources"],
  ["笔记列表操作", "Note list actions"],
  ["搜索", "Search"],
  ["搜索标题、正文或标签", "Search titles, content, or tags"],
  ["输入关键词开始搜索", "Enter a keyword to search"],
  ["搜索本机同步缓存，结果会即时显示", "Search the local synced cache with instant results"],
  ["笔记操作", "Note actions"],
  ["AI 笔记助手", "AI note assistant"],
  ["版本历史", "Version history"],
  ["分享笔记", "Share note"],
  ["复制笔记 ID", "Copy note ID"],
  ["同步后可复制笔记 ID", "Copy note ID after sync"],
  ["笔记 ID 已复制", "Note ID copied"],
  ["复制笔记 ID 失败", "Could not copy note ID"],
  ["分享失败", "Could not share"],
  ["无法创建分享链接，请检查网络后重试。", "Could not create a share link. Check your connection and try again."],
  ["同步冲突", "Sync conflict"],
  ["同步失败", "Sync failed"],
  ["待同步", "Pending sync"],
  ["已同步", "Synced"],
  ["立即同步", "Sync now"],
  ["查看同步状态并立即重试", "View sync status and retry now"],
  ["本地改动还在等待上传到云端。可立即重试同步。", "Local changes are waiting to upload. You can retry sync now."],
  ["本地改动未能上传到云端。可立即重试同步。", "Local changes could not upload. You can retry sync now."],
  ["本地改动未能上传到云端。内容仍保存在本机，可立即重试。", "Local changes could not upload. They remain on this device and you can retry now."],
  ["本地改动待上传。下拉刷新或点此可立即同步。", "Local changes are pending upload. Pull to refresh or tap to sync now."],
  ["查看并处理同步冲突", "Review and resolve the sync conflict"],
  ["云端笔记已在其他标签页、设备，或离线期间被更新，本地草稿无法直接覆盖。可先复制本地草稿，再采用云端版本后继续编辑。", "The cloud note was updated in another tab, on another device, or while you were offline. Copy your local draft, then use the cloud version before editing again."],
  ["云端笔记已在其他标签页、设备，或离线期间被更新。可先复制本地草稿，再采用云端版本后继续编辑。", "The cloud note was updated in another tab, on another device, or while you were offline. Copy your local draft, then use the cloud version before editing again."],
  ["查看历史", "View history"],
  ["使用云端版本", "Use cloud version"],
  ["采用云端并重新加载", "Use cloud and reload"],
  ["采用云端版本失败", "Could not use the cloud version"],
  ["复制本地草稿", "Copy local draft"],
  ["本地草稿已复制到剪贴板。", "Local draft copied to the clipboard."],
  ["没有可复制的本地草稿。", "There is no local draft to copy."],
  ["已复制", "Copied"],
  ["更多", "More"],
  ["加载失败", "Failed to load"],
  ["请稍后重试", "Please try again later"],
  ["重试", "Retry"],
  ["图片上传失败", "Image upload failed"],
  ["请检查网络连接后重试", "Check your connection and try again"],
  ["添加图片或附件", "Add image or attachment"],
  ["选择拍照、相册或设备文件", "Take a photo or choose from your library or device"],
  ["关闭图片来源选择", "Close image source picker"],
  ["拍照", "Take photo"],
  ["从相册选择", "Choose from library"],
  ["选择文件", "Choose file"],
  ["需要相机权限", "Camera access required"],
  ["允许 EdgeEver 使用相机后，才能直接拍照插入笔记。", "Allow EdgeEver to use the camera to take photos and insert them into notes."],
  ["相机权限已被关闭。请前往系统设置允许 EdgeEver 使用相机。", "Camera access is disabled. Open system settings and allow EdgeEver to use the camera."],
  ["前往设置", "Open settings"],
  ["系统未能恢复上次选择的图片，请重试", "The system could not restore the previously selected image. Please try again."],
  ["退出新建笔记？", "Exit the new note?"],
  ["内容已自动保存为本地草稿，下次新建时会继续恢复。", "The content is saved as a local draft and will be restored the next time you create a note."],
  ["继续编辑", "Keep editing"],
  ["放弃草稿", "Discard draft"],
  ["保留并退出", "Keep and exit"],
  ["丢弃本地变更？", "Discard local changes?"],
  ["此操作会移除这条待同步记录，不会修改服务端笔记。", "This removes the queued local change without modifying the server note."],
  ["丢弃", "Discard"],
  ["正在同步新笔记", "New note is syncing"],
  ["首次同步完成后即可上传本地图片；图片链接现在就可以直接粘贴到正文。", "Local images can be uploaded after the first sync. Image links can already be pasted into the note."],
  ["保存更改？", "Save changes?"],
  ["当前笔记有未保存修改。", "This note has unsaved changes."],
  ["放弃修改", "Discard changes"],
  ["无法打开资源", "Unable to open resource"],
  ["系统没有可用应用打开此链接。", "No installed app can open this link."],
  ["已删除笔记不能上传附件，请先恢复笔记", "Deleted notes cannot receive attachments. Restore the note first."],
  ["图片预览", "Image preview"],
  ["放大", "Zoom in"],
  ["缩小", "Zoom out"],
  ["上一张", "Previous image"],
  ["下一张", "Next image"],
  ["打开原文件", "Open original file"],
  ["密码已更新", "Password updated"],
  ["下次登录请使用新密码。", "Use the new password the next time you sign in."],
  ["编辑笔记", "Edit note"],
  ["所在笔记本", "Notebook"],
  ["笔记标题", "Note title"],
  ["笔记标签", "Note tags"],
  ["选择笔记本", "Choose notebook"],
  ["点选已有标签，或输入名称创建新标签", "Select existing tags or enter a name to create a new one"],
  ["按标签筛选", "Filter by tag"],
  ["选择一个标签，只查看带有该标签的笔记", "Choose a tag to view only notes with that tag"],
  ["搜索标签", "Search tags"],
  ["没有匹配的标签", "No matching tags"],
  ["搜索或输入新标签", "Search or enter a new tag"],
  ["没有匹配的现有标签，可直接新建", "No matching tags. You can create a new one."],
  ["新建", "Create"],
  ["{{count}} 条笔记", "{{count}} notes"],
  ["刷新 Token", "Refresh tokens"],
  ["Token 名称", "Token name"],
  ["没有正文预览", "No content preview"],
  ["原生运行时启动", "Native runtime startup"],
  ["启动至 JS 执行", "Launch to JavaScript execution"],
  ["启动至会话/缓存就绪", "Launch to session/cache ready"],
  ["启动至工作区首帧", "Launch to workspace first frame"],
  ["启动至列表数据就绪", "Launch to list data ready"],
  ["启动至交互空闲", "Launch to interaction idle"],
  ["最近一次本地编辑器启动", "Latest local editor startup"],
  ["正在启动编辑器", "Starting editor"],
  ["编辑器启动时间过长", "The editor is taking too long to start"],
  ["正在准备本地编辑器，笔记内容是安全的。", "Preparing the local editor. Your note is safe."],
  ["本地编辑器未能及时启动，可以重试或返回，当前草稿不会丢失。", "The local editor did not start in time. You can retry or go back; your current draft will not be lost."],
  ["暂不可用", "Unavailable"],
  ["尚未记录", "Not recorded"],
  ["正在搜索", "Searching"],
  ["退出搜索", "Exit search"],
  ["重置", "Reset"],
  ["置顶", "Pinned"],
  ["有标签", "Tagged"],
  ["无标签", "Untagged"],
  ["正在同步笔记", "Syncing your notes"],
  ["正在准备首次同步…", "Preparing your notes for the first sync…"],
  ["正在加载笔记", "Loading notes"],
  ["正在加载笔记本和笔记…", "Loading notebooks and notes…"],
  ["同步已暂停", "Sync paused"],
  ["已加载的笔记仍可使用，请检查网络后重试。", "Loaded notes remain available. Check your connection and retry."],
  ["已选择 {{count}} 条", "{{count}} selected"],
  ["{{count}} 条结果", "Results: {{count}}"],
  ["筛选：{{filter}} · {{count}} 条", "Filter: {{filter}} · {{count}} notes"],
  ["已加载 {{loaded}} / {{total}} 条笔记", "Loaded {{loaded}} of {{total}} notes"],
  ["从模板新建", "New from template"],
  ["模板", "Templates"],
  ["选择一个模板快速开始。所有模板都可以在网页端修改或删除。", "Choose a template to get started. Every template can be edited or deleted on the web."],
  ["模板暂时无法加载，请稍后重试。", "Templates could not load. Please try again later."],
  ["暂无模板。可在网页端新建模板，或将常用笔记另存为模板。", "No templates yet. Create one or save a note as a template on the web."],
  ["正在加载模板", "Loading templates"],
  ["新建笔记", "New note"],
  ["选择创建方式", "Choose how to create"],
  ["空白笔记", "Blank note"],
  ["从空白页开始记录", "Start with an empty page"],
  ["使用会议纪要、周报等预设结构", "Use meeting notes, weekly reviews, and more"],
  ["模板", "Template"],
  ["应用模板？", "Apply template?"],
  ["当前内容将被模板内容替换。", "The current content will be replaced by the template."],
  ["替换", "Replace"],
  ["关闭", "Close"],
]);

const mobileOnlyJapanese = new Map<string, string>([
  ["返回", "戻る"],
  ["关闭对话框", "ダイアログを閉じる"],
  ["切换到深色模式", "ダークモードに切り替え"],
  ["切换到浅色模式", "ライトモードに切り替え"],
  ["完成编辑", "編集を終える"],
  ["完成新建笔记", "ノート作成を終える"],
  ["Markdown 源代码编辑", "Markdown ソースを編集"],
  ["资源", "リソース"],
  ["笔记列表操作", "ノート一覧の操作"],
  ["搜索", "検索"],
  ["搜索标题、正文或标签", "タイトル、本文、タグを検索"],
  ["输入关键词开始搜索", "キーワードを入力して検索"],
  ["搜索本机同步缓存，结果会即时显示", "端末内の同期キャッシュを検索し、結果をすぐ表示します"],
  ["笔记操作", "ノート操作"],
  ["AI 笔记助手", "AI ノートアシスタント"],
  ["版本历史", "版履歴"],
  ["分享笔记", "ノートを共有"],
  ["复制笔记 ID", "ノート ID をコピー"],
  ["同步后可复制笔记 ID", "同期後にノート ID をコピー"],
  ["笔记 ID 已复制", "ノート ID をコピーしました"],
  ["复制笔记 ID 失败", "ノート ID をコピーできませんでした"],
  ["分享失败", "共有できませんでした"],
  ["无法创建分享链接，请检查网络后重试。", "共有リンクを作成できませんでした。接続を確認して再試行してください。"],
  ["同步冲突", "同期の競合"],
  ["同步失败", "同期に失敗しました"],
  ["待同步", "同期待ち"],
  ["已同步", "同期済み"],
  ["立即同步", "今すぐ同期"],
  ["查看同步状态并立即重试", "同期状態を見て今すぐ再試行"],
  ["本地改动还在等待上传到云端。可立即重试同步。", "ローカルの変更はまだアップロード待ちです。今すぐ同期を再試行できます。"],
  ["本地改动未能上传到云端。可立即重试同步。", "ローカルの変更をアップロードできませんでした。今すぐ同期を再試行できます。"],
  ["本地改动未能上传到云端。内容仍保存在本机，可立即重试。", "ローカルの変更をアップロードできませんでした。内容は端末に残っており、今すぐ再試行できます。"],
  ["本地改动待上传。下拉刷新或点此可立即同步。", "ローカルの変更はアップロード待ちです。下に引くか、ここをタップして今すぐ同期できます。"],
  ["查看并处理同步冲突", "同期の競合を確認して解消"],
  ["云端笔记已在其他标签页、设备，或离线期间被更新，本地草稿无法直接覆盖。可先复制本地草稿，再采用云端版本后继续编辑。", "クラウド上のノートが他のタブ、他の端末、またはオフライン中に更新されたため、ローカル下書きで上書きできません。先に下書きをコピーし、クラウド版を採用してから編集を続けてください。"],
  ["云端笔记已在其他标签页、设备，或离线期间被更新。可先复制本地草稿，再采用云端版本后继续编辑。", "クラウド上のノートが他のタブ、他の端末、またはオフライン中に更新されました。先に下書きをコピーし、クラウド版を採用してから編集を続けてください。"],
  ["查看历史", "履歴を見る"],
  ["使用云端版本", "クラウド版を使う"],
  ["采用云端并重新加载", "クラウド版を使って再読み込み"],
  ["采用云端版本失败", "クラウド版を使えませんでした"],
  ["复制本地草稿", "ローカル下書きをコピー"],
  ["本地草稿已复制到剪贴板。", "ローカル下書きをクリップボードにコピーしました。"],
  ["没有可复制的本地草稿。", "コピーできるローカル下書きはありません。"],
  ["已复制", "コピーしました"],
  ["更多", "その他"],
  ["加载失败", "読み込めませんでした"],
  ["请稍后重试", "しばらくしてから再試行してください"],
  ["重试", "再試行"],
  ["图片上传失败", "画像のアップロードに失敗しました"],
  ["请检查网络连接后重试", "接続を確認して再試行してください"],
  ["添加图片或附件", "画像または添付を追加"],
  ["选择拍照、相册或设备文件", "撮影、ライブラリ、またはファイルから選ぶ"],
  ["关闭图片来源选择", "画像ソースの選択を閉じる"],
  ["拍照", "写真を撮る"],
  ["从相册选择", "ライブラリから選ぶ"],
  ["选择文件", "ファイルを選ぶ"],
  ["需要相机权限", "カメラの許可が必要です"],
  ["允许 EdgeEver 使用相机后，才能直接拍照插入笔记。", "カメラで撮影してノートに入れるには、EdgeEver のカメラ使用を許可してください。"],
  ["相机权限已被关闭。请前往系统设置允许 EdgeEver 使用相机。", "カメラの許可がオフです。システム設定で EdgeEver のカメラ使用を許可してください。"],
  ["前往设置", "設定を開く"],
  ["系统未能恢复上次选择的图片，请重试", "前回選んだ画像をシステムが復元できませんでした。再試行してください。"],
  ["退出新建笔记？", "新しいノートを閉じますか？"],
  ["内容已自动保存为本地草稿，下次新建时会继续恢复。", "内容はローカル下書きとして保存済みで、次に新規作成するときに復元されます。"],
  ["继续编辑", "編集を続ける"],
  ["放弃草稿", "下書きを捨てる"],
  ["保留并退出", "残して閉じる"],
  ["丢弃本地变更？", "ローカルの変更を捨てますか？"],
  ["此操作会移除这条待同步记录，不会修改服务端笔记。", "この操作は同期待ちの記録だけを消し、サーバー上のノートは変更しません。"],
  ["丢弃", "捨てる"],
  ["正在同步新笔记", "新しいノートを同期しています"],
  ["首次同步完成后即可上传本地图片；图片链接现在就可以直接粘贴到正文。", "初回同期のあとでローカル画像をアップロードできます。画像リンクは今すぐ本文に貼れます。"],
  ["保存更改？", "変更を保存しますか？"],
  ["当前笔记有未保存修改。", "このノートには未保存の変更があります。"],
  ["放弃修改", "変更を捨てる"],
  ["无法打开资源", "リソースを開けません"],
  ["系统没有可用应用打开此链接。", "このリンクを開けるアプリがありません。"],
  ["已删除笔记不能上传附件，请先恢复笔记", "削除済みノートには添付をアップロードできません。先に復元してください。"],
  ["图片预览", "画像プレビュー"],
  ["放大", "拡大"],
  ["缩小", "縮小"],
  ["上一张", "前の画像"],
  ["下一张", "次の画像"],
  ["打开原文件", "元のファイルを開く"],
  ["密码已更新", "パスワードを更新しました"],
  ["下次登录请使用新密码。", "次回のログインから新しいパスワードを使ってください。"],
  ["编辑笔记", "ノートを編集"],
  ["所在笔记本", "ノートブック"],
  ["笔记标题", "ノートのタイトル"],
  ["笔记标签", "ノートのタグ"],
  ["选择笔记本", "ノートブックを選ぶ"],
  ["点选已有标签，或输入名称创建新标签", "既存のタグを選ぶか、名前を入力して新規作成"],
  ["按标签筛选", "タグで絞り込み"],
  ["选择一个标签，只查看带有该标签的笔记", "タグを選ぶと、そのタグのノートだけを表示します"],
  ["搜索标签", "タグを検索"],
  ["没有匹配的标签", "一致するタグはありません"],
  ["搜索或输入新标签", "検索するか、新しいタグを入力"],
  ["没有匹配的现有标签，可直接新建", "一致する既存タグはありません。新規作成できます。"],
  ["新建", "作成"],
  ["{{count}} 条笔记", "{{count}} 件のノート"],
  ["刷新 Token", "トークンを更新"],
  ["Token 名称", "トークン名"],
  ["没有正文预览", "本文プレビューはありません"],
  ["原生运行时启动", "ネイティブ実行環境の起動"],
  ["启动至 JS 执行", "JS 実行までの起動"],
  ["启动至会话/缓存就绪", "セッション/キャッシュ準備までの起動"],
  ["启动至工作区首帧", "ワークスペース初回描画までの起動"],
  ["启动至列表数据就绪", "一覧データ準備までの起動"],
  ["启动至交互空闲", "操作可能になるまでの起動"],
  ["最近一次本地编辑器启动", "直近のローカルエディタ起動"],
  ["正在启动编辑器", "エディタを起動しています"],
  ["编辑器启动时间过长", "エディタの起動に時間がかかっています"],
  ["正在准备本地编辑器，笔记内容是安全的。", "ローカルエディタを準備しています。ノートの内容は失われません。"],
  ["本地编辑器未能及时启动，可以重试或返回，当前草稿不会丢失。", "ローカルエディタが時間内に起動しませんでした。再試行するか戻ってください。下書きは失われません。"],
  ["暂不可用", "利用できません"],
  ["尚未记录", "未記録"],
  ["正在搜索", "検索中"],
  ["退出搜索", "検索を終了"],
  ["重置", "リセット"],
  ["置顶", "ピン留め"],
  ["有标签", "タグあり"],
  ["无标签", "タグなし"],
  ["正在同步笔记", "ノートを同期しています"],
  ["正在准备首次同步…", "初回同期を準備しています…"],
  ["正在加载笔记", "ノートを読み込んでいます"],
  ["正在加载笔记本和笔记…", "ノートブックとノートを読み込んでいます…"],
  ["同步已暂停", "同期を一時停止しました"],
  ["已加载的笔记仍可使用，请检查网络后重试。", "読み込み済みのノートは使えます。接続を確認して再試行してください。"],
  ["已选择 {{count}} 条", "{{count}} 件を選択"],
  ["{{count}} 条结果", "結果: {{count}} 件"],
  ["筛选：{{filter}} · {{count}} 条", "絞り込み: {{filter}} · {{count}} 件"],
  ["已加载 {{loaded}} / {{total}} 条笔记", "{{loaded}} / {{total}} 件のノートを読み込み済み"],
  ["从模板新建", "テンプレートから作成"],
  ["模板", "テンプレート"],
  ["选择一个模板快速开始。所有模板都可以在网页端修改或删除。", "テンプレートを選んで始めます。テンプレートの編集と削除はウェブからできます。"],
  ["模板暂时无法加载，请稍后重试。", "テンプレートを読み込めませんでした。しばらくしてから再試行してください。"],
  ["暂无模板。可在网页端新建模板，或将常用笔记另存为模板。", "テンプレートはまだありません。ウェブで作成するか、よく使うノートをテンプレートとして保存できます。"],
  ["正在加载模板", "テンプレートを読み込んでいます"],
  ["新建笔记", "新しいノート"],
  ["选择创建方式", "作成方法を選ぶ"],
  ["空白笔记", "空白のノート"],
  ["从空白页开始记录", "空白のページから書き始める"],
  ["使用会议纪要、周报等预设结构", "会議メモや週報などの型を使う"],
  ["应用模板？", "テンプレートを適用しますか？"],
  ["当前内容将被模板内容替换。", "現在の内容はテンプレートの内容に置き換わります。"],
  ["替换", "置き換え"],
  ["关闭", "閉じる"],
]);

const flattenStrings = (value: unknown, prefix = "", output = new Map<string, string>()) => {
  if (typeof value === "string") {
    output.set(prefix, value);
    return output;
  }
  if (!value || typeof value !== "object") {
    return output;
  }
  for (const [key, child] of Object.entries(value)) {
    flattenStrings(child, prefix ? `${prefix}.${key}` : key, output);
  }
  return output;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const createTranslationPair = (source: string, target: string): TranslationPair => {
  const placeholders: string[] = [];
  const patternSource = escapeRegExp(source).replace(/\\\{\\\{(\w+)\\\}\\\}/g, (_match, placeholder: string) => {
    placeholders.push(placeholder);
    return "(.+?)";
  });
  return {
    source,
    target,
    pattern: placeholders.length > 0 ? new RegExp(`^${patternSource}$`) : undefined,
    placeholders,
  };
};
const zhStrings = flattenStrings(zhCN);
const enStrings = flattenStrings(enUS);
const jaStrings = flattenStrings(ja);

const buildTranslationPairs = (targets: Map<string, string>) =>
  Array.from(zhStrings.entries()).flatMap(([key, source]) => {
    const target = targets.get(key);
    if (!target || source === target) {
      return [];
    }
    return [createTranslationPair(source, target)];
  });

const enTranslationPairs = buildTranslationPairs(enStrings);
const jaTranslationPairs = buildTranslationPairs(jaStrings);
const exactEnglishTranslations = new Map(
  enTranslationPairs.filter((pair) => !pair.pattern).map((pair) => [pair.source, pair.target]),
);
const exactJapaneseTranslations = new Map(
  jaTranslationPairs.filter((pair) => !pair.pattern).map((pair) => [pair.source, pair.target]),
);
const mobileTemplateTranslations: TranslationPair[] = Array.from(mobileOnlyTranslations.entries())
  .filter(([source]) => source.includes("{{"))
  .map(([source, target]) => createTranslationPair(source, target));
const mobileJapaneseTemplateTranslations: TranslationPair[] = Array.from(mobileOnlyJapanese.entries())
  .filter(([source]) => source.includes("{{"))
  .map(([source, target]) => createTranslationPair(source, target));
const englishTemplateTranslations = [
  ...mobileTemplateTranslations,
  ...enTranslationPairs.filter((pair) => pair.pattern),
].sort((left, right) => right.source.length - left.source.length);
const japaneseTemplateTranslations = [
  ...mobileJapaneseTemplateTranslations,
  ...jaTranslationPairs.filter((pair) => pair.pattern),
].sort((left, right) => right.source.length - left.source.length);

const resolveSystemLocale = (): SupportedMobileLocale =>
  resolveSupportedLocale(Intl.DateTimeFormat().resolvedOptions().locale);

const applyTemplateTranslations = (value: string, pairs: TranslationPair[]) => {
  for (const pair of pairs) {
    const match = pair.pattern?.exec(value);
    if (!match) {
      continue;
    }
    return (pair.placeholders ?? []).reduce(
      (translated, placeholder, index) => translated.replace(`{{${placeholder}}}`, match[index + 1] ?? ""),
      pair.target,
    );
  }
  return null;
};

export const translateMobileText = (value: string, locale: SupportedMobileLocale) => {
  if (locale === "zh-CN" || !/[\u3400-\u9fff]/.test(value)) {
    return value;
  }
  if (locale === "ja") {
    const exact = mobileOnlyJapanese.get(value) ?? exactJapaneseTranslations.get(value);
    if (exact) return exact;
    return applyTemplateTranslations(value, japaneseTemplateTranslations) ?? value;
  }
  const exact = mobileOnlyTranslations.get(value) ?? exactEnglishTranslations.get(value);
  if (exact) {
    return exact;
  }
  return applyTemplateTranslations(value, englishTemplateTranslations) ?? value;
};

let currentResolvedMobileLocale: SupportedMobileLocale = resolveSystemLocale();
export const translateCurrentMobileText = (value: string) => translateMobileText(value, currentResolvedMobileLocale);

const MobileLocaleContext = createContext<MobileLocaleContextValue>({
  preference: "system",
  resolvedLocale: resolveSystemLocale(),
  setPreference: () => undefined,
  translate: (value) => value,
});

export const MobileLocaleProvider = ({ children }: { children: ReactNode }) => {
  const [preference, setPreferenceState] = useState<MobileLocalePreference>("system");

  useEffect(() => {
    let active = true;
    void readMobileLocalePreference().then((storedPreference) => {
      if (active) {
        setPreferenceState(storedPreference);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const resolvedLocale = preference === "system" ? resolveSystemLocale() : preference;
  currentResolvedMobileLocale = resolvedLocale;
  const value = useMemo<MobileLocaleContextValue>(
    () => ({
      preference,
      resolvedLocale,
      setPreference: (nextPreference) => {
        setPreferenceState(nextPreference);
        void writeMobileLocalePreference(nextPreference);
      },
      translate: (text) => translateMobileText(text, resolvedLocale),
    }),
    [preference, resolvedLocale]
  );

  return <MobileLocaleContext.Provider value={value}>{children}</MobileLocaleContext.Provider>;
};

export const useMobileLocale = () => useContext(MobileLocaleContext);
