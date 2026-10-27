<h1 align="center">Open Jarvis</h1>

<p align="center">専門スタッフとの協働。あなたの設定。再利用できる成果。</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
  <a href="docs/compatibility.md"><img src="https://img.shields.io/badge/Node.js-22%2B-43853d" alt="Node.js 22+"></a>
  <a href="https://github.com/lbtlm/open-jarvis/actions/workflows/release.yml"><img src="https://github.com/lbtlm/open-jarvis/actions/workflows/release.yml/badge.svg?branch=main" alt="Release pipeline on main"></a>
  <a href="https://github.com/lbtlm/open-jarvis/releases"><img src="https://img.shields.io/badge/download-GitHub_Releases-24292f" alt="GitHub Releases"></a>
</p>

Open Jarvis は **Codex、WorkBuddy、Claude Code、Cursor** に統括エージェントが監督する協働の手順を提供します。開発、執筆、事務、動画の作業で、受け入れ条件を定め、適任のスタッフを選び、実行を確認し、承認を得て成果を再利用できます。

**0.2.0 の新機能：** 各クライアントに独立して導入し、同じマシン上のスタッフ・経験資産を共有できます。モデルと権限は各クライアントで個別に管理します。コマンドと検証範囲は[マルチプラットフォームガイド（英語）](docs/multi-platform.md)を参照してください。アプリ間のタスク割り当ては行いません。

[クイックスタート](#quick-start) · [主な機能](#capabilities) · [作業の流れ](#workflow) · [スタッフと設定](#employees-and-settings) · [コマンド](#commands) · [再利用資産](#assets) · [FAQ](#faq) · [検証状況](#verification) · [貢献](#contributing)

<a id="quick-start"></a>

## クイックスタート

**Node.js 22+**（npm/npx を含む）と、[マルチプラットフォームガイド（英語）](docs/multi-platform.md)のネイティブ設定に対応するクライアントが必要です。モデルの実行には、そのクライアントのログインと利用権限が必要です。既定は Codex で、ほかのクライアントは `--platform workbuddy`、`--platform claude-code`、`--platform cursor` を指定します。

[GitHub Releases](https://github.com/lbtlm/open-jarvis/releases) から公開済みのバージョンを選んでください。以下は **0.2.0** の例で、ダウンロード URL は公開後に利用できます。別のバージョンでは、番号、URL、ファイル名を合わせて変更します。該当する成果物が利用できない場合は、下記の確認済みローカルパッケージを使ってください。

```sh
npx --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.2.0/open-jarvis-0.2.0.tgz open-jarvis install
```

**Codex のターミナルウィザードで設定を選びます：** 統括と実行ロールのモデル、推論の強度、Fast、スタッフのテンプレート。既定のテンプレートは `none` なので、協働ルールから始めて必要なスタッフを追加できます。既存の設定を優先し、新規導入の統括には Astra / High を推奨します。Fast は別に選び、既定ではオフです。Ultra の自動有効化や Sol への自動切り替えは行いません。

<details>
<summary>pnpm の代替手順と確認済みローカルパッケージ</summary>

```sh
pnpm --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.2.0/open-jarvis-0.2.0.tgz dlx open-jarvis install
```

確認済みのパッケージを現在のディレクトリに置き、どちらかの実行方法を使います。

```sh
npx --package ./open-jarvis-0.2.0.tgz open-jarvis install
pnpm --package=./open-jarvis-0.2.0.tgz dlx open-jarvis install
```

両方とも選択したプラットフォームのネイティブ home と共有資産ルートを使います。パッケージは GitHub Releases で配布し、**npm registry には公開していません**。依存関係は npm から取得する場合があり、完全なオフライン導入は保証しません。`--home` はプラットフォームのネイティブ設定先を選びます。Codex では `CODEX_HOME` と `~/.codex` の既定値を維持します。共有資産は `--assets-home`、`JARVIS_HOME`、保存済みの設定に従います。[選択規則（英語）](docs/multi-platform.md#choose-the-asset-root)を参照してください。`--yes` は対話なしで導入し、既存の設定を維持します。pnpm **10.18.1** は Windows 上でローカル検証済みです。[互換性（英語）](docs/compatibility.md)を参照してください。

</details>

導入後、そのクライアントで新しいタスクを開き、例えば次のように依頼します（Cursor では `/jarvis-orchestrator` を明示的に呼び出します）。

> Jarvis の手順でこの作業を進めてください。統括が受け入れ条件を定め、能力に合うスタッフを選び、実行を監督して最終確認してください。実際のエージェント ID と実行時設定の証拠も記録してください。

導入前は `audit` で変更を確認し、導入後は `doctor` で静的に検査できます。新しいセッションは設定の読み込みに役立ちますが、ロールと実行時設定は実際の割り当てでも確認が必要です。

<a id="capabilities"></a>

## 主な機能

- **さまざまな分野で協働。** 開発、執筆、事務、動画の成果物、言語、手法、ツールに合う専門スタッフを選びます。
- **割り当てを検証可能に。** 範囲、受け入れ条件、要求設定、実際のエージェント ID、実行時の証拠を明示します。
- **作業に合わせてスキルを選択。** 専門職をモデルやスキル一覧に恒久的に固定せず、適切な手法を使います。
- **承認を得て成果を再利用。** 検証した経験、スキル、知識、好み、テンプレートを保存し、移行は適用前に確認します。

<a id="workflow"></a>

## 作業の流れ

```mermaid
flowchart TD
  A["ユーザーの依頼"] --> B{"質問・調査・直接編集の明示的な依頼？"}
  B -->|はい| C["統括が直接処理"]
  B -->|いいえ| D["承認済みの適任者を選択"]
  D -->|適任者なし| E["ユーザーが新スタッフを承認"]
  D -->|適任者あり| F["作業設定を選び割り当てを検証"]
  E --> F
  F --> G["スタッフが証拠を提出"]
  C --> H["統括が最終確認"]
  G --> H
  H -->|新たな再利用価値がある場合| I["ユーザーが保存を決定"]
```

### 四つの選択を分ける

- **スタッフ：** 能力、範囲、証拠を記した再利用可能な専門職カード。常駐サービスやネイティブロールの登録ではありません。
- **スキル：** 今回の作業手法。ユーザーの指定を優先し、次に適した導入済みスキルを探します。不足する場合は外部検索を行えますが、導入には別途承認が必要です。
- **実行設定：** 作業ごとに選ぶモデル、推論の強度、Fast。実行時の確認が必要で、スタッフの身分に恒久的には固定しません。
- **保存資産：** 検証し、ユーザーの承認で保存した成果。作業の承認は恒久保存の承認ではなく、バックグラウンドでの自動学習は行いません。

<a id="employees-and-settings"></a>

## スタッフと実行設定

通常の質問と単一手順の調査は、統括が直接処理します。コードの変更は微修正も適任のスタッフに任せ、ユーザーが直接編集を明示的に依頼した場合は例外とします。統括は調整と最終確認を担当します。
スタッフの専門能力を先に合わせます。必要な分野、成果物、言語、手法とツールを確認し、能力が一致する承認済みスタッフから再利用を優先します。難易度、モデル、推論の強度、Fast は今回の設定です。コード以外の微修正には、影響に見合う確認を行い、余分な手順を増やしません。
承認済みであること、空いていること、固定モデルを持つことだけでは、専門能力の根拠になりません。
適任者がいなければ、統括が責務・スキル・設定を示して臨時スタッフを提案し、ユーザーの承認後に割り当てます。
無関係なスタッフに無理に任せたり、名前を変えて専門性があるように扱ったりしません。

以下は **Codex の推奨設定**です。WorkBuddy、Claude Code、Cursor の実行プロファイルは既定で `inherit` となり、統括モデルはクライアントで選びます。[ネイティブモデル設定（英語）](docs/multi-platform.md#native-adapters-and-official-references)を参照してください。

| 実行プロファイル | 推奨モデル / 推論の強度 | 適した作業 |
| --- | --- | --- |
| `controller`（統括） | GPT-6 Astra / High | 調整、監督、最終確認 |
| `luna` | GPT-6 Luna / Medium | 明確でリスクの低い小作業 |
| `simple` | GPT-6.1 Sol / Low | 仕組みが既知の簡単な実装 |
| `terra` | GPT-6.1 Sol / Medium | 通常作業と範囲内での未知の不具合調査 |
| `sol` | GPT-6.1 Sol / High | 契約の変更、複雑な意味論、重要な挙動 |
| `reviewer` | GPT-6.1 Sol / High | リスクや証拠に基づく独立レビュー |

これらは推奨値で、既存のユーザー設定が優先されます。`terra` は互換用キーであり、GPT-6 Terra という製品を指しません。
難易度は実際の影響とリスクで判断します。微修正は `micro`、小規模な作業は `light`/`simple`、通常の中規模作業は `standard`、大規模または重要な変更は `complex` です。原則として適任者 1 人が調査、実装、検証まで担当し、Luna による事前調査や、ファイル確認・文書読解・実装の担当者リレーは必須にしません。実装では適切なコードの再利用、関連する重複の統合、既存箇所の編集、置き換えた旧ロジックの削除、必要な追加を同時に行います。範囲内の関連する不要コードも整理でき、行数削減より挙動の検証を優先します。
Fast はモデルや推論の強度とは別に選びます。モデルの利用可否、権限、サービス設定は実行時の確認が必要です。
既定の実行担当は 1 人です。同時実行のサブエージェントは Reviewer を含め、統括を除いて最大 3 人で、より低いユーザー指定や全体上限に従います。
実行担当は再帰的に委派しません。独立レビューは明示されたリスクや証拠に応じて行い、全タスクで必須ではありません。
必要なモデル、Fast、Reviewer の読み取り専用権限を維持できない場合、その割り当てが実行できないことを報告します。

**計画オプション：** `plan --employee atlas-backend --difficulty micro` は既存の `luna` プロファイルに対応し、導入済み設定を継承します。明示的な `--effort low` は今回だけ推論の強度を上書きする例で、選択モデルに対する有効性を確認します。micro は強度を自動的に下げず、全体設定やスタッフの身元も変更しません。導入済みプロファイルと強度が異なる場合は、実行時に明示的に設定する必要があります。プレビューはネイティブロールの設定変更を証明しません。`atlas-backend` は既存の適任スタッフ ID に置き換えてください。[振り分け（英語）](docs/routing.md)を参照してください。

<details>
<summary>スタッフのテンプレートとスキル計画</summary>

| テンプレート | 候補スタッフ |
| --- | --- |
| `none` | スタッフカードを追加しない |
| `development` | Iris（フロントエンド）、Atlas（バックエンド）、Quinn（QA）、Sentry（レビュー） |
| `writing` | Nova（執筆） |
| `office` | Clara（事務） |
| `video` | Frame（動画） |

テンプレートは候補カードです。採用済み、スキル読み込み済み、経験が検証済みという意味ではありません。
従来の `employees --init --yes` も利用でき、既定では不足している開発テンプレートのカードを追加します。
例えば、執筆の候補カードを確認してから明示的に書き込みます。

```sh
npx --package ./open-jarvis-0.2.0.tgz open-jarvis employees --init --starter writing
npx --package ./open-jarvis-0.2.0.tgz open-jarvis employees --init --starter writing --yes
npx --package ./open-jarvis-0.2.0.tgz open-jarvis plan --employee nova-writer --difficulty standard --skill my-writing-skill
```

`my-writing-skill` は例示用のスキル ID です。実在するスキルに置き換えてください。不足している場合、計画は実行不可として報告されます。
`plan` はスタッフを起動せず、スキル本文を読まず、スキルが読み込まれたことも証明しません。
スキルはユーザーの明示指定を優先し、次に適合する導入済みスキルを探し、なお不足する場合に外部検索を行います。
カード内の提案は許可リストではありません。`--skill` でカード外のスキルを一時指定しても、カードは恒久変更されません。
Jarvis の導入は全スキルの一括導入ではなく、Office、編集、プラグイン、クラウドアカウントの利用能力も付与しません。
スタッフカードはファイル資産で、常駐プロセスではありません。[スタッフの運用規約（英語）](payload/skills/jarvis-orchestrator/references/employees.md)を参照してください。

</details>

<a id="commands"></a>

## よく使うコマンド

以下は**コマンドの末尾部分**で、単独では実行できません。次の完全な実行プレフィックスに追加してください。

```sh
npx --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.2.0/open-jarvis-0.2.0.tgz open-jarvis
```

どの末尾部分も、`pnpm --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.2.0/open-jarvis-0.2.0.tgz dlx open-jarvis` に追加できます。確認済みローカルパッケージでは、`npx --package ./open-jarvis-0.2.0.tgz open-jarvis` または `pnpm --package=./open-jarvis-0.2.0.tgz dlx open-jarvis` を使い、末尾部分はそのままにします。

| コマンドの末尾部分 | 用途 |
| --- | --- |
| `audit` | 書き込まずにインストール変更を確認 |
| `install --starter none` | バックアップを保護して導入・更新 |
| `doctor` | 導入済みファイルを静的に検査 |
| `rollback --manifest /path/to/manifest.json` | マニフェストを使って 1 回分の導入を戻す |
| `employees --query writing` | スタッフカードを検索、またはテンプレート追加を確認 |
| `plan --employee nova-writer --difficulty standard` | スタッフ、スキル、実行プロファイルを確認 |
| `export --out ./my-assets.jarvis.json.gz` | 新しい資産アーカイブを作成 |
| `import --from ./my-assets.jarvis.json.gz` | 適用前に資産アーカイブを確認 |

例えば、静的な検査は次のように実行します。

```sh
npx --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.2.0/open-jarvis-0.2.0.tgz open-jarvis doctor
```

`/path/to/manifest.json` は例示用のパスです。実際のインストールマニフェストに置き換えてください。
`--platform codex|workbuddy|claude-code|cursor` はアダプター、`--home PATH` はネイティブ設定先、`--assets-home PATH` は共有個人資産先、`--project PATH` はプロジェクト資産を明示的に選び、`--json` は機械可読の結果を出力します。
全オプションは `npx --package ./open-jarvis-0.2.0.tgz open-jarvis --help` で確認できます。
`audit` と `doctor` はモデルへのリクエストを行わず、スタッフが実行されたことも証明しません。

<a id="assets"></a>

## 再利用できる資産

再利用できる成果は「候補を作る → 検証する → ユーザーが決める → 保存・更新する → 次回再利用する」という手順で蓄積します。
スタッフの経験、スキル、知識、好み、テンプレートを保存できます。経験には実際の証拠と適用条件が必要です。
タスクや臨時採用の承認は、恒久保存の承認ではありません。モデル学習や長期指示の自動書き換えも行いません。
毎回の採点、振り返り、統計は必須ではありません。[資産の改善手順（中国語）](docs/asset-evolution.md)を参照してください。

**Markdown の経験記録：** Markdown の経験記録では、タスク内の候補と承認済みの `knowledge/experience/` を分け、保存前に具体的な内容を確認し、計画には現在の原文への参照を選びます。個人・プロジェクトの範囲と基本的な Unicode 検索に対応します。別途導入した任意の QMD と連携し、対象範囲を限定してスタッフ・スキル・経験を検索できます。必要に応じて埋め込みモデルによる意味検索を使い、利用できない場合はローカルファイル検索に戻ります。スタッフカードは本文を複製せず、正本の経験記録にリンクします。手順と例は [Markdown の経験記録（英語）](docs/experience.md)を参照してください。

**任意の QMD 導入：** 既定の `install` は QMD をダウンロードせず、既存の QMD 環境と接続を維持します。対話ウィザードでは QMD の導入を選び、npm または pnpm、導入先、`auto` または `cpu` を指定できます。最終確認の後にパッケージマネージャーを実行します。Codex の非対話での導入には次のコマンドを使います。

```sh
npx --package https://github.com/lbtlm/open-jarvis/releases/download/v0.2.0/open-jarvis-0.2.0.tgz open-jarvis install --qmd --qmd-dir /absolute/path/to/qmd --qmd-manager npm --qmd-device auto --yes
```

実際のパッケージと絶対パスの導入先に置き換えてください。`--qmd-manager pnpm` も使えます。導入するのはエンジンとプラットフォーム用の native パッケージです。モデルのダウンロード、索引の作成、ドライバーや完全な CUDA Toolkit の導入は行いません。意味検索にはモデルと承認済み資産の索引が必要です。GPU 検出と CPU へのフォールバックは QMD に従います。パッケージが存在しても CUDA の動作確認にはならず、Windows では任意の cuBLAS ランタイムが必要な場合があります。QMD の失敗は部分的な導入として報告し、Jarvis の導入結果は残る場合があります。[QMD の説明（英語）](docs/experience.md)を参照してください。

<details>
<summary>移行コマンド・パス・上限</summary>

個人資産は選択した共有ルート（新規の既定は `~/.jarvis`）に保存します。既存の Codex `<home>/jarvis` は移動せず利用できます。プロジェクト資産は `.jarvis/` に保存し、各クライアントで同じ `--assets-home` を選びます。
エクスポートにはスタッフ、知識、好み、resources、選択したスキルのディレクトリ、モデル設定を含みます。
`<assets-home>/skills.json` で補助スキルの依存関係を明示登録します。全スキルやプラグインの走査、本文からの全依存関係の推測は行いません。
スキルは選択したプラットフォームのプロジェクト用ディレクトリ、プロジェクトの `.agents/skills`、ネイティブ home の `skills`、ユーザーの `.agents/skills` から探します。Codex は `.codex/skills` も維持します。
`--skill-root PATH` を複数指定すると、既定のエクスポート探索先の一覧を完全に置き換えます。

```sh
npx --package ./open-jarvis-0.2.0.tgz open-jarvis export --out ./my-assets.jarvis.json.gz
npx --package ./open-jarvis-0.2.0.tgz open-jarvis import --from ./my-assets.jarvis.json.gz
npx --package ./open-jarvis-0.2.0.tgz open-jarvis import --from ./my-assets.jarvis.json.gz --yes
npx --package ./open-jarvis-0.2.0.tgz open-jarvis install --models /absolute/path/to/shared-assets/models.json --yes
```

プロジェクト資産は、移行元のエクスポートと移行先のインポートの両方で `--project` を明示し、それぞれのプロジェクトパスを指定します。
インポートはまずプレビューし、`--yes` で書き込みます。同一内容はスキップし、内容差分が 1 件でもあれば全体を停止します。上書きやスクリプト実行は行いません。
最後の Codex の例のパスは置き換えてください。インポートは選択した共有資産先に書き込み、Codex 以外を移行元とするモデル設定は `models.<source-platform>.json`、Codex は `models.json` を使います。確認後、対象プラットフォームの導入で明示的に有効化します。インポートだけではモデル設定の有効化や統括の変更は行いません。
移行先のログイン、プラグイン、外部ツール、権限は別途復元してください。資産内の絶対パスは自動変更されません。
アーカイブの上限は、1 ファイル **4 MiB**、内容合計 **32 MiB**、圧縮後 **16 MiB**、最大 **5000** ファイルです。
動画などの大きなメディアは別途移行します。本文の自動匿名化は行わないため、共有前に確認してください。hash は完全性の検査で、出所を証明する署名ではありません。
詳しくは[資産の運用手順（英語）](payload/skills/jarvis-orchestrator/references/assets.md)を参照してください。

</details>

<a id="faq"></a>

## よくある質問

**統括は変更されますか？** 既存のモデル、推論の強度、Fast 設定は維持されます。Codex の新規導入では Astra / High を推奨し、ほかのプラットフォームの統括はクライアントで選びます。
`--models` を明示的に使う前にファイルを確認してください。専門職や実行プロファイルがユーザーの統括を自動的に置き換えることはありません。

**有効になったことをどう確認しますか？** `audit` / `doctor` の後、新しいタスクを開いて実際にスタッフを割り当てます。
実際のエージェント ID と実行時設定を記録してください。設定ファイルや新しいセッションだけでは、ネイティブ登録、即時再読み込み、権限の有効化は保証されません。

**適任のスタッフがいない場合は？** 分野、言語、成果物、ツールに合う臨時の専門職を提案し、承認後に実行します。
テンプレートや肩書きは能力の証拠ではありません。無関係なバックエンド担当を言語専門家に改名して済ませることはしません。

**更新とロールバックの手順は？** `audit` の後に `install` を実行し、戻す場合はその導入のマニフェストを `rollback --manifest` に指定します。
導入とロールバックは自身の設定を管理し、ユーザーのスタッフや資産を削除しません。後続の変更と競合するとロールバックを拒否します。機密を含み得るバックアップは公開しないでください。

<a id="verification"></a>

## 検証状況と現在の制限

0.2.0 のアダプター・共有資産の自動検査と、独立した読み取り専用の範囲限定レビューは合格しました。Codex は隔離した設定読み取りを確認しました。WorkBuddy 5.8.3 と Claude Code 2.1.39 は実際のネイティブディレクトリに導入し、静的な `doctor` に合格しました。WorkBuddy のスタッフ呼び出しは未完了で、Claude の試行は `Not logged in` となり、モデル呼び出しと課金はありませんでした。Cursor は導入・実行していません。所有者の指示で残りの実クライアント検証を省略して公開するため、全クライアントのスタッフ呼び出し成功は確認していません。

[クライアント検証表（英語）](docs/multi-platform.md#020-client-validation-boundary)を参照してください。CI と公開パッケージの導入結果は [Release ワークフロー](https://github.com/lbtlm/open-jarvis/actions/workflows/release.yml)で別に記録します。静的検査、パッケージの smoke 検査、範囲限定レビューは、モデルの実行、実効権限、全面的なセキュリティ監査を証明しません。

3 言語の完全版 README は同じ機能を説明します。CLI と詳しい参考文書の大半は未翻訳で、リンク先の言語を明記しています。[検証記録（英語）](docs/validation.md)と[公開手順（英語）](docs/releasing.md)を参照してください。

<a id="contributing"></a>

## 貢献と公開

機能開発はブランチで行い、PR を通じて `dev` にマージします。公開時は `dev` → `main` のリリース PR を作成します。
`main` へのマージが自動 CI/CD の承認になります。ワークフローのチェックに合格するとバージョンタグと GitHub Release のパッケージを生成し、二度目の公開承認は求めません。
ワークフローが失敗しても、公開済みの Release が導入検証待ちで残る場合があります。実行サマリーと Release の成果物をそれぞれ確認してください。
パッケージは GitHub Release で配布しますが、依存関係は registry から取得する場合があり、完全なオフライン導入は保証しません。
公開ルールは[公開手順（英語）](docs/releasing.md)、バージョン選択・更新・ロールバックは[アップグレードの説明（英語）](docs/upgrading.md)を参照してください。

<details>
<summary>貢献者向けの検査</summary>

保守作業では npm と `package-lock.json` を使用し、pnpm のロックファイルは追加しません。関連する開発チェックは次のとおりです。

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run test:package
pnpm run test:package:pnpm
```

</details>

貢献は [CONTRIBUTING（英語）](CONTRIBUTING.md)、安全上の問題は [SECURITY（英語）](SECURITY.md) を参照してください。ライセンスは [MIT](LICENSE) です。

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)
