import { describe, expect, it, vi } from "vitest";
import { fetchReleaseMetadata } from "../src/release-lookup.ts";
import { updateConfirmDetail } from "../src/update-feedback.ts";
import {
  type LatestRelease,
  parseLatestRelease,
  parseReleaseMetadata,
  RELEASE_METADATA_ASSET,
  releaseWorkflowsChange,
} from "../src/update-release.ts";

const DOWNLOAD = "https://github.com/otomatty/aidlc-guide/releases/download/v0.40.0";

function release(assets: unknown[]): unknown {
  return { tag_name: "v0.40.0", draft: false, prerelease: false, body: "", assets };
}

const vsix = { name: "aidlc-guide-0.40.0.vsix", browser_download_url: `${DOWNLOAD}/x.vsix` };

describe("parseLatestRelease metadata", () => {
  it("keeps the metadata asset's download URL", () => {
    const parsed = parseLatestRelease(
      release([
        vsix,
        { name: RELEASE_METADATA_ASSET, browser_download_url: `${DOWNLOAD}/${RELEASE_METADATA_ASSET}` },
      ]),
    );
    expect(parsed).toMatchObject({
      ok: true,
      value: { metadataUrl: `${DOWNLOAD}/${RELEASE_METADATA_ASSET}` },
    });
  });

  it("has no metadata for an older release without the asset", () => {
    const parsed = parseLatestRelease(release([vsix]));
    expect(parsed.ok && parsed.value.metadataUrl).toBeUndefined();
  });

  it("ignores a metadata asset served from anywhere but this repository's releases", () => {
    const parsed = parseLatestRelease(
      release([
        vsix,
        { name: RELEASE_METADATA_ASSET, browser_download_url: "https://example.com/meta.json" },
      ]),
    );
    expect(parsed.ok && parsed.value.metadataUrl).toBeUndefined();
  });
});

describe("parseReleaseMetadata", () => {
  it("reads the supported aidlc-workflows release", () => {
    expect(
      parseReleaseMetadata({ schemaVersion: 1, version: "0.40.0", workflowsTarget: "2.11.0" }),
    ).toEqual({ version: "0.40.0", workflowsTarget: "2.11.0" });
  });

  it.each([
    null,
    "2.11.0",
    { schemaVersion: 2, version: "0.40.0", workflowsTarget: "2.11.0" },
    { schemaVersion: 1, version: "0.40.0", workflowsTarget: "latest" },
    { schemaVersion: 1, workflowsTarget: "2.11.0" },
  ])("rejects %j", (body) => {
    expect(parseReleaseMetadata(body)).toBeNull();
  });
});

describe("releaseWorkflowsChange", () => {
  const metadata = { version: "0.40.0", workflowsTarget: "2.11.0" };

  it("reports a release that moves the supported aidlc-workflows release", () => {
    expect(releaseWorkflowsChange("2.10.0", metadata)).toEqual({ from: "2.10.0", to: "2.11.0" });
  });

  it("is quiet when the supported release stays, or nothing is known", () => {
    expect(releaseWorkflowsChange("2.11.0", metadata)).toBeNull();
    expect(releaseWorkflowsChange("2.10.0", null)).toBeNull();
  });
});

describe("updateConfirmDetail with a supported-release change", () => {
  it("leads with what the person must do afterwards", () => {
    const detail = updateConfirmDetail("0.40.0", ["修正"], { from: "2.10.0", to: "2.11.0" });
    expect(detail?.split("\n")[0]).toBe(
      "この更新後は、プロジェクトの aidlc-workflows を 2.10.0 から 2.11.0 に更新するまで AIDLC Guide を使えません。",
    );
    expect(detail).toContain("リポジトリへのコミットが必要です");
    expect(detail).toContain("今は更新しない場合は、このダイアログを閉じてください。");
    expect(detail).toContain("0.40.0 の主な変更:\n・修正");
  });

  it("still warns when the release lists no changes", () => {
    expect(updateConfirmDetail("0.40.0", [], { from: "2.10.0", to: "2.11.0" })).toContain(
      "2.11.0 に更新するまで",
    );
  });
});

describe("fetchReleaseMetadata", () => {
  const withUrl: LatestRelease = {
    version: "0.40.0",
    tag: "v0.40.0",
    assetName: "aidlc-guide-0.40.0.vsix",
    notes: [],
    metadataUrl: `${DOWNLOAD}/${RELEASE_METADATA_ASSET}`,
  };

  it("downloads and parses the asset", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ schemaVersion: 1, version: "0.40.0", workflowsTarget: "2.11.0" }),
    );
    await expect(fetchReleaseMetadata(withUrl, fetchImpl)).resolves.toEqual({
      version: "0.40.0",
      workflowsTarget: "2.11.0",
    });
    expect(fetchImpl).toHaveBeenCalledWith(withUrl.metadataUrl, expect.anything());
  });

  it("is null without a URL, on an HTTP error, a network error, or a mismatched version", async () => {
    const { metadataUrl: _, ...withoutUrl } = withUrl;
    const never = vi.fn();
    await expect(fetchReleaseMetadata(withoutUrl, never)).resolves.toBeNull();
    expect(never).not.toHaveBeenCalled();
    await expect(
      fetchReleaseMetadata(withUrl, async () => new Response("", { status: 404 })),
    ).resolves.toBeNull();
    await expect(
      fetchReleaseMetadata(withUrl, async () => {
        throw new Error("offline");
      }),
    ).resolves.toBeNull();
    await expect(
      fetchReleaseMetadata(withUrl, async () =>
        Response.json({ schemaVersion: 1, version: "0.39.0", workflowsTarget: "2.11.0" }),
      ),
    ).resolves.toBeNull();
  });
});
