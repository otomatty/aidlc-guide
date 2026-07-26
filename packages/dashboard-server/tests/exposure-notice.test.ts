import { readdir, readFile } from "node:fs/promises";
import type { NetworkInterfaceInfo } from "node:os";
import { hostname, userInfo } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * mob-mode M1. `node:os` is mocked so the enumeration, the failure path and
 * the loopback case are all deterministic — the real NIC table of whichever
 * machine runs the suite is not a test fixture.
 */

let interfaces: () => NodeJS.Dict<NetworkInterfaceInfo[]>;

vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os");
  return { ...actual, networkInterfaces: () => interfaces() };
});

const { buildExposureNotice, EXPOSURE_ADDRESS_HEADING } = await import("../src/exposure-notice.ts");
const { HOST_EXPOSURE_WARNING } = await import("../src/server.ts");

function nic(overrides: Partial<NetworkInterfaceInfo>): NetworkInterfaceInfo {
  return {
    address: "192.168.1.20",
    netmask: "255.255.255.0",
    family: "IPv4",
    mac: "aa:bb:cc:dd:ee:ff",
    internal: false,
    cidr: "192.168.1.20/24",
    ...overrides,
  } as NetworkInterfaceInfo;
}

beforeEach(() => {
  interfaces = () => ({
    lo: [nic({ address: "127.0.0.1", internal: true, cidr: "127.0.0.1/8" })],
    "Wi-Fi": [
      nic({ address: "192.168.1.20" }),
      nic({ address: "fe80::1", family: "IPv6", cidr: "fe80::1/64" }),
    ],
    Ethernet: [nic({ address: "10.0.5.7", cidr: "10.0.5.7/24" })],
    Down: undefined,
  });
});

describe("buildExposureNotice (M1 / S-MM-4)", () => {
  it("lists every externally reachable IPv4 and nothing else", () => {
    const notice = buildExposureNotice(4700, true);
    expect(notice.addresses).toEqual(["http://192.168.1.20:4700", "http://10.0.5.7:4700"]);
  });

  it("carries U5's warning wording (BR-MM-2)", () => {
    expect(buildExposureNotice(4700, true).warning).toBe(HOST_EXPOSURE_WARNING);
    // The warning has to name what becomes visible, not just that a port opened.
    for (const word of ["成果物", "監査", "秘密"]) {
      expect(HOST_EXPOSURE_WARNING).toContain(word);
    }
  });

  /**
   * S-MM-2 asks for **one** implementation of the wording, and value equality
   * cannot show that: `toBe` on a string passes just as happily for a retyped
   * literal. So check it structurally — the sentence exists in exactly one
   * source file, and this module reaches it by import.
   */
  it("keeps the wording in exactly one source file (S-MM-2)", async () => {
    const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
    const owners: string[] = [];
    for (const entry of await readdir(src, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
      const file = path.join(entry.parentPath, entry.name);
      if ((await readFile(file, "utf8")).includes("警告: LAN に公開します")) {
        owners.push(path.relative(src, file));
      }
    }
    expect(owners).toEqual(["server.ts"]);

    const mine = await readFile(path.join(src, "exposure-notice.ts"), "utf8");
    expect(mine).toContain('import { HOST_EXPOSURE_WARNING } from "./server.ts"');
  });

  it("leaks no hostname, user name or workspace path (S-MM-4)", () => {
    const printed = [EXPOSURE_ADDRESS_HEADING, ...buildExposureNotice(4700, true).addresses].join(
      "\n",
    );

    for (const secret of [hostname(), userInfo().username, process.cwd()]) {
      // Guard against a vacuous pass if any of these were somehow empty.
      expect(secret.length).toBeGreaterThan(0);
      expect(printed).not.toContain(secret);
    }
    for (const address of buildExposureNotice(4700, true).addresses) {
      expect(address).toMatch(/^http:\/\/\d{1,3}(\.\d{1,3}){3}:\d+$/);
    }
  });

  it("keeps the loopback startup to the one address that exists", () => {
    expect(buildExposureNotice(4700, false).addresses).toEqual(["http://127.0.0.1:4700"]);
  });

  it("survives an enumeration failure with an empty list (R-MM-2)", () => {
    interfaces = () => {
      throw new Error("EPERM: cannot enumerate interfaces");
    };
    const notice = buildExposureNotice(4700, true);
    expect(notice.addresses).toEqual([]);
    // The exposure is real whether or not we can name it — the warning stays.
    expect(notice.warning).toBe(HOST_EXPOSURE_WARNING);
  });

  it("reports no address when the machine has only loopback", () => {
    interfaces = () => ({ lo: [nic({ address: "127.0.0.1", internal: true })] });
    expect(buildExposureNotice(4700, true).addresses).toEqual([]);
  });
});
