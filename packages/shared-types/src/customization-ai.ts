import type { CustomizationMutation, CustomizationProposal } from "./customization";
import type { DocsQaTool } from "./docs-qa";

export interface CustomizationAiRequest extends CustomizationMutation {
  draftId: string;
  tool: DocsQaTool;
  message: string;
  itemIds?: string[];
  materialIds?: string[];
}

export type CustomizationAiPhase =
  | "reserved"
  | "running"
  | "stopping"
  | "completed"
  | "cancelled"
  | "error"
  | "interrupted";

export interface CustomizationAiJob {
  id: string;
  requestId: string;
  draftId: string;
  draftRevision: number;
  configurationRevision: string;
  tool: DocsQaTool;
  message: string;
  phase: CustomizationAiPhase;
  answer: string;
  proposal?: CustomizationProposal;
  error?: string;
  createdAt: string;
  updatedAt: string;
  contextTruncated?: boolean;
}

export interface CustomizationAiConversation {
  draftId: string;
  jobs: CustomizationAiJob[];
}
export interface CustomizationAiMaterial {
  id: string;
  title: string;
  origin: string;
}
