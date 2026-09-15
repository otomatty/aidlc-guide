import type { CustomizationResult } from "@aidlc-guide/shared-types";
import { CustomizationError } from "../customization/model";
import type { CustomizationAiService } from "../customization-ai";
import { listCustomizationMaterials } from "../customization-ai/materials";
import { acceptsCustomizationOrigin, readCustomizationBody } from "./local-request";
import type { ReadContext, RouteResult } from "./read";

function response(result: CustomizationResult<unknown>): RouteResult {
  return {
    status:
      "ok" in result
        ? 200
        : ["read-only-mode", "workspace-untrusted"].includes(result.reason)
          ? 403
          : /conflict|busy|stale|recovery/.test(result.reason)
            ? 409
            : result.reason === "not-found"
              ? 404
              : 400,
    body: result,
  };
}
const unavailable = (): RouteResult => ({
  status: 503,
  body: { error: true, reason: "unavailable", message: "AIへの依頼を利用できません。" },
});

export async function routeCustomizationAiRead(
  ctx: ReadContext,
  url: URL,
): Promise<RouteResult | null> {
  if (!url.pathname.startsWith("/api/customization/ai/")) return null;
  const ai = ctx.customizationAi;
  if (!ai) return unavailable();
  switch (url.pathname) {
    case "/api/customization/ai/tools":
      return response(await ai.tools(url.searchParams.get("recheck") === "true"));
    case "/api/customization/ai/job":
      return response(await ai.get(url.searchParams.get("id") ?? ""));
    case "/api/customization/ai/conversation":
      return response(await ai.conversation(url.searchParams.get("draftId") ?? ""));
    case "/api/customization/ai/materials": {
      try {
        ctx.customization?.assertEditable();
        if (!ctx.customization || ctx.hostMode)
          return response({
            error: true,
            reason: "read-only-mode",
            message: "ローカルのプロジェクトで資料を選択できます。",
          });
        const draft = await ctx.customization.draft();
        const space = draft?.spaceId ?? (await ctx.customization.catalog()).spaceId;
        return response({
          ok: true,
          value: await listCustomizationMaterials(ctx.workspaceRoot, space),
        });
      } catch (error) {
        if (error instanceof CustomizationError && error.status === 403)
          return response({ error: true, reason: error.code, message: error.message });
        return response({
          error: true,
          reason: "materials-unavailable",
          message: "参照資料を読み込めませんでした。",
        });
      }
    }
    default:
      return null;
  }
}

export async function routeCustomizationAiPost(
  ai: CustomizationAiService | undefined,
  action: string,
  body: unknown,
): Promise<RouteResult> {
  if (!ai) return unavailable();
  if (action === "ask") return response(await ai.start(body));
  const id =
    typeof body === "object" && body !== null && "id" in body && typeof body.id === "string"
      ? body.id
      : undefined;
  if (action === "cancel" && id) return response(await ai.cancel(id));
  return response({ error: true, reason: "bad-request", message: "依頼内容を確認してください。" });
}

export async function handleCustomizationAiPost(
  ai: CustomizationAiService | undefined,
  action: string,
  request: Request,
): Promise<Response> {
  if (!acceptsCustomizationOrigin(request))
    return Response.json({ error: true, reason: "origin-refused" }, { status: 403 });
  try {
    const body = await readCustomizationBody(request, 128_000);
    const result = await routeCustomizationAiPost(ai, action, body);
    return Response.json(result.body, {
      status: result.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: true, reason: "bad-request", message: "入力形式またはサイズが不正です。" },
      { status: 400 },
    );
  }
}
