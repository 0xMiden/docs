import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import YAML from "yaml";

const require = createRequire(import.meta.url);
const workflow = YAML.parse(readFileSync(new URL("../.github/workflows/cut-versions.yml", import.meta.url), "utf8"));
const steps = workflow.jobs.cut.steps;
const parser = steps.find((step) => step.id === "manifest");
const parseCode = parser.run.match(/node - <<'NODE'\n([\s\S]*?)\nNODE/)[1];

function parse({ inputs = {}, present = [] } = {}) {
  const outputs = {};
  const env = Object.fromEntries(Object.entries(parser.env || {}).map(([key, value]) => {
    const input = value.match(/inputs\.([a-z_]+)/)?.[1];
    return [key, inputs[input] || ""];
  }));
  env.GITHUB_OUTPUT = "__outputs__";
  const files = {
    ".release/release-manifest.yml": "version: '0.16'\nrefs:\n  tutorials: pinned-tutorial-commit\n",
    "versions.json": JSON.stringify(present.includes("version-list") ? ["0.16", "0.15"] : ["0.15"]),
  };
  const paths = new Set(Object.keys(files));
  if (present.includes("directory")) paths.add("versioned_docs/version-0.16");
  if (present.includes("sidebar")) paths.add("versioned_sidebars/version-0.16-sidebars.json");
  vm.runInNewContext(parseCode, {
    require: (name) => name === "fs" ? {
      existsSync: (path) => paths.has(path),
      readFileSync: (path) => { assert.ok(path in files, `unexpected read: ${path}`); return files[path]; },
      appendFileSync: (path, contents) => {
        assert.equal(path, env.GITHUB_OUTPUT);
        for (const line of contents.trimEnd().split("\n")) {
          const separator = line.indexOf("=");
          assert.ok(separator > 0, `invalid output line: ${line}`);
          outputs[line.slice(0, separator)] = line.slice(separator + 1);
        }
      },
    } : require(name),
    process: { env, exit: (code) => { throw new Error(`exit ${code}`); } },
    console: { error() {}, log() {} },
  });
  return outputs;
}

test("manifest outputs use GITHUB_OUTPUT instead of the deprecated command", () => {
  assert.match(parseCode, /GITHUB_OUTPUT/);
  assert.doesNotMatch(parseCode, /::set-output/);
});

test("manual version and source overrides reach the parser instead of silently using the manifest", () => {
  const outputs = parse({ inputs: {
    version_label: "0.99", miden_node_ref: "node-pin", miden_vm_ref: "vm-pin",
    miden_base_ref: "protocol-pin", miden_client_ref: "client-pin", compiler_ref: "compiler-pin",
    miden_tutorials_ref: "tutorial-pin", guardian_ref: "guardian-pin",
    note_transport_ref: "transport-pin", bridge_portal_ref: "bridge-pin",
  } });
  assert.equal(outputs.version_label, "0.99");
  for (const [key, expected] of Object.entries({ miden_node_ref: "node-pin", miden_vm_ref: "vm-pin",
    miden_base_ref: "protocol-pin", miden_client_ref: "client-pin", compiler_ref: "compiler-pin",
    miden_tutorials_ref: "tutorial-pin", guardian_ref: "guardian-pin", note_transport_ref: "transport-pin",
    bridge_portal_ref: "bridge-pin" })) assert.equal(outputs[key], expected);
});

test("absent snapshot is eligible for generation and uses manifest defaults", () => {
  const outputs = parse();
  assert.equal(outputs.version_label, "0.16");
  assert.equal(outputs.miden_tutorials_ref, "pinned-tutorial-commit");
  assert.equal(outputs.snapshot_exists, "false");
});

test("complete checked-in snapshot validates refs but skips generation and cleanup", () => {
  const outputs = parse({ present: ["version-list", "directory", "sidebar"] });
  assert.equal(outputs.snapshot_exists, "true");
  const validationStep = steps.find((step) => step.name === "Validate refs exist");
  assert.equal(validationStep.if, undefined, "source refs must still be validated");
  for (const step of steps.slice(steps.indexOf(validationStep) + 1)) {
    const condition = (step.if || "true").replace(/\$\{\{|\}\}/g, "")
      .replaceAll("steps.manifest.outputs.snapshot_exists", JSON.stringify(outputs.snapshot_exists));
    assert.equal(vm.runInNewContext(condition), false, `${step.name} would run on an existing snapshot`);
  }
});

for (const present of [["directory"], ["version-list"], ["sidebar"], ["version-list", "directory"]]) {
  test(`partial snapshot is rejected: ${present.join("+")}`, () => assert.throws(() => parse({ present })));
}

const validation = steps.find((step) => step.name === "Validate refs exist").run.split('\nvalidate "${REPO_NODE}"')[0];
const sha = "965739b626acf3c63a0e547d313859079ee03c18";
function validate(ref, apiSha = sha) {
  const boundary = `
git() { if [[ "$3" == "refs/tags/v0.16.0" ]]; then echo "${sha} refs/tags/v0.16.0"; fi; }
gh() { [[ "$1" == "api" && "$2" == "repos/0xMiden/tutorials/git/commits/${sha}" ]] || return 1; [[ -n "$API_SHA" ]] || return 1; echo "$API_SHA"; }
`;
  return spawnSync("bash", ["-c", `${boundary}\n${validation}\nvalidate 0xMiden/tutorials "$TEST_REF"`], {
    env: { ...process.env, TEST_REF: ref, API_SHA: apiSha }, encoding: "utf8",
  });
}
test("an existing exact commit pin is accepted", () => assert.equal(validate(sha).status, 0));
test("a missing exact commit is rejected", () => assert.notEqual(validate(sha, "").status, 0));
test("a mismatched commit response is rejected", () => assert.notEqual(validate(sha, "0".repeat(40)).status, 0));
test("normal tag validation still works", () => assert.equal(validate("refs/tags/v0.16.0").status, 0));
test("an unknown tag is rejected", () => assert.notEqual(validate("refs/tags/missing").status, 0));
