# MASM v0.17 local validation fixtures

These fixtures compile, execute, and test the code in the [first project](../../docs/builder/smart-contracts/masm/first-project.md), [account component](../../docs/builder/smart-contracts/masm/account-components.md), and [note script](../../docs/builder/smart-contracts/masm/note-scripts.md) guides. They use Rust 1.98.1, protocol/standards/testing 0.17.1, and VM 0.35.0. Each project includes its own lockfile and runs independently of any enclosing Cargo workspace.

Run these checks locally before pushing changes to the MASM guides, the spending-policy guide, their fixtures, or the validation scripts. No GitHub Actions workflow runs this suite automatically.

Use Node.js 20.20.2 or later and Rust 1.98.1. Install the site dependencies once with `npm ci`. From the repository root:

```bash
npm run check:masm
node tests/masm/transaction-lab/check-guides.mjs
python3 tests/patterns/spending-policy/check-docs.py
cargo +1.98.1 run --locked --manifest-path tests/masm/first-project/Cargo.toml
cargo +1.98.1 run --locked --manifest-path tests/masm/account-components/Cargo.toml
cargo +1.98.1 run --locked --manifest-path tests/masm/note-scripts/Cargo.toml
cargo +1.98.1 test --locked --manifest-path tests/masm/note-scripts/Cargo.toml
cargo +1.98.1 test --locked --manifest-path tests/masm/regressions/Cargo.toml
cargo +1.98.1 test --locked --manifest-path tests/masm/transaction-lab/Cargo.toml
cargo +1.98.1 test --locked --manifest-path tests/patterns/spending-policy/Cargo.toml
```

Expected runner outputs are `area: 42`, `settings value: 7 -> 42`, and `settings value: 7 -> 42; note consumed`. The six note tests cover successful consumption, nonzero consumption arguments, empty/oversized storage, unexpected assets, and missing consumer authentication.

The additional regression suite checks field boundaries, missing account authentication, unavailable Settings procedures, consumption by a different authorized compatible account, and rejection of a second committed consumption.

The note fixture includes the account fixture's `settings.masm` source. Keep both directories together. MockChain exercises the transaction kernel with test accounts, signers, and testing proofs; these projects require no live node or account funding.

`npm run check:masm` runs strict TypeScript compilation, eighteen checker regressions, and current/v0.17 source parity. Validation tooling lives in [`scripts/masm`](../../scripts/masm), using the docs site's existing npm dependencies. The four Cargo test suites contain 31 tests: six note tests, eight regressions, six transaction/testing/debugging tests, and eleven spending-policy tests.

The site's TypeScript compiler emits the checks into the ignored `.cache/masm-checks` directory; Node runs that output directly. No separate checker package or TypeScript runtime is needed. The checker regressions cover source/mirror drift, omitted or duplicate fences, malformed navigation metadata, guide order, and index pagination. The [transaction fixture](./transaction-lab/README.md) and [spending-policy fixture](../patterns/spending-policy/README.md) supply the remaining contract-guide validation.

When changing MASM navigation, the landing page, sidebars, or Docusaurus configuration, also build the site and check the generated sidebar order and landing-page pagination in current and v0.17:

```bash
npm run prepare:docs -- --snapshot 0.17
npm run build
npm run check:masm-navigation
```
