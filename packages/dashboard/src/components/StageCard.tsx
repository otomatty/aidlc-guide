import type { NextStep, StageDoc } from "@aidlc-guide/shared-types";
import type { ReactNode } from "react";
import { deepLinkHref } from "../services/docs.ts";
import { NextStepCallout } from "./NextStepCallout.tsx";

/**
 * US-03 / FR-4.4: the four fields are mandatory — purpose, in/out, agent, gate
 * requirement — plus the docs deep link (US-23). Every field is rendered as
 * structured JSX; the excerpt is plain text in a `<pre>` and never HTML
 * (S-UI-3 — Markdown rendering is the artifact-viewer unit's job).
 */

export interface StageCardProps {
  doc: StageDoc;
  isCurrent: boolean;
  nextStep?: NextStep;
  onOpenStage: (slug: string) => void;
}

function List({ label, items }: { label: string; items: string[] }): ReactNode {
  return (
    <div className="card__field">
      <span className="card__label">{label}</span>
      {items.length === 0 ? (
        <span className="card__value">（なし）</span>
      ) : (
        <ul className="card__list">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function StageCard({ doc, isCurrent, nextStep, onOpenStage }: StageCardProps): ReactNode {
  const href = deepLinkHref(doc.deepLink);

  return (
    <article className="card" data-testid={`stage-card-${doc.slug}`}>
      <div className="card__field">
        <span className="card__label">目的</span>
        <p className="card__value">{doc.purpose}</p>
      </div>
      <List label="入力" items={doc.inputs} />
      <List label="出力" items={doc.outputs} />
      <div className="card__field">
        <span className="card__label">担当エージェント</span>
        <span className="card__value">{doc.agent}</span>
      </div>
      <div className="card__field">
        <span className="card__label">ゲート要求</span>
        <p className="card__value">{doc.gateRequirement}</p>
      </div>

      {href === null ? null : (
        <p className="card__link">
          <a href={href} rel="noopener noreferrer">
            docs を開く
          </a>
          <span className="card__source">（sync: {doc.sourceVersion}）</span>
        </p>
      )}

      {doc.excerpt === null ? null : (
        <details className="card__excerpt">
          <summary>docs の該当箇所</summary>
          <pre>{doc.excerpt}</pre>
        </details>
      )}

      {/* US-02 only applies to the stage you are standing on. */}
      {isCurrent && nextStep !== undefined ? (
        <NextStepCallout nextStep={nextStep} onOpenNext={onOpenStage} />
      ) : null}
    </article>
  );
}
