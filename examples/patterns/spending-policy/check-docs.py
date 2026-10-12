"""Verify the guide's new code excerpts against the executed fixture."""
from pathlib import Path
import re

example = Path(__file__).resolve().parent
repo = example.parents[2]
current = repo / "docs/builder/smart-contracts/patterns.md"
pinned = repo / "versioned_docs/version-0.17/builder/smart-contracts/patterns.md"
assert current.read_bytes() == pinned.read_bytes(), "Patterns mirrors differ"
section = current.read_text().split("## Spending policy {#spending-policy}\n", 1)[1]
section = section.split("## Security\n", 1)[0]
blocks = re.findall(r"```(?:masm|rust)\n(.*?)\n```", section, re.S)
masm = (example / "masm/policy.masm").read_text().rstrip()
rust = (example / "tests/policy.rs").read_text()
construction = rust[rust.index("    let asset = FungibleAsset::mock"):
                    rust.index("    let recipient = builder.add_existing_wallet")].rstrip()
assert blocks == [masm, construction], "Guide code differs from executable source"
for relative in ["index.md", "rust/index.md", "overview.md"]:
    current_text = (repo / "docs/builder/smart-contracts" / relative).read_text()
    pinned_text = (repo / "versioned_docs/version-0.17/builder/smart-contracts" / relative).read_text()
    assert "fixed spending allowances" in current_text
    assert "fixed spending allowances" in pinned_text
print("PASS: both code excerpts match tested files; current/v0.17 mirrors match")
