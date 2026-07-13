---
sidebar_position: 1
title: "Imports & Dependencies"
description: "Crate version bumps, import relocations, and MSRV changes in v0.14"
---

# Imports & Dependencies

:::warning Breaking Change
Miden VM dependencies move from 0.20 to 0.22 and `miden-crypto` from 0.19 to 0.23. Several types have been relocated across crates, and `Felt::as_int()` has been renamed.
:::

## Quick Fix

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

---

## Version Bumps

| Crate | v0.13 | v0.14 |
|-------|-------|-------|
| `miden-protocol` | 0.13 | 0.14 |
| `miden-standards` | 0.13 | 0.14 |
| `miden-assembly` | 0.20 | 0.22 |
| `miden-core` | 0.20 | 0.22 |
| `miden-core-lib` | 0.20 | 0.22 |
| `miden-processor` | 0.20 | 0.22 |
| `miden-prover` | 0.20 | 0.22 |
| `miden-crypto` | 0.19 | 0.23 |

---

## `ExecutionOptions`, `ProvingOptions`, `ExecutionProof` Relocated

These types moved out of `miden-air` into their respective crates:

```rust
// Before (0.13)
use miden_air::{ExecutionOptions, ProvingOptions, ExecutionProof};

// After (0.14)
use miden_processor::ExecutionOptions;
use miden_prover::ProvingOptions;
use miden_core::ExecutionProof;
```

---

## `Felt::as_int()` → `Felt::as_canonical_u64()`

The `Felt::as_int()` method has been renamed to `Felt::as_canonical_u64()` for clarity:

```rust
// Before (0.13)
let value: u64 = felt.as_int();

// After (0.14)
let value: u64 = felt.as_canonical_u64();
```

:::tip
Use find-and-replace across your codebase: `as_int()` → `as_canonical_u64()`.
:::

---

## MSRV (Minimum Supported Rust Version)

If you depend on `miden-client`, update your `rust-toolchain.toml` to Rust **1.91**:

```toml title="rust-toolchain.toml"
[toolchain]
channel = "1.91"
```

---

## Migration Steps

1. Bump every Miden crate version in `Cargo.toml` per the table above.
2. Move imports of `ExecutionOptions`, `ProvingOptions`, `ExecutionProof` to their new homes.
3. Replace all `Felt::as_int()` calls with `Felt::as_canonical_u64()`.
4. If you depend on `miden-client`, update your `rust-toolchain.toml` to Rust 1.91.
5. Run `cargo update` to pull the new versions.
6. Run `cargo build` and fix any remaining import errors.

---

## Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `unresolved import miden_air::ExecutionOptions` | Type moved | Import from `miden_processor::ExecutionOptions`. |
| `no method named as_int found for Felt` | Method renamed | Use `Felt::as_canonical_u64()`. |
| `package requires rustc 1.91` | MSRV bumped | Update toolchain. |
