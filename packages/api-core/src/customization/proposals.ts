import { randomUUID } from "node:crypto";
import type {
  CustomizationDraft,
  CustomizationMutation,
  CustomizationProposal,
  CustomizationProposalInput,
} from "@aidlc-guide/shared-types";
import type { CustomizationDraftStore } from "./draft-store.ts";
import { applyChanges, fail, localIdentifier, parseChanges } from "./model.ts";
import type { CustomizationStorage } from "./storage.ts";

export class CustomizationProposals {
  constructor(
    private storage: CustomizationStorage,
    private drafts: CustomizationDraftStore,
  ) {}
  async create(
    input: CustomizationProposalInput,
    draftId: string,
    expectedRevision: number,
    contextHash?: string,
  ): Promise<CustomizationProposal> {
    const draft = await this.drafts.require(draftId, expectedRevision);
    if (typeof input.summary !== "string" || input.summary.length > 20_000)
      return fail("bad-request", "提案の要約が不正です。");
    const changes = parseChanges(input.changes);
    applyChanges(draft.items, changes);
    const proposal: CustomizationProposal = {
      id: randomUUID(),
      summary: input.summary,
      draftId,
      draftRevision: expectedRevision,
      configurationRevision: draft.baseConfigurationRevision,
      changes,
      createdAt: new Date().toISOString(),
      ...(contextHash ? { contextHash } : {}),
    };
    await this.storage.writeJson(`proposals/${proposal.id}.json`, proposal);
    return proposal;
  }
  async get(id: string): Promise<CustomizationProposal> {
    if (!localIdentifier(id)) return fail("bad-request", "提案IDが不正です。");
    return (
      (await this.storage.readJson<CustomizationProposal>(`proposals/${id}.json`)) ??
      fail("proposal-not-found", "提案がありません。", 404)
    );
  }
  async adopt(
    header: CustomizationMutation,
    id: string,
    configurationRevision?: string,
  ): Promise<CustomizationDraft> {
    const proposal = await this.get(id);
    if (
      proposal.draftId !== header.draftId ||
      proposal.draftRevision !== header.expectedDraftRevision
    )
      return fail("proposal-stale", "下書きが変わりました。新しい提案を作成してください。", 409);
    return await this.drafts.adopt(
      header,
      id,
      proposal.changes,
      "proposal",
      undefined,
      configurationRevision,
    );
  }
}
