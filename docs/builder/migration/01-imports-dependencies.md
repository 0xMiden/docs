---
sidebar_position: 1
title: "Imports & Dependencies"
description: "Protocol, client and Web SDK 0.17.0, the VM 0.29 to 0.33 jump, the new miden-objects crate, and the 0.16 artifacts that do not carry over"
---

# Imports & Dependencies

:::warning Breaking Change
The protocol crates, `miden-client` and the Web SDK move to **0.17.0**, and the VM crates, `miden-crypto` included, jump **0.29.2 → 0.33.0**. Packages, proofs, local stores, and account and note files written by 0.16 do not load in 0.17, and a 0.17 client talks only to a 0.17 node.
:::

## Quick Fix

```toml title="Cargo.toml"
# Replace these (0.16)
miden-client              = "0.16.1"
miden-client-sqlite-store = "0.16.1"
miden-protocol            = "0.16.1"
miden-standards           = "0.16.1"
miden-tx                  = "0.16.1"
miden-tx-batch            = "0.16.1"
miden-testing             = "0.16.1"   # dev-dependency
miden-assembly            = "0.29.2"
miden-core                = "0.29.2"
miden-core-lib            = "0.29.2"
miden-processor           = "0.29.2"
miden-prover              = "0.29.2"
miden-verifier            = "0.29.2"
miden-crypto              = "0.29.2"

# With these (0.17)
miden-client              = "0.17.0"
miden-client-sqlite-store = "0.17.0"
miden-protocol            = "0.17.0"
miden-standards           = "0.17.0"
miden-tx                  = "0.17.0"
miden-tx-batch            = "0.17.0"
miden-testing             = "0.17.0"   # dev-dependency
miden-objects             = "0.17.0"   # new: AccountFile / NoteFile and the Protobuf encodings
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
  "@miden-sdk/miden-sdk": "0.17.0",
  "@miden-sdk/react": "0.17.0"
}
```

Then run:

```bash
cargo update && cargo build
cargo install miden-client-cli --version 0.17.0 --locked   # the CLI binary is still `miden-client`
npm install @miden-sdk/miden-sdk@0.17.0 @miden-sdk/react@0.17.0
```

If you encounter errors, continue reading for detailed migration steps.

:::danger 0.16 artifacts do not carry over
Re-assemble every `.masp` package (format `6.0.0` → `7.0.0`), discard stored proofs, and recreate your local store. Do not count on exporting accounts or notes first: files exported by 0.16 do not import into 0.17, so consume private notes before you upgrade. In the browser, back up the default keystore's secret keys on 0.16.3: the IndexedDB reset deletes them. See [0.16 artifacts do not carry over](#016-artifacts-do-not-carry-over).
:::

---

## Summary

Every layer of the stack moves:

- The **protocol crates** (`miden-protocol`, `miden-standards`, `miden-tx`, `miden-tx-batch`, `miden-testing`, `miden-block-prover`, `miden-agglayer`) go `0.16.1` → `0.17.0`. None was renamed. Three crates are new: `miden-objects`, `miden-protobuf` and `miden-protobuf-derive`.
- The **VM crates** go `0.29.2` → `0.33.0`, four minor releases of breaking changes: see [VM & Assembler Changes](./vm-assembler) and [MASM Changes](./masm-changes). **`miden-crypto`** shares the VM version; its API changes are on [Hashing & Crypto Changes](./hashing-crypto).
- **`miden-client`**, `miden-client-sqlite-store` and `miden-client-cli` go `0.16.1` → `0.17.0`.
- The **Web SDK** packages go `0.16.3` → `0.17.0`.
- The **contract toolchain** goes to `miden` `0.15.0` and `midenc` / `cargo-miden` `0.11.0`. It now builds against the same protocol and VM as the client, so the 0.16 version skew is gone.
- The **Rust toolchains** do not change.

The dependency changes that fail loudly are the removed `serde` and `bus-debugger` Cargo features, the move of `AccountFile` / `NoteFile`, and a mismatched direct `p3-*` dependency. The ones that fail at run time are every 0.16 artifact (packages, proofs, stores, exported files) and every client, prover and node pairing that mixes 0.16 and 0.17.

---

## Version Bumps

| Crate | v0.16 | v0.17 |
|-------|-------|-------|
| `miden-client`, `miden-client-sqlite-store`, `miden-client-cli` | 0.16.1 | 0.17.0 |
| `miden-protocol`, `miden-standards`, `miden-tx`, `miden-tx-batch` | 0.16.1 | 0.17.0 |
| `miden-testing` (dev-dependency) | 0.16.1 | 0.17.0 |
| `miden-block-prover` (nodes and block producers) | 0.16.1 | 0.17.0 |
| `miden-agglayer` (Agglayer components; `miden-client` depends on it) | 0.16.1 | 0.17.0 |
| `miden-objects` | - | 0.17.0 *(new)* |
| `miden-protobuf`, `miden-protobuf-derive` | - | *(new, used by `miden-objects`)* |
| `miden-vm`, `miden-assembly`, `miden-assembly-syntax`, `miden-core`, `miden-core-lib`, `miden-processor`, `miden-prover`, `miden-verifier`, `miden-mast-package`, `miden-project`, `miden-package-registry`, `miden-air`, `miden-field`, `miden-serde-utils`, `miden-precompiles`, `miden-precompiles-prover` | 0.29.2 | 0.33.0 |
| `miden-crypto`, `miden-crypto-derive` | 0.29.2 | 0.33.0 |
| `miden-precompiles-air`, `miden-precompiles-verifier` | - | 0.33.0 *(new in VM 0.31)* |
| `midenc-hir-type` (compiler authors) | 0.10.1 | 0.15.0 |
| Plonky3 `p3-*` (direct users only) | 0.6 | 0.7 |
| `rand`, `rand_chacha` | 0.10 | 0.10 *(unchanged)* |
| `miden-client-web`, `miden-idxdb-store` (Rust crates of the Web SDK) | 0.16.3 | 0.17.0 |

| npm package | v0.16 | v0.17 |
|-------------|-------|-------|
| `@miden-sdk/miden-sdk` | 0.16.3 | 0.17.0 |
| `@miden-sdk/react` | 0.16.3 | 0.17.0 |
| `@miden-sdk/vite-plugin`, wallet adapter, `para`, `turnkey`, telemetry and `create` packages | 0.16.3 | 0.17.0 |

Protocol 0.16.1 required VM `0.29.1` and its lockfile resolved `0.29.4`; 0.29.3 and 0.29.4 only fixed `bundle` and wasm32, so `0.29.2` stands for the whole 0.29 line here. The changelog's cumulative VM entry reads "from v0.29.4 to v0.32.0"; for a 0.16.1 user the move is 0.29.x to **0.33.0**.

Feature flags of `miden-protocol`, `miden-standards`, `miden-tx`, `miden-tx-batch` and `miden-testing` are unchanged. `miden-block-prover`'s `testing` feature now also enables `miden-processor/testing` and `miden-protocol/testing`. The VM features that were removed are covered [below](#serde-and-bus-debugger-features-removed-from-the-vm-crates).

MASM projects bump their package dependencies the same way. The protocol's own standards packages declare:

```toml title="miden-project.toml"
# Before (0.16)
miden-core      = { linkage = "dynamic", version = "0.29" }
miden-protocol  = { linkage = "dynamic", version = "0.16.0" }
miden-standards = { linkage = "static",  version = "0.16.0" }

# After (0.17)
miden-core      = { linkage = "dynamic", version = "0.33" }
miden-protocol  = { linkage = "dynamic", version = "0.17.0" }
miden-standards = { linkage = "static",  version = "0.17.0" }
```

:::caution 0.16.x features replaced in 0.17
Two features released on the 0.16 line after 0.17 branched were deliberately replaced by a 0.17 design:
- **Protocol 0.16.0 / 0.16.1:** `fee::estimate_fee`, `fee::assert_fee_bound`, `multisig::pay_bounded_fee` and the related fee helpers. 0.17 pins every standard fee payment to the native fee asset at 1/1 inside `fee::pay_fee`, so a separate estimate and bound are no longer needed (see [Transaction Changes](./transaction-changes)).
- **Client 0.16.1:** `ForeignAccount::Prefetched` and `Client::get_foreign_account_inputs`, and their Web SDK counterparts. 0.17 executes multisig proposals at the chain tip instead of re-executing them at an old block (see [Client Changes](./client-changes)).
:::

---

## New crates and the `miden-objects` name trap

### Summary

- **`miden-objects`** holds the canonical Protobuf representations of protocol objects, and is the new home of `AccountFile` and `NoteFile` (see [below](#accountfile-and-notefile-moved-to-miden-objects-and-switched-to-protobuf)).
- **`miden-protobuf`** and **`miden-protobuf-derive`** are the Protobuf conversion framework `miden-objects` is built on.

Use the Protobuf encodings in `miden-objects` for anything you store or send, and the `Serializable` / `Deserializable` byte formats as little as possible: they are to be removed before public mainnet. `miden-client` depends on `miden-objects` and re-exports the file types, so client users who only handle account and note files do not need it directly.

:::warning `miden-objects` 0.12 is a different crate
crates.io already has `miden-objects` `0.12.x`. That was the **old name of the protocol crate** (today's `miden-protocol`). The 0.17 `miden-objects` is an unrelated, new Protobuf crate. Do not "restore" an old `miden-objects = "0.12"` dependency, and do not look for `miden_objects::account::Account`: protocol types stay in `miden-protocol`.
:::

### Migration Steps

1. Depend on `miden-objects = "0.17.0"` where you use `AccountFile`, `NoteFile` or the Protobuf types, and move stored or transmitted protocol objects from `Serializable` bytes to those Protobuf encodings.
2. Keep importing `Account`, `Note`, `TransactionInputs` and every other protocol type from `miden-protocol`.

---

## Web SDK packages

### Summary

All 20 published `@miden-sdk/*` packages share one version and move `0.16.3` → `0.17.0` together. Every first-party peer range is now `^0.17.0`, so a 0.16 package's peer range does not accept 0.17 and vice versa. Since 0.16.2, `@miden-sdk/miden-sdk` and `@miden-sdk/react` ship in lockstep at the same version (the 0.16 guide pinned `0.16.1` / `0.16.0`).

### Affected Code

```diff
- "@miden-sdk/miden-sdk": "0.16.3",
- "@miden-sdk/react": "0.16.3",
- "@miden-sdk/vite-plugin": "0.16.3"
+ "@miden-sdk/miden-sdk": "0.17.0",
+ "@miden-sdk/react": "0.17.0",
+ "@miden-sdk/vite-plugin": "0.17.0"
```

```bash
npm install @miden-sdk/miden-sdk@0.17.0 @miden-sdk/react@0.17.0
```

### Migration Steps

1. Bump every `@miden-sdk/*` package you use in one change: `miden-sdk`, `react`, `vite-plugin`, the `miden-wallet-adapter` packages, `para` / `para-react`, `turnkey` / `turnkey-react`, and the telemetry packages. Move each to `0.17.0`.
2. Do not add `@miden-sdk/node-darwin-arm64`, `node-darwin-x64` or `node-linux-x64-gnu` yourself. On Node, `@miden-sdk/miden-sdk` pulls the matching native package through `optionalDependencies` pinned to its own exact version.
3. If you consume the Web SDK's Rust crates (`miden-client-web`, `miden-idxdb-store`), move them to `0.17.0`. `miden-client-web` requires `miden-client` `0.17.0` and `miden-protocol` `0.17.0`; `miden-idxdb-store` requires `miden-client` `0.17.0`.

---

## Contract toolchain

### Summary

Contract crates move to `miden` **`0.15.0`** and the tools to `midenc` / `cargo-miden` **`0.11.0`**. Every SDK crate moves with `miden` (`miden-base`, `miden-base-macros`, `miden-base-sys`, `miden-stdlib-sys`, `miden-sdk-alloc`, `miden-field-repr` and its derive crate, `miden-tx-script-args`, `miden-sdk-build-script-support`, `midenc-frontend-wasm-metadata`). The compiler pins protocol `0.17.0` and VM `0.33.0`, the same set the client uses, so the 0.16 version skew between the contract toolchain and the client is gone. Packages it writes use format `7.0.0`, so every contract must be rebuilt. The details are in [Rust Contract SDK & Compiler](./rust-sdk-compiler).

### Affected Code

```toml title="Cargo.toml (each contract crate)"
# Before (0.16)
[dependencies]
miden = "0.14"

[build-dependencies]
miden-sdk-build-script-support = "0.14"

# After (0.17)
[dependencies]
miden = "0.15.0"

[build-dependencies]
miden-sdk-build-script-support = "0.15.0"
```

```toml title="miden-toolchain.toml"
[toolchain]
channel = "0.17.0"      # was "0.16.0"
profile = "empty"
components = ["midenc", "cargo-miden", "core", "protocol"]
```

```bash
midenup install 0.17.0
cargo miden build
```

### Migration Steps

1. Install the `0.17.0` toolchain channel with `midenup install 0.17.0`, or `cargo install cargo-miden --version 0.11.0`. The channel ships `midenc` / `cargo-miden` `0.11.0`, protocol `0.17.0`, core and VM `0.33.0`, client `0.17.0` and node `0.17.0`. It no longer lists a separate `miden-precompiles.masp` artifact.
2. Bump `miden` and `miden-sdk-build-script-support` to `"0.15.0"` in every contract crate.
3. Rebuild every package, dependencies before dependents, and every host-side fixture that loads a `.masp`.
4. Host-side test crates in the project scaffold move to `miden-client`, `miden-standards` and `miden-testing` `0.17.0`, and `miden-mast-package` `0.33.0`.

---

## MSRV and toolchains

No Rust toolchain changes for a 0.16.1 user:

| Component | `rust-version` (v0.16 → v0.17) | Pinned toolchain |
|-----------|-------------------------------|------------------|
| protocol crates | 1.98.1 → 1.98.1 | `rust-toolchain.toml` moved `1.98` → `1.98.1` |
| `miden-client` | 1.98.1 → 1.98.1 | `1.98.1` at both tags |
| Miden VM | 1.96.1 → 1.96.1 | repository dev pin moved `1.96.1` → `1.98.1` in 0.33 |
| Web SDK (building from source) | 1.98.1 → 1.98.1 | `nightly-2026-08-06` at both tags |
| contract SDK / compiler | 1.99 → 1.99 | `nightly-2026-09-01` at both tags |

Keep `rust-toolchain.toml` at `1.98.1` for client and protocol work, and at the compiler's nightly when you build Rust contracts.

:::note The changelog says the MSRV rose
The protocol changelog lists "[BREAKING] Incremented the MSRV to 1.98.1" in the 0.17 section. `rust-version = "1.98.1"` is already set at v0.16.1 (and v0.16.0); only `rust-toolchain.toml` changed.
:::

---

## `AccountFile` and `NoteFile` moved to `miden-objects` and switched to Protobuf

### Summary

`miden_protocol::account::AccountFile` and `miden_standards::note::{NoteFile, NoteSyncHint}` now live in `miden-objects` and are encoded as Protobuf. `AccountFile`'s fields became private, `read` / `write` return `AccountFileError` / `NoteFileError` instead of `std::io::Result`, and the `Serializable` / `Deserializable` impls are gone in favour of inherent `to_bytes()` / `try_from_bytes()`. `miden-objects` has no reader for the 0.16 layout, so **files written by 0.16 cannot be read by 0.17**. `NoteFile`'s variants are unchanged, and `NoteSyncHint` only changed crates.

### Affected Code

```rust
// Before (0.16)
use miden_protocol::account::AccountFile;
use miden_protocol::utils::serde::{Deserializable, Serializable};
use miden_standards::note::NoteFile;

let file = AccountFile::read("account.mac")?;            // std::io::Result<AccountFile>
let account = file.account;                                // public fields
let keys = file.auth_secret_keys;

let bytes = note_file.to_bytes();                          // Serializable
let note_file = NoteFile::read_from_bytes(&bytes)?;        // Deserializable
```

```rust
// After (0.17)
use miden_objects::account_file::AccountFile;             // + AccountFileError
use miden_objects::note_file::NoteFile;                   // + NoteFileError, NoteSyncHint

let file = AccountFile::read("account.mac")?;            // Result<AccountFile, AccountFileError>
let (account, keys) = file.into_parts();                   // or file.account(), file.auth_secret_keys()

let bytes = note_file.to_bytes();                          // Protobuf bytes
let note_file = NoteFile::try_from_bytes(&bytes)?;         // Result<NoteFile, NoteFileError>
```

`miden-client` users keep their import paths: the client re-exports the types as `miden_client::account::{AccountFile, AccountFileError}` and `miden_client::note::{NoteFile, NoteFileError, NoteSyncHint}`. The old `miden_client::notes` module and the CLI's `import` behaviour are covered in [Client Changes](./client-changes).

**(Web)** `NoteFile.serialize()` / `AccountFile.serialize()` bytes from 0.16 do not decode either:

```typescript
// After (0.17): a note file exported by 0.16
NoteFile.deserialize(bytesFrom016);
// Error: notefile deserialization failed: failed to decode the note file:
//        failed to decode Protobuf message: invalid wire type value: 6 ...
```

:::note The `miden-objects` README describes a marker that is not written
The 0.17 `crates/miden-objects/README.md` says each file "is a 4-byte marker (`acct` or `note`) followed by one Protobuf message". The code writes no marker: `to_bytes()` is the encoded, versioned Protobuf message only. 0.16 files did start with an `acct` / `note` marker followed by the native serialization.
:::

### Migration Steps

1. Add `miden-objects = "0.17.0"`, or import through `miden_client::account` / `miden_client::note`.
2. Change imports to `miden_objects::account_file::AccountFile` and `miden_objects::note_file::{NoteFile, NoteSyncHint}`.
3. Replace `file.account` / `file.auth_secret_keys` with `file.account()` / `file.auth_secret_keys()` or `file.into_parts()`.
4. Replace `Serializable::to_bytes` / `Deserializable::read_from_bytes` with the inherent `to_bytes()` / `try_from_bytes()`, and map `AccountFileError` / `NoteFileError` where you expected `std::io::Error`.
5. Re-export every account and note file with a 0.17 client. There is no converter for 0.16 files.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0432]: unresolved import `miden_protocol::account::AccountFile` `` | Type moved | `use miden_objects::account_file::AccountFile;` |
| `` error[E0432]: unresolved import `miden_standards::note::NoteFile` `` | Type moved | `use miden_objects::note_file::NoteFile;` |
| `` error[E0616]: field `account` of struct `miden_objects::account_file::AccountFile` is private `` | Fields made private | Use `account()` or `into_parts()`. |
| `` error[E0599]: no associated function or constant named `read_from_bytes` found for struct `miden_objects::account_file::AccountFile` in the current scope `` | `Deserializable` impl removed | Use `try_from_bytes()`. |
| `failed to decode the account file` | A 0.16 account file (or any non-Protobuf bytes) | Re-export the account with a 0.17 client. |
| `failed to decode the note file` | A 0.16 note file | Re-export the note with a 0.17 client. |
| `notefile deserialization failed: failed to decode the note file: ...` (Web) | Note file bytes from 0.16 | Re-export with a 0.17 client. |
| `account file deserialization failed: ...` (Web) | Account file bytes from 0.16 | Re-export with a 0.17 client. |

---

## `serde` and `bus-debugger` features removed from the VM crates

### Summary

`miden-core` no longer has a `serde` feature, so `MastForest`, `Program`, `KernelDescriptor`, `EventId`, `Operation`, `AssemblyOp`, `AdviceMap`, `ExecutionProof`, `StarkProof` and `HashFunction` no longer implement `Serialize` / `Deserialize`. `miden-mast-package` keeps its `serde` feature, but only `PackageId` and `TargetType` still implement serde; `PackageManifest`, `Dependency`, `Section`, `SectionId` and the manifest's module entries lost it (`Package` itself never implemented serde), and most `miden-assembly-syntax` AST types lost it too. `miden-processor` lost its `bus-debugger` feature (and `miden-air` its trace bus-balance debugging helpers). `Word` and the Merkle types lost serde as well: see [Hashing & Crypto Changes](./hashing-crypto#word-and-merkle-types-no-longer-implement-serde).

### Affected Code

```toml
# Before (0.16)
miden-core      = { version = "0.29", features = ["serde"] }
miden-processor = { version = "0.29", features = ["bus-debugger"] }

# After (0.17): both features are gone
miden-core      = { version = "0.33" }
miden-processor = { version = "0.33" }
```

```rust
// After (0.17): binary encoding (hex- or base64-encode the bytes if you need text)
use miden_core::serde::{Deserializable, Serializable};

let bytes = program.to_bytes();
let program = Program::read_from_bytes(&bytes)?;
```

:::note The changelog does not flag this as breaking
The VM changelog lists this change as "Removed unused Serde support", not marked `[BREAKING]`. It deletes the `miden-core` `serde` Cargo feature and the public serde impls listed above.
:::

### Migration Steps

1. Drop `features = ["serde"]` from `miden-core` and `features = ["bus-debugger"]` from `miden-processor`. Neither protocol 0.16.1 nor 0.17.0 enables them; remove them where your own manifests do.
2. Replace `serde_json` / `bincode` encodings of VM types with `to_bytes()` / `read_from_bytes()`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0277]: the trait bound `AdviceMap: serde::Serialize` is not satisfied `` (same for `Program`, `ExecutionProof`, `PackageManifest`, ...) | serde impls removed | Use the binary encoding. |
| Cargo rejects the manifest because `miden-core` has no `serde` feature (or `miden-processor` has no `bus-debugger` feature) | Feature removed | Remove the feature from the dependency. |

---

## Direct Plonky3 dependencies must match

### Summary

`Felt` implements the `p3-field` traits of the Plonky3 version the VM builds against: `0.6` for VM 0.29, `0.7` for VM 0.33. A crate that depends on `p3-*` directly must use the same minor version, or `Felt` will not satisfy its trait bounds. `miden_crypto::stark::dft` also stopped re-exporting `NaiveDft`; it now re-exports `Radix2DFTSmallBatch` next to `Radix2DitParallel` and `TwoAdicSubgroupDft`.

### Affected Code

```toml
# Before (0.16)
p3-field = "0.6"

# After (0.17)
p3-field = "0.7"
```

```rust
// Before (0.16)
use miden_crypto::stark::dft::NaiveDft;

// After (0.17): pick one of the remaining DFTs
use miden_crypto::stark::dft::Radix2DitParallel;
```

:::note The changelog omits the `NaiveDft` removal
The VM changelog describes the change only as a faster DFT for `PeriodicLde`. The same change removed the public `miden_crypto::stark::dft::NaiveDft` re-export.
:::

### Migration Steps

1. Prefer importing field traits through `miden_crypto::field::{Field, PrimeField64, ...}` so they always match the VM's Plonky3.
2. If you depend on `p3-*` crates directly, bump them together to `0.7`.
3. Replace `NaiveDft` with `Radix2DitParallel` or `Radix2DFTSmallBatch`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0277]: the trait bound `Felt: p3_field::Field` is not satisfied `` (or another `p3_field` trait), with the note "there are multiple different versions of crate `p3_field` in the dependency graph" | Two `p3-field` versions in the dependency graph | Align your `p3-*` version, or import the traits through `miden_crypto::field`. |
| `error[E0432]: unresolved import` naming `miden_crypto::stark::dft::NaiveDft` | Re-export removed | Use `Radix2DitParallel` or `Radix2DFTSmallBatch`. |

---

## 0.16 artifacts do not carry over

### Summary

Nothing below has a converter. Regenerate each artifact from its source with 0.17 tooling, and move every component that exchanges these bytes (client, CLI, Web SDK, remote prover, node) to 0.17 together.

| Artifact | What happens in 0.17 | What to do | Details |
|----------|----------------------|------------|---------|
| `.masp` packages | Format `6.0.0` → `7.0.0`; readers accept exactly `7.0.0`. The MAST forest wire format stays `[0, 0, 4]`, so a bare serialized `MastForest` still loads, but roots of changed procedures differ | Re-assemble every package from source, including the CLI's `.miden/packages` and contract packages | [VM & Assembler Changes](./vm-assembler), [Client Changes](./client-changes), [Rust Contract SDK & Compiler](./rust-sdk-compiler) |
| Proofs (`ExecutionProof`, and `ProvenTransaction` / `ProvenBatch` / `ProvenBlock` serialized by 0.16) | Every proof must start with transport format `2`; 0.16 proofs fail to decode | Discard them and re-prove | [VM & Assembler Changes](./vm-assembler), [Transaction Changes](./transaction-changes) |
| `BlockHeader` bytes | 8-bit version, no fee faucet, new fields | Discard and re-fetch | [Transaction Changes](./transaction-changes) |
| `TransactionInputs` bytes | Now carry a `ProtocolConfig` | Discard and rebuild | [Transaction Changes](./transaction-changes) |
| Account, header, asset, note and delta bytes | Lead with a version byte or use a new layout; derived commitments, IDs and standard script roots change | Re-fetch or rebuild; recompute hardcoded values | [Account Changes](./account-changes), [Note Changes](./note-changes) |
| Account and note files (`.mac`, `.mno`, Web `serialize()` bytes) | Protobuf only; 0.16 files fail to decode | Re-export with a 0.17 client; consume private notes before upgrading | [above](#accountfile-and-notefile-moved-to-miden-objects-and-switched-to-protobuf), [Client Changes](./client-changes) |
| SQLite store | Opens without a migration error, then fails with `failed to deserialize data from the store` | Delete the store and re-sync; the keystore directory and `miden-client.toml` carry over | [Client Changes](./client-changes) |
| IndexedDB store | Deleted automatically on first open by 0.17, together with the secret keys of the default browser keystore, which lives in the same database | Back those keys up on 0.16.3 first, then re-sync; recover accounts from the keys, not from 0.16 exports | [Client Changes](./client-changes#store-every-016-sqlite-store-must-be-recreated) |
| Serialized `TransactionRequest` | Always carries block numbers; bytes from 0.16 do not deserialize | Rebuild the request | [Client Changes](./client-changes) |
| `PartialSmt` bytes | 0.16 bytes with empty-subtree markers fail to decode | Rebuild from source data | [Hashing & Crypto Changes](./hashing-crypto#partialsmt-bytes-from-016-no-longer-decode-uniquenodes-restructured) |

The same holds for the network side. A `0.17.0` client is accepted only by a 0.17 node (the node matches major.minor), the remote prover wire format changed, and the note transport service moved. For a local node, use node `0.17.0`, the release the `0.17.0` client is built against. See [Client Changes](./client-changes).

:::caution Exporting before the upgrade does not help
The 0.16 guide advised exporting private note files before recreating the store. That does not survive this upgrade: 0.16 exports do not import into 0.17. Consume private notes on 0.16 before upgrading, or have the sender re-send them once both sides run 0.17. 0.16 secret keys survive in a filesystem keystore, which loads unchanged in 0.17, but not in the default browser keystore: the IndexedDB reset deletes them, so back them up on 0.16.3 first.
:::

### Migration Steps

1. Re-assemble every `.masp` package from source with the 0.17 toolchain, and drop persisted packages built with VM 0.29.
2. Discard cached proofs, proven transactions, batches and blocks, block headers, transaction inputs and serialized requests written by 0.16.
3. Consume private notes and, in the browser, back up the default keystore's secret keys on 0.16.3. Then delete the local store (SQLite) or let the Web SDK reset it (IndexedDB), and re-sync against a 0.17 node.
4. Re-create or re-export account and note files with 0.17 tooling.
5. Upgrade the client, the CLI, the Web SDK, any remote prover and the node together.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `invalid value: unsupported version. Got '[6, 0, 0]', but only '[7, 0, 0]' is supported` | A package written by VM 0.29 (0.16 `init`, midenc 0.10, or your own build) | Re-assemble the package. |
| `invalid value: unsupported execution proof format {format}` | Proof bytes from an older VM release | Re-prove with 0.17. |
| `failed to deserialize data from the store` | A SQLite store written by a 0.16 client | Delete the store and re-sync. |
| `failed to decode the account file` / `failed to decode the note file` | A 0.16 account or note file | Re-export with 0.17. |
| `server rejected request - please check your version and network settings (client version: 0.17.0, genesis commitment: ...)` | Client and node differ in major.minor | Use a node and client from the same 0.17 line. |

---

## Migration Steps

1. Bump every Miden crate per the [Version Bumps](#version-bumps) table.
2. Keep every protocol crate on `0.17.0`, and every VM crate (including `miden-crypto`) on `0.33.0`.
3. Add `miden-objects` only if you use `AccountFile` / `NoteFile` or the Protobuf types directly, and never the unrelated `miden-objects` `0.12.x`.
4. Drop the `serde` feature from `miden-core` and `bus-debugger` from `miden-processor`; align any direct `p3-*` dependency to `0.7`.
5. Bump every `@miden-sdk/*` package to `0.17.0` together, with `npm install <package>@0.17.0`.
6. Move contract projects to `miden` `0.15.0` and the `0.17.0` toolchain channel, and rebuild them.
7. Keep your Rust toolchains: nothing changes for a 0.16.1 user.
8. Regenerate every 0.16 artifact per [0.16 artifacts do not carry over](#016-artifacts-do-not-carry-over), and upgrade client, prover and node together.

---

## Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0432]: unresolved import `miden_protocol::account::AccountFile` `` | Type moved to `miden-objects` | `use miden_objects::account_file::AccountFile;` or `miden_client::account::AccountFile`. |
| `` error[E0277]: the trait bound `AdviceMap: serde::Serialize` is not satisfied `` | `miden-core` lost its serde impls | Use `to_bytes()` / `read_from_bytes()`. |
| `` error[E0277]: the trait bound `Felt: p3_field::Field` is not satisfied `` (note: multiple different versions of crate `p3_field`) | Direct `p3-*` dependency on a different Plonky3 minor | Bump `p3-*` to `0.7`, or import traits through `miden_crypto::field`. |
| `invalid value: unsupported version. Got '[6, 0, 0]', but only '[7, 0, 0]' is supported` | Package built with a 0.16 (VM 0.29) toolchain | Re-assemble from source. |
| `invalid value: unsupported execution proof format {format}` | Proof serialized by 0.16 | Re-prove with 0.17. |
| `failed to deserialize data from the store` | 0.16 SQLite store | Delete the store and re-sync. |
| `failed to decode the account file` / `failed to decode the note file` | 0.16 export | Re-export with a 0.17 client. |
| `server rejected request - please check your version and network settings (...)` | Client and node from different lines | Run matching versions. |
