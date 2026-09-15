import { access } from "node:fs/promises";
import { delimiter, isAbsolute, join } from "node:path";
import { record } from "./validation";

// GitHub's programmatic reference documents piped prompts; -p would ignore stdin.
// The available-tools allowlist hides every tool except ask_user, then no-ask-user
// disables that remaining tool. Denials also guard the permission layer.
export const COPILOT_ARGUMENTS = [
  "--output-format=json",
  "--silent",
  "--no-ask-user",
  "--available-tools=ask_user",
  "--deny-tool=read,write,shell,url,memory",
  "--disable-builtin-mcps",
  "--no-custom-instructions",
  "--no-auto-update",
  "--no-bash-env",
  "--no-color",
  "--no-experimental",
  "--no-remote",
  "--no-remote-export",
  "--log-level=none",
];

export const COPILOT_REQUIRED_FLAGS = COPILOT_ARGUMENTS.map((arg) => arg.split("=")[0] ?? arg);

/** npm on Windows exposes a .cmd shim, but Node can launch its native package directly. */
export async function copilotCommands(
  pathValue = process.env.PATH ?? "",
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): Promise<string[]> {
  if (platform !== "win32") return ["copilot"];
  const candidates = new Set<string>();
  for (const entry of pathValue.split(delimiter)) {
    const directory = entry.replace(/^"|"$/g, "");
    if (!isAbsolute(directory)) continue;
    const modules = join(directory, "node_modules", "@github");
    candidates.add(join(modules, `copilot-win32-${arch}`, "copilot.exe"));
    candidates.add(
      join(modules, "copilot", "node_modules", "@github", `copilot-win32-${arch}`, "copilot.exe"),
    );
  }
  const readable = await Promise.all(
    Array.from(candidates, async (candidate) => {
      try {
        await access(candidate);
        return candidate;
      } catch {
        return undefined;
      }
    }),
  );
  return [
    "copilot",
    ...readable.filter((candidate): candidate is string => candidate !== undefined),
  ];
}

interface Message {
  text: string;
  final: boolean;
  hidden: boolean;
}

/**
 * Session messages use github/copilot-sdk nodejs/src/generated/session-events.ts.
 * The CLI additionally emits a terminal result with exitCode (official npm
 * @github/copilot-win32-x64 1.0.83, package/app.js). Turn end is not success:
 * persistence/export failures can still follow it before that terminal result.
 */
export class CopilotOutput {
  text = "";
  complete = false;
  private readonly messages = new Map<string, Message>();

  accept(event: Record<string, unknown>): void {
    const data = record(event.data) ? event.data : {};
    if (event.type === "session.error")
      throw new Error(`${data.errorType ?? "cli-failed"}: ${data.message ?? ""}`);
    if (event.type === "session.shutdown" && data.shutdownType === "error")
      throw new Error(typeof data.errorReason === "string" ? data.errorReason : "cli-failed");
    if (
      event.type === "abort" ||
      ((event.type === "session.idle" || event.type === "assistant.idle") && data.aborted === true)
    )
      throw new Error("cancelled");
    if (
      event.type === "tool.execution_start" ||
      event.type === "tool.user_requested" ||
      event.type === "subagent.started" ||
      event.type === "assistant.tool_call_delta" ||
      event.type === "external_tool.requested"
    )
      throw new Error("unexpected-tool");
    if (event.type === "result") {
      if (!Number.isInteger(event.exitCode)) throw new Error("protocol");
      if (event.exitCode !== 0) throw new Error("cli-failed");
      const visible = Array.from(this.messages.values()).filter((item) => !item.hidden);
      if (!visible.length || !visible.every((item) => item.final)) throw new Error("incomplete");
      this.complete = true;
      return;
    }
    if (event.agentId !== undefined || data.parentToolCallId !== undefined) return;
    if (
      event.type === "assistant.message" ||
      event.type === "assistant.message_delta" ||
      event.type === "assistant.message_start"
    ) {
      if (this.complete) throw new Error("protocol");
      if (typeof data.messageId !== "string") throw new Error("protocol");
      if (Array.isArray(data.toolRequests) && data.toolRequests.length)
        throw new Error("unexpected-tool");
      const message = this.messages.get(data.messageId) ?? {
        text: "",
        final: false,
        hidden: false,
      };
      if (typeof data.phase === "string")
        message.hidden = /^(thinking|analysis|reasoning)$/.test(data.phase);
      if (event.type === "assistant.message") {
        if (typeof data.content !== "string") throw new Error("protocol");
        message.text = data.content;
        message.final = true;
      } else if (event.type === "assistant.message_delta") {
        if (typeof data.deltaContent !== "string") throw new Error("protocol");
        if (!message.final) message.text += data.deltaContent;
      }
      this.messages.set(data.messageId, message);
      if (this.messages.size > 64) throw new Error("output-limit");
      this.text = Array.from(this.messages.values())
        .filter((item) => !item.hidden)
        .map((item) => item.text)
        .join("\n\n");
      this.complete = false;
    }
  }
}
