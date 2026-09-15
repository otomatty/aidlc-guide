import type { CustomizationService } from "../customization/index.ts";
import { CustomizationError } from "../customization/model.ts";
import { acceptsCustomizationOrigin, readCustomizationBody } from "./local-request.ts";
import { json, type RouteResult } from "./read.ts";

export const CUSTOMIZATION_ACTIONS = [
  "draft/save",
  "draft/discard",
  "draft/reconcile",
  "proposal/adopt",
  "proposal/undo",
  "import/analyze",
  "import/adopt",
  "validate",
  "plan",
  "apply",
  "recover",
  "export",
] as const;

export async function customizationResult(action: () => Promise<unknown>): Promise<RouteResult> {
  try {
    return { status: 200, body: { ok: true, value: await action() } };
  } catch (error) {
    if (error instanceof CustomizationError)
      return {
        status: error.status,
        body: {
          error: true,
          reason: error.code,
          message: error.message,
          ...(error.diagnostics ? { diagnostics: error.diagnostics } : {}),
        },
      };
    return {
      status: 500,
      body: {
        error: true,
        reason: "customization-failed",
        message: "カスタマイズ処理を完了できませんでした。保存先と実行環境を確認してください。",
      },
    };
  }
}

export async function routeCustomizationRead(
  service: CustomizationService | undefined,
  url: URL,
): Promise<RouteResult | null> {
  const route = url.pathname;
  if (route !== "/api/customization" && !route.startsWith("/api/customization/")) return null;
  if (!service)
    return {
      status: 503,
      body: { error: true, reason: "unavailable", message: "カスタマイズを利用できません。" },
    };
  const id = url.searchParams.get("id") ?? "";
  switch (route) {
    case "/api/customization":
      return await customizationResult(() =>
        service.catalog(url.searchParams.get("space") ?? undefined),
      );
    case "/api/customization/draft":
      return await customizationResult(() => service.draft());
    case "/api/customization/item":
      return await customizationResult(() => service.item(id));
    case "/api/customization/operation":
      return await customizationResult(() =>
        id ? service.operation(id) : service.activeOperation(),
      );
    case "/api/customization/request":
      return await customizationResult(() => service.request(id));
    case "/api/customization/proposal":
      return await customizationResult(async () => {
        service.assertEditable();
        return await service.proposals.get(id);
      });
    default:
      return null;
  }
}

export async function routeCustomizationPost(
  service: CustomizationService | undefined,
  action: string,
  body: unknown,
): Promise<RouteResult> {
  if (!service)
    return {
      status: 503,
      body: { error: true, reason: "unavailable", message: "カスタマイズを利用できません。" },
    };
  return await customizationResult(() => service.post(action, body));
}

export async function handleCustomizationPost(
  service: CustomizationService | undefined,
  action: string,
  request: Request,
): Promise<Response> {
  if (!acceptsCustomizationOrigin(request))
    return json(
      { error: true, reason: "origin-refused", message: "許可されていない送信元です。" },
      403,
    );
  try {
    const body = await readCustomizationBody(request);
    const result = await routeCustomizationPost(service, action, body);
    return json(result.body, result.status);
  } catch {
    return json(
      { error: true, reason: "bad-request", message: "入力形式またはサイズが不正です。" },
      400,
    );
  }
}
