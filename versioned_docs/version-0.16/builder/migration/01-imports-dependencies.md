---
sidebar_position: 1
title: "Imports & Dependencies"
description: "Crate version bumps, the VM 0.23 to 0.29 jump, MSRV 1.96, and the artifacts that must be regenerated for v0.16"
---

# Imports & Dependencies

:::warning Breaking Change
The protocol crates move from 0.15.3 to **0.16.0**, `miden-client` from 0.15 to **0.16.0**, and the VM crates jump **0.23 → 0.29.1** — six minor versions, not one. `miden-crypto` was absorbed into the Miden VM workspace and now shares its version number (0.25 → **0.29.1**). The MSRV is Rust **1.96**. Because the MAST wire format, the package format, and several commitment preimages changed, **0.15 artifacts do not round-trip**: re-assemble every package from source, recreate your local store, and upgrade your node in lockstep with your client.
:::

## Quick Fix

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

:::note Pin the exact version
The 0.16 protocol and client crates currently publish as `0.16.0-rc.N` pre-releases. Cargo does **not** match a pre-release against a plain requirement, so `miden-protocol = "0.16"` will fail to resolve. Pin the exact string as shown above until the final release is published.
:::

:::warning 0.15 artifacts do not round-trip
The MAST wire format moved `0.0.3` → `0.0.4` and the package format `4.0.0` → `6.0.0`, so **serialized packages and `MastForest` blobs from 0.15 will not load**. The `.masl` library format no longer exists at all. Several commitment preimages also changed (ECDSA public keys, MMR peaks, empty domain-separated hashes), so derived values must be recomputed. Re-assemble from source and re-sync into a fresh store.
:::

---

## Summary

Every layer of the stack moves:

- The **protocol crates** (`miden-protocol`, `miden-standards`, `miden-tx`, `miden-testing`) go `0.15.3` → `0.16.0`.
- The **VM crates** (`miden-assembly`, `miden-core`, `miden-core-lib`, `miden-processor`, `miden-prover`, `miden-mast-package`) go `0.23` → `0.29.1`. This is a much larger jump than previous releases and carries breaking MASM language changes — see [VM & Assembler Changes](./vm-assembler).
- **`miden-crypto`** goes `0.25` → `0.29.1`. It is no longer an independent crate line: it was imported into the Miden VM workspace and now shares the VM version number.
- **`miden-client`** and `miden-client-sqlite-store` go `0.15` → `0.16.0`.
- The **Web SDK** packages go `0.15` → `0.16.0`.

Two crates changed identity: `miden-tx-batch-prover` is now **`miden-tx-batch`**, and a new **`miden-protocol-build-utils`** crate provides MASM assembly helpers. On the VM side the core package was split, adding a **`miden-precompiles`** package alongside `miden-core`.

---

## Version Bumps

| Crate | v0.15 | v0.16 |
|-------|-------|-------|
| `miden-client` | 0.15 | 0.16.0 |
| `miden-client-sqlite-store` | 0.15 | 0.16.0 |
| `miden-protocol` | 0.15.3 | 0.16.0 |
| `miden-standards` | 0.15.3 | 0.16.0 |
| `miden-tx` | 0.15.3 | 0.16.0 |
| `miden-testing` | 0.15.3 | 0.16.0 |
| `miden-tx-batch-prover` | 0.15.3 | **renamed** to `miden-tx-batch` 0.16.0 |
| `miden-protocol-build-utils` | — | 0.16.0 *(new)* |
| `miden-assembly` | 0.23 | 0.29.1 |
| `miden-core` | 0.23 | 0.29.1 |
| `miden-core-lib` | 0.23 | 0.29.1 |
| `miden-processor` | 0.23 | 0.29.1 |
| `miden-prover` | 0.23 | 0.29.1 |
| `miden-verifier` | 0.23 | 0.29.1 |
| `miden-mast-package` | 0.23 | 0.29.1 |
| `miden-precompiles` | — | 0.29.1 *(new)* |
| `miden-crypto` | 0.25 | 0.29.1 |

| npm package | v0.15 | v0.16 |
|-------------|-------|-------|
| `@miden-sdk/miden-sdk` | 0.15.x | 0.16.0 |
| `@miden-sdk/react` | 0.15.x | 0.16.0 |
| `@miden-sdk/vite-plugin` | — | 0.16.0 |

:::note `miden-idxdb-store` is not a package
Earlier guidance listed a `miden-idxdb-store` npm dependency. No such package exists on the public registry — the IndexedDB store ships inside `@miden-sdk/miden-sdk`. Remove it from your `package.json` if you carried it over.
:::

---

## Affected Code

**Cargo.toml:**
```diff
- miden-client              = "0.15"
- miden-client-sqlite-store = "0.15"
- miden-protocol            = "0.15.3"
- miden-standards           = "0.15.3"
- miden-tx                  = "0.15.3"
- miden-tx-batch-prover     = "0.15.3"
- miden-assembly            = "0.23"
- miden-core                = "0.23"
- miden-core-lib            = "0.23"
- miden-processor           = "0.23"
- miden-prover              = "0.23"
- miden-crypto              = "0.25"
+ miden-client              = "0.16.0-rc.1"
+ miden-client-sqlite-store = "0.16.0-rc.1"
+ miden-protocol            = "0.16.0-rc.6"
+ miden-standards           = "0.16.0-rc.6"
+ miden-tx                  = "0.16.0-rc.6"
+ miden-tx-batch            = "0.16.0-rc.6"
+ miden-assembly            = "0.29.1"
+ miden-core                = "0.29.1"
+ miden-core-lib            = "0.29.1"
+ miden-processor           = "0.29.1"
+ miden-prover              = "0.29.1"
+ miden-crypto              = "0.29.1"
```

**package.json (Web SDK):**
```diff
- "@miden-sdk/miden-sdk": "^0.15.0",
- "@miden-sdk/react": "^0.15.0",
- "miden-idxdb-store": "^0.15.0"
+ "@miden-sdk/miden-sdk": "0.16.0-rc.2",
+ "@miden-sdk/react": "0.16.0-rc.2"
```

---

## MSRV (Minimum Supported Rust Version)

The MSRV rose across the board. Update your `rust-toolchain.toml` to Rust **1.96**:

```toml title="rust-toolchain.toml"
[toolchain]
channel = "1.96"
```

| Component | v0.15 | v0.16 |
|-----------|-------|-------|
| protocol crates | 1.90 | 1.96.1 |
| `miden-client` | 1.93 | 1.96 |
| Miden VM | 1.90 | 1.96 |

---

## Migration Steps

1. Bump every Miden crate per the table above, pinning the exact `0.16.0-rc.N` strings for the protocol and client crates, and run `cargo update`.
2. Rename the `miden-tx-batch-prover` dependency to **`miden-tx-batch`** if you used it.
3. Set your toolchain to at least Rust `1.96`.
4. Bump `@miden-sdk/miden-sdk` and `@miden-sdk/react` together — mixing 0.15 and 0.16 packages will not link against the shared WASM ABI. Drop any `miden-idxdb-store` dependency.
5. Re-assemble every `.masp` package from source under the new toolchain, and delete cached `MastForest` blobs. The `.masl` format is gone entirely.
6. **Recreate your local store.** The SQLite store's schema fingerprint changed and existing databases are rejected; browser users have their IndexedDB store cleared automatically on the version bump. See [Client Changes](./client-changes).
7. **Upgrade your node together with your client.** 0.16 clients seal transaction inputs before submission; a 0.16 node rejects plaintext submissions and an older node rejects sealed ones, so the two cannot be mixed.

---

## Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `failed to select a version for miden-protocol` | A plain `"0.16"` requirement will not match a `0.16.0-rc.N` pre-release | Pin the exact version string, e.g. `"0.16.0-rc.6"`. |
| `failed to select a version for miden-tx-batch-prover` | Crate renamed in 0.16 | Depend on `miden-tx-batch` instead. |
| `MastForest deserialization failed: unexpected version` | MAST wire format moved to `0.0.4` | Re-assemble every package from source under VM 0.29.1. |
| package fails to load with a version mismatch | Package format moved to `6.0.0` | Rebuild the `.masp`; `.masl` is no longer supported at all. |
| `Migration error: Attempt to migrate a database with a migration number that is too high` | Existing SQLite store predates the 0.16 schema | Delete and recreate the store, then re-sync. |
| Node rejects a submitted transaction | Client and node versions are mixed | Upgrade both to 0.16; sealed and plaintext submissions are mutually incompatible. |
| `rustc` version error during build | MSRV raised to 1.96 | Update `rust-toolchain.toml`. |
