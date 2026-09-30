[中文](README.md) · [English](README.en.md) · [日本語](README.ja.md)

# Open Jarvis

Open Jarvis は、Codex Desktop と CLI で統括エージェントが専門スタッフとの協働と資産の再利用を管理するためのワークフローです。
開発、執筆、事務、動画などの作業で、統括が受け入れ条件を定め、適任のスタッフを選び、実行を監督して最終確認を行います。
スタッフの専門職と実行時のモデル設定は別に扱い、ユーザーが選んだモデル、推論の強度、Fast 設定を優先します。

現在は **0.1.0 プレビュー版**で、GitHub Release はまだありません。GitHub Release で配布し、npm には公開しません。GitHub リポジトリ：[lbtlm/open-jarvis](https://github.com/lbtlm/open-jarvis)。
3 言語の README は同じ機能を説明していますが、CLI とすべての参考文書が多言語化されているわけではありません。
公式認証、モデル料金の比較、利用枠への効果、一定の削減率を保証するものではありません。

## インストールと使い始め方

Node.js **22+**（npm/npx を含む）と、独立したサブエージェントのロール設定に対応し、ログイン済みの Codex が必要です。
インストール先は `--home`、`CODEX_HOME`、`~/.codex` の順で決まります。
Desktop と CLI が同じ Codex home を使う場合、インストールは 1 回で十分です。

現在のプレビュー版では、内容を確認したローカルパッケージをターミナルの作業ディレクトリに置き、次を実行します。

```sh
npx --package ./open-jarvis-0.1.0.tgz open-jarvis install
```

ターミナルのウィザードで、統括と実行ロールのモデル、推論の強度、Fast、スタッフのテンプレートを選べます。
テンプレートの既定値は `none` です。まず協働ルールを導入し、作業に応じてスタッフを選ぶことができます。
`--yes` は対話なしでインストールし、既存の設定を維持します。新規インストールでは Astra / High を推奨します。
Fast は独立した設定で、既定ではオフです。Ultra の自動設定や、ユーザーの統括を Sol に自動変更することはありません。

GitHub Release に対応するパッケージが公開された後は、その URL から直接インストールできます。

```sh
npx --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.1.0/open-jarvis-0.1.0.tgz open-jarvis install
```

以下の例はローカルパッケージを指定します。現在は確認済みの候補パッケージを使い、Release 公開後は対応するパッケージを作業ディレクトリにダウンロードして使えます。
例のバージョンは 0.1.0 です。別のバージョンを使う場合、URL、ファイル名、バージョン番号を合わせて変更してください。
ソースのクローン、Jarvis のグローバルインストール、Node スクリプトの手動実行は不要です。

インストール後、新しい Codex タスクで、例えば次のように依頼します。

> Jarvis の手順でこの作業を進めてください。統括が受け入れ条件を定め、能力に合うスタッフを選び、実行を監督して最終確認してください。実際のエージェント ID と実行時設定の証拠も記録してください。

新しいセッションは設定の読み込みに役立ちますが、ネイティブロールの有効化を保証しません。実際の割り当ても確認してください。
インストール前には `audit` で変更を確認でき、導入後は `doctor` で静的な検査ができます。

## pnpm を使う場合

既定の案内は npx です。すでに pnpm を使っている場合は、同じパッケージとウィザードを利用できます。

```sh
pnpm --package=./open-jarvis-0.1.0.tgz dlx open-jarvis install
```

GitHub Release 公開後は、パッケージの URL を直接指定することもできます。

```sh
pnpm --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.1.0/open-jarvis-0.1.0.tgz dlx open-jarvis install
```

以下のローカルパッケージの例では、`npx --package ./open-jarvis-0.1.0.tgz open-jarvis` を
`pnpm --package=./open-jarvis-0.1.0.tgz dlx open-jarvis` に置き換え、コマンドと引数を維持してください。
どちらも同じ Codex home、スタッフ、資産を使います。二重のインストールや別の資産保管先は不要です。
pnpm **10.18.1** は Windows 上でローカル検証済みです。[互換性の説明（英語）](docs/compatibility.md)を参照してください。

## よく使うコマンド

| コマンド | 用途 | 例（ローカルパッケージ） |
| --- | --- | --- |
| `audit` | 書き込まずにインストール変更を確認 | `npx --package ./open-jarvis-0.1.0.tgz open-jarvis audit` |
| `install` | バックアップを保護して導入・更新 | `npx --package ./open-jarvis-0.1.0.tgz open-jarvis install --starter none` |
| `doctor` | 導入済みファイルを静的に検査 | `npx --package ./open-jarvis-0.1.0.tgz open-jarvis doctor` |
| `rollback` | マニフェストを使って 1 回分の導入を戻す | `npx --package ./open-jarvis-0.1.0.tgz open-jarvis rollback --manifest /path/to/manifest.json` |
| `employees` | スタッフカードを検索、またはテンプレート追加を確認 | `npx --package ./open-jarvis-0.1.0.tgz open-jarvis employees --query writing` |
| `plan` | スタッフ、スキル、実行プロファイルを確認 | `npx --package ./open-jarvis-0.1.0.tgz open-jarvis plan --employee nova-writer --difficulty standard` |
| `export` | 新しい資産アーカイブを作成 | `npx --package ./open-jarvis-0.1.0.tgz open-jarvis export --out ./my-assets.jarvis.json.gz` |
| `import` | 適用前に資産アーカイブを確認 | `npx --package ./open-jarvis-0.1.0.tgz open-jarvis import --from ./my-assets.jarvis.json.gz` |

`/path/to/manifest.json` は例示用のパスです。実際のインストールマニフェストに置き換えてください。
`--home PATH` は Codex home、`--project PATH` はプロジェクト資産を明示的に選び、`--json` は機械可読の結果を出力します。
全オプションは `npx --package ./open-jarvis-0.1.0.tgz open-jarvis --help` で確認できます。
`audit` と `doctor` はモデルへのリクエストを行わず、スタッフが実行されたことも証明しません。

## 統括・専門スタッフ・モデル

通常の質問、単一手順の調査、すぐに確認できる小さな修正は、統括が直接処理します。
それ以外は、必要な分野、成果物、言語、手法とツールを先に確認し、能力が一致する承認済みスタッフから再利用を優先します。
承認済みであること、空いていること、固定モデルを持つことだけでは、専門能力の根拠になりません。
適任者がいなければ、統括が責務・スキル・設定を示して臨時スタッフを提案し、ユーザーの承認後に割り当てます。
無関係なスタッフに無理に任せたり、名前を変えて専門性があるように扱ったりしません。

| 実行プロファイル | 推奨モデル / 推論の強度 | 適した作業 |
| --- | --- | --- |
| `controller`（統括） | GPT-6 Astra / High | 調整、監督、最終確認 |
| `luna` | GPT-6 Luna / Medium | 明確でリスクの低い小作業 |
| `simple` | GPT-6.1 Sol / Low | 仕組みが既知の簡単な実装 |
| `terra` | GPT-6.1 Sol / Medium | 通常作業と範囲内での未知の不具合調査 |
| `sol` | GPT-6.1 Sol / High | 契約の変更、複雑な意味論、重要な挙動 |
| `reviewer` | GPT-6.1 Sol / High | リスクや証拠に基づく独立レビュー |

これらは推奨値で、既存のユーザー設定が優先されます。`terra` は互換用キーであり、GPT-6 Terra という製品を指しません。
Fast はモデルや推論の強度とは別に選びます。モデルの利用可否、権限、サービス設定は実行時の確認が必要です。
既定の実行担当は 1 人です。同時実行のサブエージェントは Reviewer を含め、統括を除いて最大 3 人で、より低いユーザー指定や全体上限に従います。
実行担当は再帰的に委派しません。独立レビューは明示されたリスクや証拠に応じて行い、全タスクで必須ではありません。
必要なモデル、Fast、Reviewer の読み取り専用権限を維持できない場合、その割り当てが実行できないことを報告します。

## スタッフとスキル

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
npx --package ./open-jarvis-0.1.0.tgz open-jarvis employees --init --starter writing
npx --package ./open-jarvis-0.1.0.tgz open-jarvis employees --init --starter writing --yes
npx --package ./open-jarvis-0.1.0.tgz open-jarvis plan --employee nova-writer --difficulty standard --skill my-writing-skill
```

`my-writing-skill` は例示用のスキル ID です。実在するスキルに置き換えてください。不足している場合、計画は実行不可として報告されます。
`plan` はスタッフを起動せず、スキル本文を読まず、スキルが読み込まれたことも証明しません。
スキルはユーザーの明示指定を優先し、次に適合する導入済みスキルを探し、なお不足する場合に外部検索を行います。
カード内の提案は許可リストではありません。`--skill` でカード外のスキルを一時指定しても、カードは恒久変更されません。
Jarvis の導入は全スキルの一括導入ではなく、Office、編集、プラグイン、クラウドアカウントの利用能力も付与しません。
スタッフカードはファイル資産で、常駐プロセスではありません。[スタッフの運用規約（英語）](payload/skills/jarvis-orchestrator/references/employees.md)を参照してください。

## 資産の改善と移行

再利用できる成果は「候補を作る → 検証する → ユーザーが決める → 保存・更新する → 次回再利用する」という手順で蓄積します。
スタッフの経験、スキル、知識、好み、テンプレートを保存できます。経験には実際の証拠と適用条件が必要です。
タスクや臨時採用の承認は、恒久保存の承認ではありません。モデル学習や長期指示の自動書き換えも行いません。
毎回の採点、振り返り、統計は必須ではありません。[資産の改善手順（中国語）](docs/asset-evolution.md)を参照してください。

個人資産は Codex home の `jarvis/`、プロジェクト資産は `.jarvis/` に保存します。
エクスポートにはスタッフ、知識、好み、resources、選択したスキルのディレクトリ、モデル設定を含みます。
`jarvis/skills.json` で補助スキルの依存関係を明示登録します。全スキルやプラグインの走査、本文からの全依存関係の推測は行いません。
既定のスキル探索先は、プロジェクトの `.agents/skills`、`.codex/skills`、home の `skills`、home と同階層の `.agents/skills` の順です。
`--skill-root PATH` を複数指定すると、既定のエクスポート探索先の一覧を完全に置き換えます。

```sh
npx --package ./open-jarvis-0.1.0.tgz open-jarvis export --out ./my-assets.jarvis.json.gz
npx --package ./open-jarvis-0.1.0.tgz open-jarvis import --from ./my-assets.jarvis.json.gz
npx --package ./open-jarvis-0.1.0.tgz open-jarvis import --from ./my-assets.jarvis.json.gz --yes
npx --package ./open-jarvis-0.1.0.tgz open-jarvis install --models /path/to/codex-home/jarvis/models.json --yes
```

プロジェクト資産は、移行元のエクスポートと移行先のインポートの両方で `--project` を明示し、それぞれのプロジェクトパスを指定します。
インポートはまずプレビューし、`--yes` で書き込みます。同一内容はスキップし、内容差分が 1 件でもあれば全体を停止します。上書きやスクリプト実行は行いません。
最後のコマンドのパスは置き換えてください。モデル設定を確認してから明示的にインストールで有効化します。インポートだけでは統括は変わりません。
移行先のログイン、プラグイン、外部ツール、権限は別途復元してください。資産内の絶対パスは自動変更されません。
アーカイブの上限は、1 ファイル **4 MiB**、内容合計 **32 MiB**、圧縮後 **16 MiB**、最大 **5000** ファイルです。
動画などの大きなメディアは別途移行します。本文の自動匿名化は行わないため、共有前に確認してください。hash は完全性の検査で、出所を証明する署名ではありません。
詳しくは[資産の運用手順（英語）](payload/skills/jarvis-orchestrator/references/assets.md)を参照してください。

## よくある質問

**統括は変更されますか？** 既存のモデル、推論の強度、Fast 設定は維持されます。新規導入では Astra / High を推奨します。
`--models` を明示的に使う前にファイルを確認してください。専門職や実行プロファイルがユーザーの統括を自動的に置き換えることはありません。

**有効になったことをどう確認しますか？** `audit` / `doctor` の後、新しいタスクを開いて実際にスタッフを割り当てます。
実際のエージェント ID と実行時設定を記録してください。設定ファイルや新しいセッションだけでは、ネイティブ登録、即時再読み込み、権限の有効化は保証されません。

**適任のスタッフがいない場合は？** 分野、言語、成果物、ツールに合う臨時の専門職を提案し、承認後に実行します。
テンプレートや肩書きは能力の証拠ではありません。無関係なバックエンド担当を言語専門家に改名して済ませることはしません。

**更新とロールバックの手順は？** `audit` の後に `install` を実行し、戻す場合はその導入のマニフェストを `rollback --manifest` に指定します。
導入とロールバックは自身の設定を管理し、ユーザーのスタッフや資産を削除しません。後続の変更と競合するとロールバックを拒否します。機密を含み得るバックアップは公開しないでください。

## 開発・公開・更新

機能開発はブランチで行い、PR を通じて `dev` にマージします。公開時は `dev` → `main` のリリース PR を作成します。
`main` へのマージが自動 CI/CD の承認になります。ワークフローのチェックに合格するとバージョンタグと GitHub Release のパッケージを生成し、二度目の公開承認は求めません。
ワークフローが失敗した場合、そのバージョンは公開済みとは扱えません。マージ記録と Release の成果物をそれぞれ確認してください。
パッケージは GitHub Release で配布しますが、依存関係は registry から取得する場合があり、完全なオフライン導入は保証しません。
公開ルールは[公開手順（英語）](docs/releasing.md)、バージョン選択・更新・ロールバックは[アップグレードの説明（英語）](docs/upgrading.md)を参照してください。

## コントリビューションと現在の制限

保守作業では npm と `package-lock.json` を使用し、pnpm のロックファイルは追加しません。関連する開発チェックは次のとおりです。

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run test:package
pnpm run test:package:pnpm
```

Windows のローカル環境で npm/pnpm の導入、移行、ロールバックを検証済みです。CI は Windows、macOS、Linux の Node 22/24 向けに設定されています。
設定済みのマトリクスは、全環境での成功を意味しません。独立した資産コードレビューはネットワークの問題で未完了のため、公開条件をすべて満たしたとはしていません。
静的検査ではモデルの実動作は証明できません。[検証記録（英語）](docs/validation.md)と[公開手順（英語）](docs/releasing.md)を参照してください。
貢献は [CONTRIBUTING（英語）](CONTRIBUTING.md)、安全上の問題は [SECURITY（英語）](SECURITY.md) を参照してください。ライセンスは [MIT](LICENSE) です。
