export const deploymentPrompts = {
  "en-US": `Deploy EdgeEver entirely through GitHub and Cloudflare:
1. Fork https://github.com/tianma-if/edgeever.
2. Create D1 \`edgeever\` and R2 \`edgeever-resources\` in Cloudflare.
3. In Workers & Pages, create a Worker named \`edgeever\` from the Fork's \`main\` branch.
   Use the repository root, keep Cloudflare's default Workers Builds deploy command,
   and ensure its API token can read and edit D1. Select Save and Deploy.
4. After the Worker is created, add the user's chosen password as the runtime Secret
   \`EDGE_EVER_AUTH_PASSWORD\` (preferably at least 32 characters).
   The username defaults to \`admin\`.
   If the user specifies another, set \`EDGE_EVER_AUTH_USERNAME\` as a Workers Builds
   variable before the next build.
5. Run the build again, verify \`/api/health\` and \`/api/openapi.json\`, then log in
   with that administrator username and password.
6. Enable and manually run the GitHub Actions workflow named \`Update deployed EdgeEver\`
   once so the Fork can automatically receive future stable releases and fixes.`,
  "zh-CN": `请全程通过 GitHub 和 Cloudflare 在线部署 EdgeEver：
1. Fork https://github.com/tianma-if/edgeever。
2. 在 Cloudflare 中创建 D1 \`edgeever\` 与 R2 \`edgeever-resources\`。
3. 在 Workers & Pages 中从 Fork 的 \`main\` 分支创建名为 \`edgeever\` 的 Worker。
   使用仓库根目录，保留 Cloudflare Workers Builds 的默认部署命令，确认其 API Token
   具备 D1 读取和编辑权限，然后保存并部署。
4. Worker 创建后，设置运行时 Secret \`EDGE_EVER_AUTH_PASSWORD\`，值为用户指定的密码
   （建议至少 32 个字符）。管理员用户名默认为 \`admin\`；如需自定义，请在再次构建前
   设置 Workers Builds 构建变量 \`EDGE_EVER_AUTH_USERNAME\`。
5. 再次构建，验证 \`/api/health\` 和 \`/api/openapi.json\`，再用该管理员
   用户名和密码验证登录。
6. 启用并手动运行一次名为 \`Update deployed EdgeEver\` 的 GitHub Actions 工作流，
   以便后续自动同步正式版本，持续获得 EdgeEver 的功能更新和问题修复。`,
} as const;

export const manualDeploymentCopy = {
  "en-US": {
    intro: "Complete setup in 6 web steps:",
    steps: [
      {
        title: "Fork the Repository",
        body: "Click Fork at the top right of GitHub to fork EdgeEver into your personal account.",
      },
      {
        title: "Create Cloudflare Resources",
        body: "Create D1 edgeever and R2 edgeever-resources.",
      },
      {
        title: "Import & Configure the Project",
        body: "Create a Worker named edgeever from the Fork's main branch in Cloudflare Workers & Pages. Use the repository root and keep Cloudflare's default Workers Builds deploy command, which runs in Cloudflare. Ensure its API token can read and edit D1. The deploy command creates the bindings; do not edit Fork files.",
      },
      {
        title: "Choose the Administrator Password",
        body: "Choose an administrator password, preferably at least 32 characters. Once the Worker is created, save it as the runtime Secret EDGE_EVER_AUTH_PASSWORD.",
      },
      {
        title: "Build & Verify",
        body: "Save and Deploy creates the Worker and starts a build. If it fails because the administrator Secret is missing, add the runtime Secret from step 4 and retry. The username defaults to admin; to use another, set the EDGE_EVER_AUTH_USERNAME Workers Builds variable before retrying. Once deployed, confirm /api/health returns 200, then log in with the configured username and password.",
      },
      {
        title: "Enable Automatic Updates",
        body: "Open the Fork's Actions tab, click I understand my workflows, go ahead and enable them, then manually run Update deployed EdgeEver once so the Fork can automatically receive future stable releases and fixes.",
      },
    ],
  },
  "zh-CN": {
    intro: "仅需在网页端完成 6 步配置：",
    steps: [
      {
        title: "Fork 仓库",
        body: "在 GitHub 点击右上角 Fork，将项目 Fork 到您的个人账户下。",
      },
      {
        title: "创建 Cloudflare 资源",
        body: "创建 D1 edgeever 与 R2 edgeever-resources。",
      },
      {
        title: "导入并配置项目",
        body: "在 Cloudflare Workers & Pages 中从 Fork 的 main 分支创建名为 edgeever 的 Worker。使用仓库根目录，保留由 Cloudflare 在线执行的 Workers Builds 默认部署命令，并确认其 API Token 具备 D1 读取和编辑权限。binding 由部署命令生成，不要修改 Fork 中的文件。",
      },
      {
        title: "准备管理员密码",
        body: "准备管理员登录密码，建议至少 32 个字符。Worker 创建后，将它保存为运行时 Secret EDGE_EVER_AUTH_PASSWORD。",
      },
      {
        title: "首次构建与验证",
        body: "保存并部署会创建 Worker 并启动构建。如因缺少管理员 Secret 而失败，添加第 4 步的运行时 Secret 后重试。管理员用户名默认为 admin；如需使用其他用户名，请在重试构建前设置 Workers Builds 构建变量 EDGE_EVER_AUTH_USERNAME。部署完成后访问 /api/health，确认返回 200，再用配置的管理员用户名和密码登录。",
      },
      {
        title: "启用自动更新",
        body: "进入 Fork 的 Actions 标签页，点击 I understand my workflows, go ahead and enable them，然后手动运行一次 Update deployed EdgeEver，确保后续能够自动获得正式版本的功能更新与修复。",
      },
    ],
  },
} as const;
