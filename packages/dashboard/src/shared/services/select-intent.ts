import { getTransport, type PostJsonResult } from "@/services/transport/index.ts";

export async function selectIntent(name: string, expectedSpace: string): Promise<PostJsonResult> {
  return await getTransport().postJson("/api/select-intent", { intent: name, expectedSpace });
}
