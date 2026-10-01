const GITHUB_NEW_ISSUE_URL = "https://github.com/tianma-if/edgeever/issues/new";

export type GitHubFeedbackSystemInfoItem = {
  label: string;
  value: string;
};

export const buildGitHubFeedbackUrl = ({
  contentHeading,
  contentPrompt,
  diagnostics,
  privacyNotice,
  systemInfo,
  systemInfoHeading,
  systemInfoNotice,
  titlePrefix,
  client,
}: {
  contentHeading: string;
  contentPrompt: string;
  diagnostics?: {
    heading: string;
    notice: string;
    text: string;
  };
  privacyNotice: string;
  systemInfo: GitHubFeedbackSystemInfoItem[];
  systemInfoHeading: string;
  systemInfoNotice: string;
  titlePrefix: string;
  client?: string;
}) => {
  const systemInfoText = systemInfo.map((item) => `- ${item.label}: ${item.value}`).join("\n");
  const body = [
    `## ${contentHeading}`,
    "",
    `<!-- ${contentPrompt} -->`,
    "",
    ...(diagnostics ? [
      `## ${diagnostics.heading}`,
      "",
      `<!-- ${diagnostics.notice} -->`,
      "",
      "```json",
      diagnostics.text,
      "```",
      "",
    ] : []),
    `## ${systemInfoHeading}`,
    "",
    `<!-- ${systemInfoNotice} -->`,
    systemInfoText,
    "",
    `> ${privacyNotice}`,
  ].join("\n");
  const params = new URLSearchParams({
    title: titlePrefix,
    body,
    "system-info": systemInfoText,
  });
  if (diagnostics) {
    params.set("template", "bug.yml");
    params.set("diagnostics", diagnostics.text);
  }
  if (client) params.set("client", client);
  return `${GITHUB_NEW_ISSUE_URL}?${params.toString()}`;
};
