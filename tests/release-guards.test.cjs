const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const YAML = require("yaml");
test("pushes and default manual runs cannot trigger a native Android build", () => {
  const workflow = YAML.parse(
    readFileSync(
      path.join(__dirname, "../.github/workflows/android-test-build.yml"),
      "utf8",
    ),
  );
  assert.equal(
    workflow.on.workflow_dispatch.inputs.buildAndroid.default,
    false,
  );
  assert.equal(
    workflow.jobs.android.if,
    "github.event_name == 'workflow_dispatch' && inputs.buildAndroid",
  );
  assert.equal(workflow.jobs.android.needs, "checks");
  assert.ok(
    !workflow.jobs.checks.steps.some((step) =>
      /prebuild|assemble|eas build/.test(step.run || ""),
    ),
  );
});
test("BookMiz keeps its existing Expo project and Apple app identifier", () => {
  const { expo } = require("../app.json");
  assert.equal(expo.owner, "gatherplus");
  assert.equal(expo.slug, "bookmiz");
  assert.equal(
    expo.extra.eas.projectId,
    "ca508477-5d3d-40ff-9f9c-6c0faae889bf",
  );
  assert.equal(expo.ios.bundleIdentifier, "com.anonymous.bookmiz");
  assert.equal(expo.runtimeVersion.policy, "fingerprint");
});
