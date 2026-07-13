---
title: "v0.14 Migration Guide"
description: "Complete guide for upgrading from Miden v0.13 to v0.14"
---

# Miden Testnet 0.14.0

This guide covers all breaking changes you need to migrate an application to Miden 0.14.0. Like the 0.13 guide, it is intentionally user-facing: you do not need to know or care which internal crate (VM, protocol, client) a change came from. If you are:

- building accounts, notes, or transactions
- running a client, web client or React SDK
- writing or compiling MASM
- interacting with storage, auth, or RPCs

this document is for you.

---

## Quick Upgrade

Try upgrading first — most projects can start with a dependency update:

```toml title="Cargo.toml"
# Replace these
miden-protocol  = "0.13"
miden-standards = "0.13"
miden-assembly  = "0.20"
miden-core      = "0.20"
miden-processor = "0.20"
miden-prover    = "0.20"
miden-crypto    = "0.19"

# With these
miden-protocol  = "0.14"
miden-standards = "0.14"
miden-assembly  = "0.22"
miden-core      = "0.22"
miden-processor = "0.22"
miden-prover    = "0.22"
miden-crypto    = "0.23"
```

Then run:

```bash
cargo update && cargo build
```

If you encounter errors, continue reading for detailed migration steps.

---

:::info Who should read this?
This guide is for:
- **Rust client developers** migrating from v0.13 → v0.14
- **Web SDK developers** using the JavaScript/TypeScript SDK
- **Smart contract authors** writing MASM or using protocol APIs
- **App developers** using `miden-protocol`, `miden-standards`, or client crates

If you're starting fresh on v0.14, you can skip this guide and go directly to the [Get Started guide](../get-started).
:::

---

## At a Glance

Big themes in 0.14:

| Change | Summary |
|--------|---------|
| **Poseidon2 hashing** | The native hash function changed from RPO to Poseidon2. Every MAST root, commitment, and persisted digest changes. Rebuild all artifacts. |
| **Little-endian stack** | The operand stack is now little-endian. `u64`, `u256`, `hperm`, `hmerge`, `mem_stream`, `adv_pipe` all have the low limb on top. |
| **Two-word assets** | `ASSET` is now `ASSET_KEY` + `ASSET_VALUE`. Every procedure touching assets has a new stack signature. |
| **NoteStorage** | `NoteInputs` renamed to `NoteStorage` end-to-end (Rust, MASM, errors). |
| **MASM library scripts** | Note and auth scripts are now MASM libraries with `@note_script` / `@auth_script` attributes. |
| **AuthSingleSig** | Six per-scheme auth components consolidated into `AuthSingleSig`, `AuthSingleSigAcl`, `AuthMultisig`. |
| **Web MidenClient** | The flat `WebClient` replaced by resource-based `MidenClient` API. |
| **Ownable2Step** | New built-in two-step ownership transfer component for faucets. |
| **128-bit math** | New `std::math::u128` module in the standard library. |

---

## New Features in v0.14

These are additive features you may want to adopt (not breaking changes):

- **NoteScreener and batch screening**: A new `Client::note_screener()` API adds batch note consumability checks for more efficient note screening workflows.
- **Account history pruning**: The client now exposes account history pruning APIs for storage and state management.
- **GrpcClient automatic retry on rate limiting**: `GrpcClient` now automatically retries rate-limited requests up to five times and honors `retry-after` when provided.
- **Automatic NTX note script registration**: NTX note scripts are now registered automatically — no more manual script registration as part of transaction submission.
- **Typed RPC error parsing**: RPC errors are now parsed into typed client errors, improving programmatic error handling.
- **128-bit integer math**: New `std::math::u128` module provides full unsigned integer arithmetic, comparison, bitwise, and shift/rotate operations.

---

## Compatibility

| Component | Required | Tested With |
|-----------|----------|-------------|
| Miden VM crates | 0.22+ | 0.22.0 |
| miden-crypto | 0.23+ | 0.23.0 |
| miden-protocol | 0.14+ | 0.14.3 |
| miden-standards | 0.14+ | 0.14.3 |
| Rust | 1.91+ | 1.91.0 |

---

## Migration Sections

Work through these sections in order for a complete migration:

| Section | Topics |
|---------|--------|
| [1. Imports & Dependencies](./imports-dependencies) | Cargo.toml bumps, import relocations, MSRV, `Felt` rename |
| [2. Hashing & Stack Changes](./hashing-stack) | Poseidon2, little-endian stack, Falcon module rename |
| [3. Account Changes](./account-changes) | Components, AuthSingleSig, `@auth_script`, Ownable2Step |
| [4. Note Changes](./note-changes) | NoteStorage, `@note_script`, OutputNote variants, StandardNote |
| [5. Assets, Vault & Faucet](./asset-vault-faucet) | Two-word assets, create_* rename, get_asset, vault changes |
| [6. Transaction Changes](./transaction-changes) | TransactionId, ProvenTransaction, events, SignedBlock |
| [7. Client Changes](./client-changes) | Web MidenClient, Rust Keystore, AccountReader, StateSync |
| [8. MASM Changes](./masm-changes) | 128-bit math, event namespace |
| [9. VM & Assembler Changes](./vm-assembler) | Host trait, FastProcessor, type relocations |

---

## Final Checklist

Complete these steps to verify your migration:

- [ ] Bump all Miden crate versions in `Cargo.toml` per section 1
- [ ] Update `rust-toolchain.toml` to Rust 1.91+ (if using miden-client)
- [ ] Re-assemble all `.masl` and `.masp` files from source (Poseidon2 hash change)
- [ ] Discard any cached commitments, transaction IDs, or proofs from v0.13
- [ ] Audit MASM stack arithmetic for little-endian limb order
- [ ] Update asset handling to two-word `ASSET_KEY` + `ASSET_VALUE` format
- [ ] Rename `NoteInputs` → `NoteStorage` everywhere
- [ ] Add `@note_script` / `@auth_script` attributes to MASM entrypoints
- [ ] Replace per-scheme auth components with `AuthSingleSig`
- [ ] Update `AccountComponent::new` to pass `AccountComponentMetadata`
- [ ] Replace `commitment()` calls with `to_commitment()`
- [ ] Update `NoteMetadata::new` to use `with_tag()` builder
- [ ] Replace `WellKnownNote` / `WellKnownComponent` with `Standard…` equivalents
- [ ] Migrate note constructors to associated methods (`P2idNote::create`, etc.)
- [ ] Update Web SDK from `WebClient` to `MidenClient` resource API
- [ ] Replace `TransactionAuthenticator` with `Keystore` trait in Rust client
- [ ] Run `cargo build` — **no errors**
- [ ] Run `cargo test` — **all tests pass**

:::tip You're done!
If your project builds and all tests pass, you've successfully migrated to v0.14.
:::
