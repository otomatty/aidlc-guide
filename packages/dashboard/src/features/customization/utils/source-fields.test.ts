import { describe, expect, it } from "vitest";
import {
  ruleBody,
  setJsonField,
  setRuleBody,
  setRuleHeading,
  setSourceBody,
  setSourceField,
  sourceField,
} from "@/features/customization/utils/source-fields";

it("keeps the rule heading and body consistent while preserving the remaining bytes", () => {
  const before = "## Previous\r\n\r\nKeep `literal` text.\r\n### Subheading\r\n";
  const renamed = setRuleHeading(before, "New");
  expect(renamed).toBe("## New\r\n\r\nKeep `literal` text.\r\n### Subheading\r\n");
  expect(ruleBody(renamed)).toBe("\r\nKeep `literal` text.\r\n### Subheading\r\n");
  expect(setRuleBody(renamed, "New", "Revised\r\n")).toBe("## New\r\nRevised\r\n");
  expect(setRuleBody("", "Added", "New policy\n")).toBe("## Added\nNew policy\n");
});

describe("structured source fields", () => {
  it.each(["\n", "\r\n"])(
    "preserves separation before comments on empty YAML values (%j)",
    (newline) => {
      const source = `---${newline}key:  # keep this comment${newline}unknown: true${newline}---${newline}Body`;
      const changed = setSourceField(source, "key", "value");
      expect(changed).toBe(source.replace("key:", 'key: "value"'));
      expect(sourceField(changed, "key")).toBe("value");
    },
  );
  it("updates a JSON value without reformatting unknown properties", () => {
    const source = '{\r\n  "name" : "before",\r\n  "unknown": { "retain": [1, 2] }\r\n}\r\n';
    expect(setJsonField(source, "name", "after")).toBe(source.replace('"before"', '"after"'));
  });
  it("preserves BOM, CRLF, unknown fields and inline comments when updating one field", () => {
    const source =
      "\uFEFF---\r\nname: old # keep this\r\ncustom: {a: 1}\r\n# comment\r\n---\r\nBody\r\n";
    const changed = setSourceField(source, "name", "new");
    expect(changed).toBe(source.replace("name: old", 'name: "new"'));
    expect(sourceField(changed, "custom")).toEqual({ a: 1 });
  });
  it("replaces a block value without swallowing the following field", () => {
    const source = "---\nscopes:\n  - first\n  - second\ncustom: kept\n---\nbody";
    const changed = setSourceField(source, "scopes", ["third"]);
    expect(sourceField(changed, "scopes")).toEqual(["third"]);
    expect(sourceField(changed, "custom")).toBe("kept");
    expect(changed.endsWith("---\nbody")).toBe(true);
  });
  it("preserves metadata when editing prose and refuses malformed metadata", () => {
    expect(setSourceBody("---\ncustom: yes\n---\nold", "new")).toBe("---\ncustom: yes\n---\nnew");
    expect(() => setSourceField("---\nname: [\n---\ntext", "name", "x")).toThrow();
  });
});
