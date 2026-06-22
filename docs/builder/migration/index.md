---
title: "v0.15 Migration Guide"
description: "Complete guide for upgrading from Miden v0.14 to v0.15"
---

# Miden Testnet 0.15.0

This guide covers all breaking changes you need to migrate an application to Miden 0.15.0. Like the 0.14 guide, it is intentionally user-facing: you do not need to know or care which internal crate (VM, protocol, client) a change came from. If you are:

- building accounts, notes, or transactions
- running a client, web client or React SDK
- writing or compiling MASM
- interacting with storage, auth, or RPCs

this document is for you. It folds together the breaking changes from the protocol crates (`miden-base`, `0.14` → `0.15.3`), the VM crates (`miden-vm`, `0.22` → `0.23`), `miden-client` (`0.14` → `0.15`), and the Web SDK (`@miden-sdk/*` `0.14` → `0.15`). Because `miden-client` and the Web SDK still ship from unified-in-progress `main`/`next` branches, this guide unions the breaking surface from both.

---

## Quick Upgrade

Try upgrading first — most projects can start with a dependency update:

```toml title="Cargo.toml"
# Replace these
miden-client              = "0.14"
miden-client-sqlite-store = "0.14"
miden-protocol            = "0.14"
miden-standards           = "0.14"
miden-tx                  = "0.14"
miden-assembly            = "0.22"
miden-core                = "0.22"
miden-core-lib            = "0.22"
miden-processor           = "0.22"
miden-prover              = "0.22"
miden-crypto              = "0.23"

# With these
miden-client              = "0.15"
miden-client-sqlite-store = "0.15"
miden-protocol            = "0.15.3"
miden-standards           = "0.15.3"
miden-tx                  = "0.15.3"
miden-assembly            = "0.23"
miden-core                = "0.23"
miden-core-lib            = "0.23"
miden-processor           = "0.23"
miden-prover              = "0.23"
miden-crypto              = "0.25"
```

```json title="package.json (Web SDK)"
{
  "@miden-sdk/miden-sdk": "^0.15.0",
  "@miden-sdk/react": "^0.15.0",
  "miden-idxdb-store": "^0.15.0"
}
```

Then run:

```bash
cargo update && cargo build
```

If you encounter errors, continue reading for detailed migration steps.

:::warning 0.14 artifacts do not round-trip
Because the native hash and the MAST/serialization formats changed upstream, **0.14 artifacts (accounts, notes, proofs, serialized stores, `.masl`/`.masp` packages) do not round-trip.** Re-assemble from source and re-sync into a fresh store.
:::

---

:::info Who should read this?
This guide is for:
- **Rust client developers** migrating from v0.14 → v0.15
- **Web SDK developers** using the JavaScript/TypeScript SDK
- **Smart contract authors** writing MASM or using protocol APIs
- **App developers** using the protocol, standards, or client crates

If you're starting fresh on v0.15, you can skip this guide and go directly to the [Get Started guide](../get-started).
:::

---

## At a Glance

Big themes in 0.15:

| Change | Summary |
|--------|---------|
| **Account IDs simplified** | The account ID no longer encodes faucet/regular, mutability, or network mode. The old `AccountType` enum is gone; `AccountStorageMode` is **renamed `AccountType`** (`{ Private, Public }`). Faucet/network-ness now comes from components; the ID version is renamed `0` → `1`. |
| **Note identity split** | The old `NoteId` (recipient + assets) becomes **`NoteDetailsCommitment`**; the new `NoteId` also commits to metadata, and nullifiers now fold in metadata + the attachments commitment — none roundtrip with 0.14. |
| **Multiple attachments per note** | `NoteMetadata` → `PartialNoteMetadata`, `NoteMetadataHeader` → `NoteMetadata`; attachments live on the note/record as a `NoteAttachments` collection (≤ 4). `NoteType` is now 1-bit, default `Private`. |
| **Faucets unified** | `BasicFungibleFaucet` + `NetworkFungibleFaucet` → one **`FungibleFaucet`** (`bon` builder) + `FungibleTokenMetadata` + a `TokenPolicyManager` for mint/burn policies. Amounts are a validated **`AssetAmount`** newtype. |
| **Typed roots everywhere** | `NoteScript::root()` → `NoteScriptRoot`, `TransactionScript::root()` → `TransactionScriptRoot`, `procedure_digest!` → `procedure_root!`, plus `AccountComponentName`. |
| **VM 0.23 / crypto 0.25 are digest-changing** | SMT leaf hashing gains a Poseidon2 domain separator, the MAST wire format bumped `0.0.2` → `0.0.3` (old `.masl`/`.masp` won't load), execution is **sync-first** (`BaseHost`/`SyncHost`; `execute` → `ExecutionOutput`), and `adv_push.N` was removed. |
| **Client RPC rebuilt around `GetAccount`** | `get_account_proof`/`get_account_details` reshaped, `check_nullifiers` removed (use `sync_nullifiers`), most sync methods now require an explicit `block_to`. |
| **Web SDK on the 0.15 protocol surface** | `"network"` storage mode is gone, the WASM `AccountType` narrowed to `{ Private, Public }`, attachments are word-vector-shaped, `Felt`/`Word` throw on overflow, several methods return `undefined`/`string`, `proveTransactionWithProver` is renamed `proveTransaction`, and `storeIdentifier()` went async. |

If you only skim a few sections, skim **Account Changes**, **Note Changes**, **Assets, Vault & Faucet**, **Hashing, SMT & Crypto Changes**, and **Client Changes**.

---

## Compatibility

| Component | Required | Tested With |
|-----------|----------|-------------|
| Miden VM crates | 0.23+ | 0.23.0 |
| miden-crypto | 0.25+ | 0.25.0 |
| miden-protocol | 0.15+ | 0.15.3 |
| miden-standards | 0.15+ | 0.15.3 |
| miden-client | 0.15+ | 0.15.0 |
| Web SDK (`@miden-sdk/*`) | 0.15+ | 0.15.0 |
| Rust (client) | 1.93+ | 1.93.0 |
| Rust (base crates) | 1.90+ | 1.90.0 |

:::note `miden-prover`, not `miden-prove`
The prover crate is **`miden-prover`** in this line — it is *not* `miden-prove`. Keep depending on `miden-prover`.
:::

---

## Migration Sections

Work through these sections in order for a complete migration:

| Section | Topics |
|---------|--------|
| [1. Imports & Dependencies](./imports-dependencies) | Crate bumps, package.json, MSRV 1.93, no round-trip of 0.14 artifacts |
| [2. Hashing, SMT & Crypto Changes](./hashing-stack) | Poseidon2-domain-separated SMT leaves, `miden-crypto` 0.25 renames, `PartialSmt` / `LargeSmt` / 0.24 API breaks |
| [3. Account Changes](./account-changes) | `AccountType` removed/renamed, network-account allowlist, `procedure_root!`, typed roots |
| [4. Note Changes](./note-changes) | `NoteDetailsCommitment`, `PartialNoteMetadata`, multiple attachments, 1-bit `NoteType`, nullifier change, PSWAP |
| [5. Assets, Vault & Faucet](./asset-vault-faucet) | `AssetAmount`, unified `FungibleFaucet`, `AssetVaultKey`, `AssetComposition` |
| [6. Transaction Changes](./transaction-changes) | `fee_faucet_id`, `TransactionScriptRoot`, `ProvenBatch::new_unchecked` |
| [7. Client Changes](./client-changes) | `GetAccount` surface, `sync_nullifiers`, `TokenPolicyManager`, Web/React/CLI changes |
| [8. MASM Changes](./masm-changes) | `metadata_into_*` renames, trimmed kernel outputs, `adv_push.N` removed |
| [9. VM & Assembler Changes](./vm-assembler) | Sync-first execution, `prove_sync`, stricter assembly, MAST wire format `0.0.3` |

---

## Final Checklist

Complete these steps to verify your migration:

- [ ] Bump all Miden crate versions in `Cargo.toml` per section 1 (and `@miden-sdk/*` to `^0.15.0` together)
- [ ] Update the client toolchain to Rust 1.93+
- [ ] Re-assemble all `.masl` and `.masp` files from source (MAST wire format `0.0.3`)
- [ ] Re-sync into a fresh store; discard cached commitments, note IDs, nullifiers, and proofs from 0.14
- [ ] Re-derive persisted SMT roots / leaf digests / `PartialSmt` values under `miden-crypto` 0.25
- [ ] *(If you implement a custom `LargeSmt` storage backend)* move reads to `SmtStorageReader` and add `type Reader` + `reader()` to your `SmtStorage` impl
- [ ] *(If you use `miden-crypto` directly)* apply the 0.24 API breaks (`WORD_SIZE*` → `Word::NUM_ELEMENTS` / `Word::SERIALIZED_SIZE`, `LexicographicWord` → `Word`, `Felt` deref removed, `StarkProof` log trace heights + `air_order`)
- [ ] Replace the old `AccountType` / `AccountStorageMode` usage with the new `AccountType` (`Private`/`Public`)
- [ ] Rename note "ids without metadata" to `NoteDetailsCommitment`; recompute note IDs and nullifiers
- [ ] Move to `PartialNoteMetadata` + `NoteAttachments`; audit `NoteType` (now 1-bit, default `Private`)
- [ ] Switch faucets to `FungibleFaucet::builder()` + `TokenPolicyManager`; wrap amounts in `AssetAmount`
- [ ] Replace `get_account_proof` with `get_account(GetAccountRequest…)` and `check_nullifiers` with `sync_nullifiers`
- [ ] Pass explicit `block_to` to the sync methods that now require it
- [ ] Web: drop `"network"` storage, move faucet checks onto `Account`, reshape attachments, guard `Felt`/`Word` construction
- [ ] Split your `Host` impl into `BaseHost` + `SyncHost`; handle `ExecutionOutput`
- [ ] Run `cargo build` — **no errors**
- [ ] Run `cargo test` — **all tests pass**

:::tip You're done!
If your project builds and all tests pass, you've successfully migrated to v0.15.
:::

---

## Need Help?

- **Discord:** [Miden Discord](https://discord.gg/0xMiden) — the `#dev-support` channel.
- **GitHub issues:** file against the relevant repo — [`rust-sdk`](https://github.com/0xMiden/rust-sdk/issues), [`web-sdk`](https://github.com/0xMiden/web-sdk/issues), [`protocol`](https://github.com/0xMiden/protocol/issues), or [`miden-vm`](https://github.com/0xMiden/miden-vm/issues).
- **Changelogs:** the per-repo `CHANGELOG.md` files carry the full list of changes, including non-breaking features and fixes omitted from this guide.
