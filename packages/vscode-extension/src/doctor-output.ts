import { stripVTControlCharacters } from "node:util";
import { translateDoctorText } from "./doctor-messages-ja.ts";

export type NativeDoctorCheck = {
  section: "machine" | "project" | "framework" | "other";
  status: "ok" | "warn" | "fail";
  label: string;
  fix?: string;
  originalLabel: string;
  originalFix?: string;
  translated: boolean;
  fixTranslated?: boolean;
};

export type NativeDoctorReport = {
  version: string;
  executedAt: string;
  outcome: "ok" | "warning" | "failed" | "unavailable";
  summary: string;
  checks: NativeDoctorCheck[];
  counts: { passed: number; warnings: number; failed: number } | null;
  rawOutput: string;
  unparsedOutput: string[];
};

type DoctorCommandResult = {
  code: number;
  stdout: string;
  stderr: string;
  failure?: "timeout" | "spawn" | "aborted" | "buffer" | "signal";
};

// These versions share aidlc-doctor.ts's humanReport grammar. Add a version only
// after checking its renderer, including findings omitted from JSON output.
const SUPPORTED_VERSIONS = new Set(["2.8.0", "2.8.1"]);
const MAX_PARSE_LENGTH = 2 * 1024 * 1024;
const MAX_PARSE_LINES = 20_000;
const SECTION_ORDER = ["machine", "project", "framework"] as const;
const FAILURE_SUMMARIES = {
  timeout: "診断が制限時間内に完了しませんでした。取得できた原文を確認してください。",
  spawn: "診断コマンドを起動できませんでした。実行環境を確認してください。",
  aborted: "診断を中止しました。必要に応じて再実行してください。",
  buffer: "診断の出力が上限を超えたため、処理を中止しました。取得できた原文を確認してください。",
  signal: "診断コマンドが途中で終了しました。取得できた原文を確認してください。",
} satisfies Record<NonNullable<DoctorCommandResult["failure"]>, string>;

function sectionFor(line: string): NativeDoctorCheck["section"] | undefined {
  if (line === "Machine") return "machine";
  if (/^Project(?: \(.+\))?$/.test(line)) return "project";
  if (line === "Framework integrity") return "framework";
  return undefined;
}

function translateCheck(check: NativeDoctorCheck): void {
  const label = translateDoctorText(check.originalLabel, "label");
  check.label = label ?? "日本語訳が未対応の診断項目です。原文を確認してください。";
  check.translated = label !== null;
  if (check.originalFix !== undefined) {
    const fix = translateDoctorText(check.originalFix, "fix");
    check.fix = fix ?? "日本語訳が未対応の対処方法です。原文を確認してください。";
    check.fixTranslated = fix !== null;
  }
}

/** Parse the complete verbose report; a partial or unfamiliar report is never healthy. */
export function parseDoctorOutput(
  result: DoctorCommandResult,
  version: string,
  executedAt = new Date().toISOString(),
): NativeDoctorReport {
  const rawOutput = result.stderr
    ? `${result.stdout}${result.stdout ? (result.stdout.endsWith("\n") ? "\n" : "\n\n") : ""}[標準エラー出力]\n${result.stderr}`
    : result.stdout;
  const report: NativeDoctorReport = {
    version,
    executedAt,
    outcome: "unavailable",
    summary: "診断結果を読み取れませんでした。原文を確認してください。",
    checks: [],
    counts: null,
    rawOutput,
    unparsedOutput: [],
  };
  const fallback = (summary: string): NativeDoctorReport => {
    report.summary = result.failure ? FAILURE_SUMMARIES[result.failure] : summary;
    report.unparsedOutput = rawOutput.trim() ? [rawOutput] : [];
    return report;
  };
  if (!SUPPORTED_VERSIONS.has(version.trim().replace(/^v/, ""))) {
    return fallback(
      `AI-DLC ${version} の診断形式はまだ日本語表示に対応していません。原文を確認してください。`,
    );
  }
  if (rawOutput.length > MAX_PARSE_LENGTH) {
    return fallback("診断結果が大きいため解析できませんでした。原文を確認してください。");
  }
  const lines = stripVTControlCharacters(result.stdout).replace(/\r\n?/g, "\n").split("\n");
  if (lines.length > MAX_PARSE_LINES) {
    return fallback("診断結果の行数が多いため解析できませんでした。原文を確認してください。");
  }

  let sawHeader = false;
  let section: NativeDoctorCheck["section"] = "other";
  let sectionCount = 0;
  let malformed = false;
  let footer: { failed: number; warnings: number } | undefined;
  let activeCheck: NativeDoctorCheck | undefined;
  let activeFix: NativeDoctorCheck | undefined;
  const finishCheck = (): void => {
    if (activeCheck && activeCheck.status !== "ok" && !activeCheck.originalFix?.trim()) {
      malformed = true;
    }
    activeCheck = undefined;
    activeFix = undefined;
  };

  for (const line of lines) {
    if (!line.trim()) {
      activeFix = undefined;
      continue;
    }
    if (line === "AI-DLC doctor" && !sawHeader && sectionCount === 0) {
      sawHeader = true;
      continue;
    }
    const nextSection = sectionFor(line);
    if (nextSection && sawHeader && !footer) {
      finishCheck();
      if (SECTION_ORDER[sectionCount] !== nextSection) malformed = true;
      section = nextSection;
      sectionCount++;
      continue;
    }
    const total = /^(\d+) problems?, (\d+) warnings?\.$/.exec(line);
    if (total && !footer && sawHeader) {
      finishCheck();
      footer = { failed: Number(total[1]), warnings: Number(total[2]) };
      if (!Number.isSafeInteger(footer.failed) || !Number.isSafeInteger(footer.warnings)) {
        malformed = true;
      }
      continue;
    }
    if (
      (line === "Warnings are advisory - if everything works, ignore them." &&
        footer &&
        footer.warnings > 0) ||
      (line === "Your install is ready." && footer?.failed === 0 && footer.warnings === 0)
    ) {
      continue;
    }
    const row = /^ {2}(ok|warn|fail) +(.+)$/.exec(line);
    if (row && sawHeader && section !== "other" && !footer) {
      finishCheck();
      const originalLabel = row[2]?.trim() ?? "";
      // Non-verbose aggregate rows do not identify the individual checks.
      if (!originalLabel || /^(?:all )?\d+ checks passed$/.test(originalLabel)) {
        malformed = true;
        report.unparsedOutput.push(line);
        continue;
      }
      activeCheck = {
        section,
        status: row[1] as NativeDoctorCheck["status"],
        label: "",
        originalLabel,
        translated: false,
      };
      report.checks.push(activeCheck);
      continue;
    }
    const fix = /^ {8}fix: ?(.*)$/.exec(line);
    if (fix && activeCheck && activeCheck.originalFix === undefined && !footer) {
      if (activeCheck.status === "ok") malformed = true;
      activeCheck.originalFix = fix[1] ?? "";
      activeFix = activeCheck;
      continue;
    }
    // The renderer interpolates remedies verbatim, including unindented newlines.
    // A blank line ends the remedy; unfamiliar status rows must remain unparsed.
    if (activeFix && !fix && !/^ {2}\S+ +/.test(line) && !footer) {
      activeFix.originalFix += `\n${line}`;
      continue;
    }
    activeFix = undefined;
    report.unparsedOutput.push(line);
  }
  finishCheck();
  for (const check of report.checks) translateCheck(check);
  if (result.stderr.trim()) report.unparsedOutput.push(`[標準エラー出力]\n${result.stderr}`);

  const counts = { passed: 0, warnings: 0, failed: 0 };
  for (const check of report.checks) {
    if (check.status === "ok") counts.passed++;
    else if (check.status === "warn") counts.warnings++;
    else counts.failed++;
  }
  const complete =
    sawHeader &&
    sectionCount === SECTION_ORDER.length &&
    footer !== undefined &&
    report.checks.length > 0 &&
    !malformed;
  const countsMatch = footer?.failed === counts.failed && footer.warnings === counts.warnings;
  if (complete && countsMatch) report.counts = counts;

  if (result.failure) {
    report.summary = FAILURE_SUMMARIES[result.failure];
  } else if (!complete) {
    report.summary = "診断結果が不完全、または未対応の形式です。原文を確認して再実行してください。";
  } else if (!countsMatch) {
    report.summary = "診断項目と集計の件数が一致しません。原文を確認してください。";
  } else if (result.code !== 0 && counts.failed === 0) {
    report.summary = `診断コマンドが終了コード ${result.code} で終了しました。原文を確認してください。`;
  } else {
    const untranslated = report.checks.some(
      (check) => !check.translated || check.fixTranslated === false,
    );
    report.outcome = counts.failed > 0 ? "failed" : counts.warnings > 0 ? "warning" : "ok";
    report.summary = `正常 ${counts.passed} 件、要確認 ${counts.warnings} 件、問題あり ${counts.failed} 件です。`;
    if (report.unparsedOutput.length > 0) {
      if (report.outcome === "ok") report.outcome = "warning";
      report.summary += " 解析できない出力があります。原文を確認してください。";
    }
    if (untranslated) {
      if (report.outcome === "ok") report.outcome = "warning";
      report.summary += " 日本語訳が未対応の項目があります。各項目の原文を確認してください。";
    }
  }
  return report;
}
