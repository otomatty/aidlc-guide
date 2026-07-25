import { networkInterfaces } from "node:os";
import { HOST_EXPOSURE_WARNING } from "./server.ts";

/**
 * mob-mode M1: the addresses an operator hands to participants.
 *
 * The warning text itself is U5's (`HOST_EXPOSURE_WARNING`) and is imported,
 * never retyped — one wording, asserted in one place (S-MM-2). This module
 * only adds the "which URL do I paste into the group chat" half.
 */

export interface ExposureNotice {
  /** U5's constant. Names *what* becomes visible, not merely that a port opened. */
  readonly warning: string;
  /** `http://<ipv4>:<port>` — IPs and the port, nothing else (S-MM-4). */
  readonly addresses: readonly string[];
}

/** Printed above the list so the URLs read as an instruction, not as noise. */
export const EXPOSURE_ADDRESS_HEADING = "参加者に共有する URL:";

/**
 * Printed *instead of* the heading when nothing was enumerated (R-MM-2: 警告のみ,
 * never a label over an empty list). The exposure is real either way, so the
 * operator is told to find the address themselves rather than left guessing.
 */
export const EXPOSURE_NO_ADDRESS_HINT =
  "待受アドレスを自動検出できませんでした（外部 NIC なし、または列挙に失敗）。" +
  "公開自体は成立しています — `ipconfig` / `ifconfig` で自機の IPv4 を確認し、" +
  "`http://<そのIP>:<ポート>` を参加者に共有してください。";

/**
 * Called **once** at startup and held — never re-enumerated (P-MM-1). NIC
 * changes mid-session are out of scope; a stale list is a wrong URL the
 * operator can see, whereas re-enumeration on every render is a cost paid
 * forever.
 *
 * `host` is the fixed `--host` decision from process start. There is
 * deliberately no way to reach the LAN branch other than that flag: no env
 * var, no config file, no toggle (BR-MM-1 / S-MM-6).
 */
export function buildExposureNotice(port: number, host: boolean): ExposureNotice {
  return {
    warning: HOST_EXPOSURE_WARNING,
    addresses: host ? lanAddresses(port) : [`http://127.0.0.1:${port}`],
  };
}

/**
 * Externally reachable IPv4 only. Deliberately *not* included: `os.hostname()`,
 * the user name, or the workspace path — the point of the list is to be
 * pasteable into a chat, and anything else in it would be leaked context
 * (S-MM-4). IPv6 is skipped by decision, not oversight (tech-stack-decisions).
 */
function lanAddresses(port: number): string[] {
  try {
    return Object.values(networkInterfaces())
      .flatMap((nics) => nics ?? [])
      .filter((nic) => nic.family === "IPv4" && !nic.internal)
      .map((nic) => `http://${nic.address}:${port}`);
  } catch {
    // R-MM-2: the bind already succeeded, so the exposure is real whether or
    // not we can name it. Losing the convenience list must not lose the server.
    return [];
  }
}
