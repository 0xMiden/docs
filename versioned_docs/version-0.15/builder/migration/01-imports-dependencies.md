---
sidebar_position: 1
title: "Imports & Dependencies"
description: "Crate version bumps, MSRV changes, and the non-round-tripping 0.14 artifacts in v0.15"
---

# Imports & Dependencies

:::warning Breaking Change
Miden VM dependencies move from 0.22 to 0.23 and `miden-crypto` from 0.23 to 0.25. The protocol crates move from 0.14 to **0.15.3** and `miden-client` from 0.14 to 0.15, and the client's MSRV is now Rust **1.93**. Because the native hash and the MAST/serialization formats changed, **0.14 artifacts (accounts, notes, proofs, serialized stores, `.masl`/`.masp` packages) do not round-trip.**
:::

## Quick Fix

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

---

## Summary

Every Miden crate moves up a minor: the protocol crates (`miden-protocol`, `miden-standards`, `miden-tx`, `miden-testing`) go `0.14` → `0.15.3`, the VM crates (`miden-assembly`, `miden-core`, `miden-core-lib`, `miden-processor`, `miden-prover`) go `0.22` → `0.23`, and `miden-crypto` goes `0.23` → `0.25`. `miden-client` and `miden-client-sqlite-store` go `0.14` → `0.15`; the Web SDK packages go `0.14` → `0.15`. The client's MSRV is Rust **1.93** (the base crates build on 1.90+).

> The prover crate is **`miden-prover`** in this line — it is *not* `miden-prove`. Keep depending on `miden-prover`.

Because the native hash and the MAST/serialization formats changed upstream, **0.14 artifacts (accounts, notes, proofs, serialized stores, `.masl`/`.masp` packages) do not round-trip.** Re-assemble from source and re-sync into a fresh store.

---

## Version Bumps

| Crate | v0.14 | v0.15 |
|-------|-------|-------|
| `miden-client` | 0.14 | 0.15 |
| `miden-client-sqlite-store` | 0.14 | 0.15 |
| `miden-protocol` | 0.14 | 0.15.3 |
| `miden-standards` | 0.14 | 0.15.3 |
| `miden-tx` | 0.14 | 0.15.3 |
| `miden-assembly` | 0.22 | 0.23 |
| `miden-core` | 0.22 | 0.23 |
| `miden-core-lib` | 0.22 | 0.23 |
| `miden-processor` | 0.22 | 0.23 |
| `miden-prover` | 0.22 | 0.23 |
| `miden-crypto` | 0.23 | 0.25 |

---

## Affected Code

**Cargo.toml:**
```diff
- miden-client              = "0.14"
- miden-client-sqlite-store = "0.14"
- miden-protocol            = "0.14"
- miden-standards           = "0.14"
- miden-tx                  = "0.14"
- miden-assembly            = "0.22"
- miden-core                = "0.22"
- miden-core-lib            = "0.22"
- miden-processor           = "0.22"
- miden-prover              = "0.22"
- miden-crypto              = "0.23"
+ miden-client              = "0.15"
+ miden-client-sqlite-store = "0.15"
+ miden-protocol            = "0.15.3"
+ miden-standards           = "0.15.3"
+ miden-tx                  = "0.15.3"
+ miden-assembly            = "0.23"
+ miden-core                = "0.23"
+ miden-core-lib            = "0.23"
+ miden-processor           = "0.23"
+ miden-prover              = "0.23"
+ miden-crypto              = "0.25"
```

**package.json (Web SDK):**
```diff
- "@miden-sdk/miden-sdk": "^0.14.0",
- "@miden-sdk/react": "^0.14.0",
- "miden-idxdb-store": "^0.14.0"
+ "@miden-sdk/miden-sdk": "^0.15.0",
+ "@miden-sdk/react": "^0.15.0",
+ "miden-idxdb-store": "^0.15.0"
```

---

## MSRV (Minimum Supported Rust Version)

If you depend on `miden-client`, update your `rust-toolchain.toml` to Rust **1.93** (the base crates build on 1.90+):

```toml title="rust-toolchain.toml"
[toolchain]
channel = "1.93"
```

---

## Migration Steps

1. Bump every Miden crate per the table above and run `cargo update` to pull the matching `miden-crypto 0.25` and VM `0.23` minors.
2. Do **not** rename `miden-prover` to `miden-prove`.
3. Set the client toolchain to at least Rust `1.93`.
4. Bump `@miden-sdk/miden-sdk`, `@miden-sdk/react`, and `miden-idxdb-store` to `^0.15.0` together — a mix of 0.14/0.15 packages will not link against the shared WASM ABI.
5. Point the client at a `0.15` node (the protocol version is negotiated at connect; a mismatch is rejected), and re-sync into a fresh store.

---

## Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `failed to select a version for miden-prove` | Crate not renamed in 0.15 | Keep depending on `miden-prover`. |
| `MastForest deserialization failed: unexpected version` | MAST wire format bumped to `0.0.3` | Re-assemble every `.masl`/`.masp` from source under `0.23`. |
| node version negotiation failure | `0.15` client against a `0.14` node | Upgrade the node to `0.15`. |
