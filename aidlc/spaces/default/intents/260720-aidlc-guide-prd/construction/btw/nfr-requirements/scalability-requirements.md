# Scalability Requirements — Unit: btw

> nfr-requirements (3.2) / Unit: btw / 2026-07-23
> 入力: business-logic-model.md + requirements.md（NFR-5: ローカル・単一ユーザー前提）

## 適用なし（明示）

btw はワンショットのローカル CLI（domain-entities.md: 状態なし・永続化なし・listen なし）。スケーラビリティ軸（同時ユーザー・データ量成長・水平分散）は**構造的に非該当**。

## 唯一のデータ量軸

- セッション JSONL ディレクトリの件数増加 → P-BTW-2（performance-requirements.md）で扱う（readdir+stat のみ、内容非読取）。100件規模まで劣化なしを設計要件とし、それ以上はローカル環境の実態として発生しない想定（発生しても線形の stat 増のみ）。
