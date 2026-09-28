---
title: "v0.17 Migration Guide"
description: "Complete guide for upgrading from Miden v0.16 to v0.17"
pagination_prev: null
---

# Miden 0.17.0

This guide covers all breaking changes you need to migrate an application to Miden 0.17.0. Like the 0.16 guide, it is intentionally user-facing: you do not need to know or care which internal crate (VM, protocol, client) a change came from. If you are:

- building accounts, notes, or transactions
- running a client, web client or React SDK
- writing or compiling MASM
- writing Rust smart contracts with the `miden` SDK
- interacting with storage, auth, or RPCs

this document is for you. It folds together the breaking changes from the protocol crates (`0.16.1` → `0.17.0-rc.7`), the VM crates (`miden-vm` and `miden-crypto`, `0.29.2` → `0.33.0`), `miden-client` (`0.16.1` → `0.17.0-rc.4`), the Web SDK (`@miden-sdk/*` `0.16.3` → `0.17.0-rc.4`), and the `miden` Rust contract SDK / compiler (`0.14` → `0.15.0-rc.3`, `midenc` `0.10` → `0.11.0-rc.3`).

:::info Written against the 0.17 release candidates
0.17 is published as release candidates: protocol `0.17.0-rc.7`, client and Web SDK `0.17.0-rc.4`, contract SDK `0.15.0-rc.3`. Every API, signature, flag and error string in this guide was checked against source at those tags. Changes already merged after them are marked **Queued after 0.17.0-rc.7** where they matter.
:::

---

## Quick Upgrade

Try upgrading first. Most projects can start with a dependency update:

```toml title="Cargo.toml"
# Replace these
miden-client              = "0.16.1"
miden-client-sqlite-store = "0.16.1"
miden-protocol            = "0.16.1"
miden-standards           = "0.16.1"
miden-tx                  = "0.16.1"
miden-tx-batch            = "0.16.1"
miden-assembly            = "0.29.2"
miden-core                = "0.29.2"
miden-core-lib            = "0.29.2"
miden-processor           = "0.29.2"
miden-prover              = "0.29.2"
miden-verifier            = "0.29.2"
miden-crypto              = "0.29.2"

# With these
miden-client              = "=0.17.0-rc.4"
miden-client-sqlite-store = "=0.17.0-rc.4"
miden-protocol            = "=0.17.0-rc.7"
miden-standards           = "=0.17.0-rc.7"
miden-tx                  = "=0.17.0-rc.7"
miden-tx-batch            = "=0.17.0-rc.7"
miden-objects             = "=0.17.0-rc.7"   # new: only for AccountFile / NoteFile or the Protobuf encodings
miden-assembly            = "0.33.0"
miden-core                = "0.33.0"
miden-core-lib            = "0.33.0"
miden-processor           = "0.33.0"
miden-prover              = "0.33.0"
miden-verifier            = "0.33.0"
miden-crypto              = "0.33.0"
```

```json title="package.json (Web SDK)"
{
  "@miden-sdk/miden-sdk": "0.17.0-rc.4",
  "@miden-sdk/react": "0.17.0-rc.4"
}
```

Then run:

```bash
cargo update && cargo build
npm install --save-exact @miden-sdk/miden-sdk@0.17.0-rc.4 @miden-sdk/react@0.17.0-rc.4
```

If you encounter errors, continue reading for detailed migration steps.

:::warning Name the pre-release, and pin it exactly
A `"0.17"` Cargo requirement does not match `0.17.0-rc.4`, and npm's `latest` dist-tag still points at `0.16.3`, so a plain `npm install` gets 0.16. The release candidates also broke APIs between each other, so pin the exact rc with `=`. See [Imports & Dependencies](./imports-dependencies).
:::

:::danger 0.16 artifacts, stores and exports do not carry over
Packages move to format `7.0.0`, 0.16 proofs do not decode, and account and note files are now Protobuf, so **files exported by 0.16 do not import into 0.17**. A 0.16 SQLite store opens and then fails with `failed to deserialize data from the store`. The IndexedDB store deletes its whole database on first open, and **the default browser keystore keeps its secret keys in that database**, so back the keys up on 0.16.3 first (see [Client Changes](./client-changes#store-every-016-sqlite-store-must-be-recreated)). Consume private notes before you upgrade, re-assemble every package, and re-sync into a fresh store. See [0.16 artifacts do not carry over](./imports-dependencies#016-artifacts-do-not-carry-over).
:::

:::warning Upgrade the client, node, remote prover and note transport together
A `0.17.0-rc.4` client is accepted only by a `0.17.0-rc` node. A 0.16 node rejects it at the version check, and a stable `0.17.0` node will reject rc clients too. The remote prover wire format and the note transport service changed as well: point the note transport endpoint at a 0.17 service together with the RPC endpoint, or private notes silently stop arriving while `sync` keeps succeeding. See [Client Changes](./client-changes#node-client-node-remote-prover-and-note-transport-must-all-be-017).
:::

---

:::info Who should read this?
This guide is for:
- **Rust client developers** migrating from v0.16 → v0.17
- **Web SDK developers** using the JavaScript/TypeScript SDK or the React hooks
- **Smart contract authors** writing MASM or Rust contracts, or using protocol APIs
- **App developers** using the protocol, standards, or client crates

If you're starting fresh on v0.17, you can skip this guide and go directly to the [Get Started guide](../get-started).
:::

---

## At a Glance

Big themes in 0.17:

| Change | Summary |
|--------|---------|
| **The fee asset moved into `ProtocolConfig`** | The block header no longer names the fee faucet. It commits to a `ProtocolConfig` that every `DataStore` and `TransactionInputs::new` call must supply, and that clients obtain through sync. Fees are paid only in the native fee asset at rate 1/1. The Web SDK reads it with `client.feeFaucetId()`. |
| **Multisig binds a caller-chosen block** | Multisig accounts need a `MultisigAuthArgs` preimage on every chain, fee-free ones included, and every party executes at its own tip with the bound block included via `block_numbers`. The 0.16 `ChainAnchor` pattern for multisig no longer applies. 0.16 multisig code compiles and then fails at run time. |
| **Versions everywhere, so values change silently** | Accounts, asset IDs, note metadata and transaction summaries carry versions, and account procedures are sorted. Account commitments and IDs, asset IDs, note IDs, P2ID recipients and every standard note script root change without a compile error. |
| **`Asset` is a struct** | `Asset` holds an `AssetId` and an `AssetValue` instead of being an enum, and `AccountVaultDelta` tracks whole assets. `match Asset::Fungible(..)` no longer compiles in Rust, and `fungible()` / `FungibleAssetDelta` are gone from both the Rust crates and the Web SDK. |
| **P2ID storage has four items** | P2ID gained two salt elements. A P2ID recipient still built by hand with two items produces a note nobody can consume, and P2ID has no reclaim path. |
| **MASM calls can change meaning without failing** | Several procedures kept their names but changed their stack effect, and the assembler does not check call sites against signatures. `tx::get_block_commitment` now takes a block number, and an old `guardian::verify_signature` call silently skips the guardian check. |
| **Verification can return `Ok` with work outstanding** | The free `verify` is gone. `Verifier::new().verify(&claim, &proof)` returns a `VerificationOutcome`, and transaction proofs defer their precompile claims, so check `is_complete()`. `ProvingOptions` became a `Prover`. |
| **Account and note files moved to `miden-objects`** | `AccountFile` and `NoteFile` live in the new `miden-objects` crate and are Protobuf-encoded. 0.16 `.mac` / `.mno` files and Web export bytes do not load. |
| **Network accounts and network notes are stricter** | `AuthNetworkAccount::new` installs `BasicWallet` and allowlists P2ID, a network account cannot be deployed by an empty transaction and must use the chain's fee asset, and emitting a network note caps the transaction's expiration at 20 blocks. |
| **Two 0.16.x additions are replaced** | The 0.16.x fee helpers (`fee::estimate_fee`, `fee::assert_fee_bound`, `multisig::pay_bounded_fee`) and the 0.16.1 prefetched foreign accounts are replaced by 0.17 designs: native 1/1 fee payment inside `fee::pay_fee`, and execution at the chain tip. |

If you only skim a few sections, skim **Transaction Changes**, **Client Changes**, **MASM Changes**, and **Note Changes**.

---

## Compatibility

| Component | Required | Tested With |
|-----------|----------|-------------|
| Miden VM crates | 0.33 | 0.33.0 |
| miden-crypto | 0.33 | 0.33.0 |
| miden-protocol | 0.17.0-rc.7 | 0.17.0-rc.7 |
| miden-standards | 0.17.0-rc.7 | 0.17.0-rc.7 |
| miden-client | 0.17.0-rc.4 | 0.17.0-rc.4 |
| Web SDK (`@miden-sdk/*`) | 0.17.0-rc.4 | 0.17.0-rc.4 |
| Node | 0.17.0-rc | 0.17.0-rc.3 |
| `miden` contract SDK | 0.15.0-rc.3 | 0.15.0-rc.3 |
| `midenc` / `cargo-miden` | 0.11.0-rc.3 | 0.11.0-rc.3 |
| Rust (client / protocol) | 1.98.1+ | 1.98.1 |
| Rust (VM) | 1.96.1+ | 1.98.1 |
| Rust (contract SDK / compiler) | 1.99+ | `nightly-2026-09-01` |

:::note The contract toolchain no longer lags
Compiler `0.11.0-rc.3` pins protocol `=0.17.0-rc.7` and VM `0.33.0`, the same set the client uses, so the 0.16 version skew between the contract toolchain and the client is gone at these release candidates.
:::

:::note Queued after 0.17.0-rc.7
Protocol `next` already builds on **VM 0.34.0**. 0.33 and 0.34 proofs reject each other, so clients, remote provers and nodes will move to 0.34 together, and the protocol kernel procedure offsets shift again, so artifacts built against rc.7 must be rebuilt once more. See [Imports & Dependencies](./imports-dependencies#016-artifacts-do-not-carry-over).
:::

---

## Migration Sections

Work through these sections in order for a complete migration:

| Section | Topics |
|---------|--------|
| [1. Imports & Dependencies](./imports-dependencies) | Crate bumps, VM 0.29 → 0.33, the new `miden-objects` crate, pinning release candidates, artifacts that do not carry over |
| [2. Hashing & Crypto Changes](./hashing-crypto) | `serde` removed from `Word` and Merkle types, `SmtForest` → `LargeSmtForest`, `PartialSmt` bytes, stricter decoders |
| [3. Account Changes](./account-changes) | Versioned accounts, sorted procedures, network accounts, `from_package` by value, `StorageMap`, RBAC and `ApproverSet` |
| [4. Note Changes](./note-changes) | P2ID with four storage items, new standard script roots, config notes, TX_FEE notes keeping their assets |
| [5. Assets, Vault & Faucet](./asset-vault-faucet) | `Asset` as a struct, `AccountVaultDelta` with whole assets, versioned asset IDs, new standard faucet IDs, callbacks and mint policies |
| [6. Transaction Changes](./transaction-changes) | `ProtocolConfig`, `MultisigAuthArgs` and executing at the tip, native-asset fees, 20-block network-note cap, `VerificationOutcome` |
| [7. Client Changes](./client-changes) | Store recreation, client and node pairing, fee faucet from sync, Rust/Web/React/CLI changes |
| [8. MASM Changes](./masm-changes) | Procedures whose stack effect changed, renamed accessors, moved standards and core-library modules, `trace` is back |
| [9. VM & Assembler Changes](./vm-assembler) | Package format `7.0.0`, `Verifier` and `VerificationOutcome`, `Prover`, `FastProcessor`, advice budget and `AdviceInputs` |
| [10. Rust Contract SDK & Compiler](./rust-sdk-compiler) | Rebuilding with `cargo-miden` 0.11, `Asset.id`, renamed `tx` accessors, silent auth and P2ID traps |

---

## Final Checklist

Complete these steps to verify your migration:

- [ ] Bump all Miden crates per section 1, pinning the release candidates with `=`
- [ ] Pin every `@miden-sdk/*` package to exactly `0.17.0-rc.4` (`npm install --save-exact`) and bump them together
- [ ] **Consume private notes on 0.16 before upgrading**: 0.16 account and note exports do not import into 0.17
- [ ] **Back up browser-keystore secret keys on 0.16.3**: the 0.17 IndexedDB reset deletes them
- [ ] **Delete and recreate your local SQLite store**, then re-sync (the IndexedDB store resets itself)
- [ ] **Upgrade the client, node, remote prover and note transport service together**, switch both the RPC and the note transport endpoint, and keep rc clients on rc nodes
- [ ] Re-assemble every `.masp` package and rebuild every contract with `cargo-miden` 0.11; discard proofs and serialized requests from 0.16
- [ ] Recreate the CLI's `.miden/packages`
- [ ] Supply a `ProtocolConfig` wherever you build `TransactionInputs` or implement `DataStore`; in the Web SDK read the fee faucet with `client.feeFaucetId()`
- [ ] Pay fees in the native fee asset at rate 1/1
- [ ] For multisig accounts, build `MultisigAuthArgs`, add the bound block with `block_numbers`, and execute at the tip rather than at a shared `ChainAnchor`
- [ ] Drop the `serde` feature of `miden-core` and `bus-debugger` of `miden-processor`, serialize `Word` and Merkle types without serde, and replace `SmtForest` with `LargeSmtForest`
- [ ] Replace `match` arms on `Asset::Fungible` / `Asset::NonFungible` and uses of `FungibleAssetDelta` / `fungible()`
- [ ] Recompute every hard-coded account ID, code commitment, asset ID, note ID, P2ID recipient and standard note script root
- [ ] Build P2ID recipients with four storage items, or through the standard builders
- [ ] Consume TX_FEE notes only with an account that collects their assets (for example with `AuthTxFeeCollector`), and filter them out of "consume everything" flows
- [ ] Deploy network accounts with a transaction that has an effect, using the chain's fee asset
- [ ] Re-check every MASM call to a procedure whose stack effect changed, starting with `tx::get_block_commitment` and `guardian::verify_signature`
- [ ] Rename `tx::get_fee_faucet_id` → `tx::get_fee_asset_id`, `active_account::compute_commitment` → `native_account::compute_commitment`, and `miden::precompiles::*` → `miden::core::precompiles::*`
- [ ] Verify proofs with `Verifier::new().verify(&claim, &proof)` and check `is_complete()`
- [ ] Replace `ProvingOptions` with a `Prover`, and free `execute` calls with `FastProcessor`
- [ ] Move `AccountFile` / `NoteFile` imports to `miden-objects`
- [ ] *(If you write Rust contracts)* rename `Asset.key` → `Asset.id`, and hash the versioned transaction summary in custom auth components
- [ ] Run `cargo build` - **no errors**
- [ ] Run `cargo test` - **all tests pass**

:::tip You're done!
If your project builds and all tests pass, you've successfully migrated to v0.17.
:::

---

## Need Help?

- **Telegram:** [Build on Miden](https://t.me/BuildOnMiden) for technical discussion and support.
- **Forum:** [Miden discussions](https://github.com/0xMiden/miden-node/discussions) for longer-form questions and design discussion.
- **GitHub issues:** file against the relevant repo: [`rust-sdk`](https://github.com/0xMiden/rust-sdk/issues), [`web-sdk`](https://github.com/0xMiden/web-sdk/issues), [`protocol`](https://github.com/0xMiden/protocol/issues), [`miden-vm`](https://github.com/0xMiden/miden-vm/issues), or [`compiler`](https://github.com/0xMiden/compiler/issues).
- **Changelogs:** the per-repo `CHANGELOG.md` files carry the full list of changes, including non-breaking features and fixes omitted from this guide.
