---
title: "v0.16 Migration Guide"
description: "Complete guide for upgrading from Miden v0.15 to v0.16"
pagination_prev: null
---

# Miden Testnet 0.16.0

This guide covers all breaking changes you need to migrate an application to Miden 0.16.0. Like the 0.15 guide, it is intentionally user-facing: you do not need to know or care which internal crate (VM, protocol, client) a change came from. If you are:

- building accounts, notes, or transactions
- running a client, web client or React SDK
- writing or compiling MASM
- writing Rust smart contracts with the `miden` SDK
- interacting with storage, auth, or RPCs

this document is for you. It folds together the breaking changes from the protocol crates (`0.15.3` → `0.16.0`), the VM crates (`miden-vm`, `0.23` → `0.29.1`), `miden-client` (`0.15` → `0.16.0`), the Web SDK (`@miden-sdk/*` `0.15` → `0.16.0`), and the `miden` Rust contract SDK / compiler (`0.13` → `0.14`).

---

## Quick Upgrade

Try upgrading first — most projects can start with a dependency update:

```toml title="Cargo.toml"
# Replace these
miden-client              = "0.15"
miden-client-sqlite-store = "0.15"
miden-protocol            = "0.15.3"
miden-standards           = "0.15.3"
miden-tx                  = "0.15.3"
miden-tx-batch-prover     = "0.15.3"
miden-assembly            = "0.23"
miden-core                = "0.23"
miden-core-lib            = "0.23"
miden-processor           = "0.23"
miden-prover              = "0.23"
miden-crypto              = "0.25"

# With these
miden-client              = "0.16.0-rc.1"
miden-client-sqlite-store = "0.16.0-rc.1"
miden-protocol            = "0.16.0-rc.6"
miden-standards           = "0.16.0-rc.6"
miden-tx                  = "0.16.0-rc.6"
miden-tx-batch            = "0.16.0-rc.6"   # renamed from miden-tx-batch-prover
miden-assembly            = "0.29.1"
miden-core                = "0.29.1"
miden-core-lib            = "0.29.1"
miden-processor           = "0.29.1"
miden-prover              = "0.29.1"
miden-crypto              = "0.29.1"
```

```json title="package.json (Web SDK)"
{
  "@miden-sdk/miden-sdk": "0.16.0-rc.2",
  "@miden-sdk/react": "0.16.0-rc.2"
}
```

Then run:

```bash
cargo update && cargo build
```

If you encounter errors, continue reading for detailed migration steps.

:::warning 0.15 artifacts do not round-trip
The MAST wire format moved `0.0.3` → `0.0.4`, the package format `4.0.0` → `6.0.0`, and the `.masl` library format was removed entirely. Several commitment preimages changed as well. **Re-assemble every package from source and re-sync into a fresh store.**
:::

:::danger Your local store must be recreated, and your node must be upgraded with your client
Every pre-0.16 SQLite store is rejected — there is no migration path. Browser applications reset their IndexedDB store automatically. Separately, 0.16 clients seal (encrypt) transaction inputs before submission, so a 0.16 client cannot talk to an older node and vice versa.
:::

---

:::info Who should read this?
This guide is for:
- **Rust client developers** migrating from v0.15 → v0.16
- **Web SDK developers** using the JavaScript/TypeScript SDK
- **Smart contract authors** writing MASM or using protocol APIs
- **App developers** using the protocol, standards, or client crates

If you're starting fresh on v0.16, you can skip this guide and go directly to the [Get Started guide](../get-started).
:::

---

## At a Glance

Big themes in 0.16:

| Change | Summary |
|--------|---------|
| **Fees moved into the auth procedure** | The kernel no longer burns the fee automatically. The auth procedure reads `FeeConversionInfo` from the transaction's auth args and emits a `TX_FEE` note. On a fee-charging chain, requests signed by `AuthSingleSig`/`AuthMultisig` must call `TransactionRequestBuilder::fee_conversion_info(info, salt)`. |
| **MASM gained an explicit module tree** | A `.masm` file is only included if its parent declares it with `mod`/`pub mod` — an undeclared file is *silently dropped*. `use` split into module imports and braced item imports, aliases moved from `->` to `as`, and imports resolve globally. |
| **Account updates became absolute** | `AccountDelta` → **`AccountPatch`** for account updates (`ExecutedTransaction`, `AccountUpdateDetails`, client results). `TransactionSummary::account_delta()` deliberately stays relative. |
| **Auth is no longer a special builder slot** | `AccountBuilder::with_auth_component` is gone; auth components pass through `with_component(s)` and are found by their `@auth_script` attribute. Keys are wrapped in a new **`Approver`** / `ApproverSet`. `AuthMethod` and `AuthSingleSigAcl` are removed. |
| **Asset identity renamed one level down** | `AssetVaultKey` → **`AssetId`**, and the old `AssetId` → **`AssetClass`**. Because `AssetId` survives with a new meaning, careless renaming compiles and is wrong. |
| **`Library` is gone; `Package` is the only artifact** | `Library`/`KernelLibrary` were deleted, `link_*_library` collapsed into `link_package`, `*_from_dir` became `*_from_root`, and `.masl` no longer exists. MAST `0.0.4` / package `6.0.0` are not backward compatible. |
| **Notes use typed builders, and carry fewer assets** | `XNote::create(..)` → `XNote::builder()…build()?` + `.into()`. **`MAX_ASSETS_PER_NOTE` dropped 64 → 16.** Mint and burn scripts were unified across faucet kinds, changing their roots. |
| **Debug decorators removed** | `debug.*` and `trace` are gone from the language, replaced by `miden::core::debug` procedures — which, unlike the decorators, **print unconditionally**. The client and CLI debug-mode toggles were removed with them. |
| **Commitment preimages changed** | ECDSA public-key commitments, MMR peak commitments, and domain-separated empty-input hashes all changed value. Nothing fails to compile; stored values simply stop matching. |
| **Store and node compatibility both break** | Every pre-0.16 SQLite store must be recreated, and transaction inputs are now sealed, so client and node must be upgraded together. |

If you only skim a few sections, skim **Transaction Changes**, **Account Changes**, **MASM Changes**, and **Client Changes**.

---

## Compatibility

| Component | Required | Tested With |
|-----------|----------|-------------|
| Miden VM crates | 0.29+ | 0.29.1 |
| miden-crypto | 0.29+ | 0.29.1 |
| miden-protocol | 0.16+ | 0.16.0-rc.6 |
| miden-standards | 0.16+ | 0.16.0-rc.6 |
| miden-client | 0.16+ | 0.16.0-rc.1 |
| Web SDK (`@miden-sdk/*`) | 0.16+ | 0.16.0-rc.2 |
| `miden` contract SDK | 0.14+ | 0.14.0-rc.1 |
| `midenc` compiler | 0.10+ | 0.10.0-rc.1 |
| Rust (client) | 1.96+ | 1.96 |
| Rust (protocol / VM) | 1.96.1+ | 1.96.1 |
| Rust (contract SDK / compiler) | 1.97+ | 1.97 |

:::note Pin the exact pre-release version
The 0.16 protocol and client crates currently publish as `0.16.0-rc.N`. Cargo does not match a pre-release against a plain `"0.16"` requirement, so pin the exact string until the final release is published.
:::

:::note The contract toolchain lags the rest of the line
`midenc` and the `miden` contract SDK build against protocol `0.16.0-alpha.4` and VM `0.25`, not the protocol `0.16.0-rc` and VM `0.29.1` used by the client and node. Artifacts still load — the MAST and package formats are compatible across those VM versions — but the protocol API surface the compiler sees is an earlier snapshot. Its MSRV is also higher, at 1.97.
:::

---

## Migration Sections

Work through these sections in order for a complete migration:

| Section | Topics |
|---------|--------|
| [1. Imports & Dependencies](./imports-dependencies) | Crate bumps, VM 0.23 → 0.29.1, MSRV 1.96, artifacts that must be rebuilt |
| [2. Hashing & Crypto Changes](./hashing-crypto) | ECDSA public-key commitments, MMR peaks binding the leaf count, empty domain-separated hashing |
| [3. Account Changes](./account-changes) | `with_auth_component` removed, `Approver`/`ApproverSet`, component name changes, `AccountPatch` |
| [4. Note Changes](./note-changes) | Typed note builders, `MAX_ASSETS_PER_NOTE` 64 → 16, unified mint/burn scripts |
| [5. Assets, Vault & Faucet](./asset-vault-faucet) | `AssetVaultKey` → `AssetId`, old `AssetId` → `AssetClass`, split faucet factories |
| [6. Transaction Changes](./transaction-changes) | Fees paid by the auth procedure, sealed transaction inputs, `TransactionSummary` |
| [7. Client Changes](./client-changes) | Store recreation, node compatibility, Rust/Web/React/CLI changes |
| [8. MASM Changes](./masm-changes) | `mod` declarations, new import syntax, debug decorators removed, protocol procedure moves |
| [9. VM & Assembler Changes](./vm-assembler) | `Library` → `Package`, MAST `0.0.4`, `ExecutionClaim`, `miden-project.toml` |
| [10. Rust Contract SDK & Compiler](./rust-sdk-compiler) | `#[account_procedure]`, `#[account(..)]` generating traits, toolchain version skew |

---

## Final Checklist

Complete these steps to verify your migration:

- [ ] Bump all Miden crate versions per section 1, pinning the exact `0.16.0-rc.N` strings, and rename `miden-tx-batch-prover` to `miden-tx-batch`
- [ ] Bump `@miden-sdk/miden-sdk` and `@miden-sdk/react` together; drop any `miden-idxdb-store` dependency
- [ ] Update the toolchain to Rust 1.96 (1.97 if you also build Rust contracts)
- [ ] Re-assemble every `.masp` from source and delete cached `MastForest` blobs; `.masl` no longer exists
- [ ] **Delete and recreate your local store**, then re-sync — export private note files first
- [ ] **Upgrade your node together with your client** — sealed and plaintext submissions are mutually incompatible
- [ ] Add `mod` / `pub mod` declarations so every `.masm` file is reachable from your project root
- [ ] Rewrite `pub use a::b::c` as `pub use {c} from a::b`, and `use x->y` as `use x as y`
- [ ] Replace `debug.*` / `trace` decorators with `miden::core::debug` procedures, and strip them from production code
- [ ] Declare fee conversion info on transactions if your chain charges a fee, and fund the paying account with the fee asset
- [ ] Move auth components out of `with_auth_component` and wrap keys in `Approver` / `ApproverSet`
- [ ] Rename `AssetId` → `AssetClass` **first**, then `AssetVaultKey` → `AssetId`
- [ ] Replace `account_delta()` with `account_patch()` — but leave `TransactionSummary::account_delta()` alone
- [ ] Rewrite `XNote::create(..)` calls as builders, and cap notes at 16 assets
- [ ] Recompute stored ECDSA public-key commitments, MMR peak commitments, and empty domain-separated hashes
- [ ] Replace `Library`/`KernelLibrary` with `Package`, and `link_*_library` with `link_package`
- [ ] Add an explicit `path` to every `[lib]` and `[[bin]]` in `miden-project.toml`
- [ ] Build an `ExecutionClaim` and call `verify(proof, claim)`; discard proofs serialized under 0.15
- [ ] CLI: rename `send` to `transfer`, `--with-code` to `--inspect`, and `id` to `address` in `token_symbol_map.toml`
- [ ] CLI: re-check every `call` invocation — arguments are now counted in field elements
- [ ] *(If you write Rust contracts)* mark component trait methods with `#[account_procedure]` and import the traits generated by `#[account(..)]`
- [ ] Run `cargo build` — **no errors**
- [ ] Run `cargo test` — **all tests pass**

:::tip You're done!
If your project builds and all tests pass, you've successfully migrated to v0.16.
:::

---

## Need Help?

- **Telegram:** [Build on Miden](https://t.me/BuildOnMiden) — technical discussion and support.
- **Forum:** [Miden discussions](https://github.com/0xMiden/miden-node/discussions) — longer-form questions and design discussion.
- **GitHub issues:** file against the relevant repo — [`rust-sdk`](https://github.com/0xMiden/rust-sdk/issues), [`web-sdk`](https://github.com/0xMiden/web-sdk/issues), [`protocol`](https://github.com/0xMiden/protocol/issues), [`miden-vm`](https://github.com/0xMiden/miden-vm/issues), or [`compiler`](https://github.com/0xMiden/compiler/issues).
- **Changelogs:** the per-repo `CHANGELOG.md` files carry the full list of changes, including non-breaking features and fixes omitted from this guide.
