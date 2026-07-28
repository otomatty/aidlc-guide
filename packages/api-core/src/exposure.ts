/**
 * The one wording of the LAN-exposure warning (S-MM-2): it names *what*
 * becomes visible, not merely that a port opened. Lives in api-core because
 * both LAN-exposing surfaces — dashboard-server's `--host` startup banner and
 * the VS Code extension's "Share on LAN" confirmation — depend on this
 * package, and each retyping the sentence is how the wordings drift apart.
 */
export const HOST_EXPOSURE_WARNING =
  "警告: LAN に公開します。レンダリングされた aidlc 成果物・監査内容" +
  "（ユーザーが貼り付けた秘密を含み得る）が同一ネットワークの全端末から閲覧可能になります。" +
  "また --host 中は回答の書き込みが全クライアントで無効になります（read-only mode）。";
