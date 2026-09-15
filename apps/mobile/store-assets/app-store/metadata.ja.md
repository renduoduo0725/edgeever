# EdgeEver App Store metadata (ja)

Paste into App Store Connect → App Information / version localization → Japanese (`ja`).
Do not submit this locale through `bun run publish:stores`. Fastlane only uploads
English and Simplified Chinese "What's New" during binary review.

## App information

- Name: EdgeEver
- Subtitle: セルフホストのノートワークスペース
- Primary category: 仕事効率化
- Secondary category: ユーティリティ
- Content rights: EdgeEver は初期状態で第三者のコンテンツを含みません。ユーザーは自分で管理する EdgeEver インスタンスにアプリを接続します。
- Privacy policy URL: https://edgeever.org/en/privacy

## Version listing

### Promotional text

自分で運用するオープンソースの EdgeEver に接続して、ノートをすばやく記録・整理・同期できます。データは自分の手元に置けます。

### Description

EdgeEver は、オープンソースでセルフホストできるノートワークスペースです。書き心地のよさと、データの主導権を両立したい人向けです。

自分または所属組織が運用する EdgeEver インスタンスにアプリを接続すると、iPhone からノートブック、ノート、タグ、添付ファイル、検索、ゴミ箱を使えます。

主な機能：

• ノートブックとノートのすばやい閲覧
• リッチテキストでのノート編集
• 入れ子のノートブックとタグ
• ワークスペース全体の検索
• 画像と添付ファイルのアップロード
• 通信が不安定なときのローカル下書きと同期キュー
• 端末内に安全に保存されるログイン情報
• 広告、解析、追跡、テレメトリーなし

EdgeEver は、あなた自身の Cloudflare アカウント上で動作します。ノートや認証情報を保管・中継する EdgeEver の中央サービスはありません。利用するには、edgeever.org の案内に従ってインスタンスを導入するか、所属組織が用意したインスタンスに接続してください。

EdgeEver は独立したプロジェクトであり、Evernote Corporation およびその関連会社とは提携、後援、承認の関係にありません。

### Keywords

ノート,メモ帳,ノートブック,セルフホスト,Markdown,知識管理,同期,オープンソース,Cloudflare,効率化

### URLs

- Support URL: https://edgeever.org/en/contact
- Marketing URL: https://edgeever.org/en/

### Copyright

2026 Zhengzhou Binggui Network Technology Co., Ltd.

### What's New

端末からモデル提供元へ直接接続し、AI によるノート生成をストリーミングします。クラウド上のインスタンスを経由しません。このクライアントが接続先インスタンスより新しい場合は、対応する Cloudflare または Docker の更新手順をシステム情報に静かに表示します。

## App Review information

- Demo instance URL: https://demo.edgeever.org
- Username: ee-demo
- Password: demo#dZ6Q29Zjfor%
- Contact first name: Shihao
- Contact last name: Ma
- Contact phone: +86 185 3927 0558
- Contact email: 1245207870@qq.com

### Review notes

APP REVIEW LOGIN — paste these values into the sign-in form.

Demo Instance URL (type this exact HTTPS URL into Instance URL; do not type "demo"):
https://demo.edgeever.org

Username: ee-demo
Password: demo#dZ6Q29Zjfor%

How to sign in:
1. Launch EdgeEver.
2. In Instance URL, enter https://demo.edgeever.org
3. Enter the username and password above.
4. Tap Sign in. You should land in a notes workspace with sample content.

Do not enter "demo" alone, and do not use any example.com placeholder.

EdgeEver is a self-hosted personal knowledge base. Users connect the app to their own instance URL; there is no shared SaaS backend. The public demo is for App Review and resets daily around 03:00 China Standard Time (19:00 UTC). Please do not store private data there.

HTTPS is required for the public demo. HTTP is only for local/LAN self-hosting and shows an explicit warning.

The app does not create accounts. Production accounts are created and controlled by the administrator of the self-hosted EdgeEver instance. Notes, attachments, credentials, and sync traffic travel directly between the device and the instance selected by the user; the app developer operates no relay or centralized storage service. Account and server-side data deletion is handled by that instance administrator. Users can sign out to remove the local session and can remove local app data through iOS Settings.

The app uses only standard encryption supplied by the operating system and HTTPS libraries and does not implement proprietary or non-standard cryptography.
