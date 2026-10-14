# MASM v0.17 guide examples

These projects execute the code in the [first project](../../docs/builder/smart-contracts/masm/first-project.md), [account component](../../docs/builder/smart-contracts/masm/account-components.md), and [note script](../../docs/builder/smart-contracts/masm/note-scripts.md) guides. They use Rust 1.98.1, protocol/standards/testing 0.17.1, and VM 0.35.0. Each project includes its own lockfile and runs independently of any enclosing Cargo workspace.

Run from the repository root:

```bash
cargo +1.98.1 run --locked --manifest-path examples/masm/first-project/Cargo.toml
cargo +1.98.1 run --locked --manifest-path examples/masm/account-components/Cargo.toml
cargo +1.98.1 run --locked --manifest-path examples/masm/note-scripts/Cargo.toml
cargo +1.98.1 test --locked --manifest-path examples/masm/note-scripts/Cargo.toml
cargo +1.98.1 test --locked --manifest-path examples/masm/regressions/Cargo.toml
```

Expected runner outputs are `area: 42`, `settings value: 7 -> 42`, and `settings value: 7 -> 42; note consumed`. The six note tests cover successful consumption, nonzero consumption arguments, empty/oversized storage, unexpected assets, and missing consumer authentication.

The additional regression suite checks field boundaries, missing account authentication, unavailable Settings procedures, consumption by a different authorized compatible account, and rejection of a second committed consumption.

The note example includes the account example's `settings.masm` source. Keep both directories together. MockChain exercises the transaction kernel with test accounts, signers, and testing proofs; these projects require no live node or account funding.

The TypeScript checkers require Node.js 20.20.2 or later. From the repository root, install their pinned tools, type-check the scripts, run their regression tests, and compare every titled source block with the executable files and the current/v0.17 mirrors:

```bash
npm ci --prefix examples/masm
npm --prefix examples/masm run typecheck
npm --prefix examples/masm run test:checkers
npm --prefix examples/masm run check:guides
```

The checker tools are separate from the docs site's npm dependencies. `tsx` executes the TypeScript scripts; `tsc` checks them in strict mode before execution. The checker regressions cover source/mirror drift, omitted or duplicate fences, malformed navigation metadata, guide order, and index pagination.

After building the docs site, run `npm --prefix examples/masm run check:navigation` to check the MASM sidebar order and landing-page pagination in current and v0.17.
