---
title: "v0.13 Migration Guide"
description: "Complete guide for upgrading to Miden v0.13"
---

# v0.13 Migration Guide

## Quick Upgrade

Try upgrading first—most projects migrate with just a dependency update:

```toml title="Cargo.toml"
# Replace these
miden-objects = "0.12"
miden-lib = "0.12"

# With these
miden-protocol = "0.13"
miden-standards = "0.13"
```

Then run:

```bash
cargo update && cargo build
```

If you encounter errors, continue reading for detailed migration steps.

---

:::info Who should read this?
This guide is for:
- **Rust client developers** migrating from v0.12 → v0.13
- **App developers** using `miden-objects`, `miden-lib`, or legacy MASM syntax
- **Smart contract authors** using storage slots or note APIs

If you're starting fresh on v0.13, you can skip this guide and go directly to the [Get Started](../get-started).
:::

---

## What's New in v0.13

This release brings significant improvements alongside the breaking changes:

| Feature | Benefit |
|---------|---------|
| **Named Storage** | More intuitive and self-documenting storage access |
| **Unified Auth** | Simpler authentication with `AuthScheme` enum |
| **Note Attachments** | Cleaner separation of note data and metadata |
| **Modern MASM Syntax** | Cleaner syntax aligned with Rust conventions |

---

## Compatibility

| Component | Required | Tested With |
|-----------|----------|-------------|
| Miden VM | 0.20+ | 0.20.0 |
| miden-crypto | 0.19+ | 0.19.0 |
| Rust | 1.75+ | 1.82.0 |

---

## Migration Philosophy

We group breaking changes into major releases to minimize disruption. When possible, we deprecate before removing—this guide covers features deprecated in v0.12 that are now removed, plus new breaking changes in v0.13.

Expect migration guides with each major version (roughly quarterly).

---

## At a Glance

Key themes in this release:

| Change | Summary |
|--------|---------|
| **Named Storage** | Storage slots now identified by `StorageSlotName` instead of numeric indices |
| **Note Attachments** | `NoteMetadata` no longer stores `aux` or `NoteExecutionHint`; use `NoteAttachment` |
| **Unified Input Notes** | Input notes no longer split into authenticated/unauthenticated lists |
| **Authentication APIs** | Auth APIs unified around `AuthScheme` enum |

---

## Migration Sections

Work through these sections in order for a complete migration:

| Section | Topics |
|---------|--------|
| [1. Imports & Dependencies](./imports-dependencies) | Crate renames, `miden-protocol`, `miden-standards` |
| [2. Account Changes](./account-changes) | Named storage, keystore, components, procedure roots |
| [3. Note Changes](./note-changes) | Attachments, tags, `NetworkAccountTarget`, MINT notes |
| [4. Transaction Changes](./transaction-changes) | `TransactionEvent` → `TransactionEventId` |
| [5. Client Changes](./client-changes) | Rust RPC, WebClient store, CLI changes |
| [6. MASM Changes](./masm-changes) | Syntax modernization, crypto renames |
| [7. Assembler Changes](./assembler-changes) | `LibraryPath` removal, debug mode changes |

---

## Final Checklist

Complete these steps to verify your migration:

- [ ] Update `Cargo.toml` dependencies to v0.13
- [ ] Rename `miden-objects` → `miden-protocol` imports
- [ ] Rename `miden-lib` → `miden-standards` imports
- [ ] Rename `StdLibrary` → `CoreLibrary`
- [ ] Update storage slot access to use `StorageSlotName`
- [ ] Refactor `NoteMetadata` to use `NoteAttachment`
- [ ] Update input notes API to use unified interface
- [ ] Update MASM syntax (`const.` → `const `, etc.)
- [ ] Run `cargo build` — **no errors**
- [ ] Run `cargo test` — **all tests pass**

:::tip You're done!
If your project builds and all tests pass, you've successfully migrated to v0.13.
:::
