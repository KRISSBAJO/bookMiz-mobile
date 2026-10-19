import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const ts = createRequire(import.meta.url)("typescript");
const result = {};
new Function("exports", ts.transpileModule(readFileSync(new URL("../src/lib/public-business-links.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(result);
test("business page links remain stable while external links reject demo and unsafe destinations", () => {
  assert.equal(result.businessPagePath("salon & spa"), "/marketplace/providers/salon%20%26%20spa");
  assert.equal(result.publicWebsiteUrl("bookmiz.com"), "https://bookmiz.com/");
  for (const value of [null, "", "https://fadelab.example.com", "https://example.net", "javascript:alert(1)", "file:///secret", "https://user:pass@bookmiz.com", "https://127.0.0.1", "https://[::1]", "https://business.local"]) assert.equal(result.publicWebsiteUrl(value), null, String(value));
});

