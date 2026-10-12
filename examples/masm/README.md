# MASM v0.17 guide examples

These projects execute the code in the [first project](../../docs/builder/smart-contracts/masm/first-project.md), [account component](../../docs/builder/smart-contracts/masm/account-components.md), and [note script](../../docs/builder/smart-contracts/masm/note-scripts.md) guides. They use Rust 1.98.1, protocol/standards/testing 0.17.1, and VM 0.35.0. Each project includes its own lockfile and runs independently of any enclosing Cargo workspace.

Run from the repository root:

```bash
cargo +1.98.1 run --locked --manifest-path examples/masm/first-project/Cargo.toml
cargo +1.98.1 run --locked --manifest-path examples/masm/account-components/Cargo.toml
cargo +1.98.1 run --locked --manifest-path examples/masm/note-scripts/Cargo.toml
cargo +1.98.1 test --locked --manifest-path examples/masm/note-scripts/Cargo.toml
node examples/masm/check-guide-examples.mjs
```

Expected runner outputs are `area: 42`, `settings value: 7 -> 42`, and `settings value: 7 -> 42; note consumed`. The six note tests cover successful consumption, nonzero consumption arguments, empty/oversized storage, unexpected assets, and missing consumer authentication.

The note example includes the account example's `settings.masm` source. Keep both directories together. MockChain exercises the transaction kernel with test accounts, signers, and testing proofs; these projects require no live node or account funding.

The Node check compares every titled source block with the executable files and checks that current and v0.17 guide copies are identical.
