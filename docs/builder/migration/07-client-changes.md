---
sidebar_position: 7
title: "Client Changes"
description: "Rust, Web, React and CLI client changes, plus the mandatory local store recreation"
---

# Client Changes

:::danger Your local store must be recreated
Every pre-0.16 SQLite store is rejected. There is no migration path: delete the database and re-sync. Browser applications are handled automatically — the IndexedDB store detects the version bump and wipes itself on first open. In both cases **any state that existed only locally is lost**, including records for accounts not yet committed on-chain.
:::

:::warning Client and node must be upgraded together
0.16 clients seal (encrypt) transaction inputs before submission. A 0.16 node rejects plaintext submissions and an older node rejects sealed ones, so the two cannot be mixed. Upgrade both.
:::

## Quick Fix

```bash
# CLI: the send subcommand was renamed
miden-client transfer -t <TARGET> -a 100::<FAUCET> -n private
```

```rust
// Rust: account updates are absolute patches now
let patch = tx_result.account_patch();
```

```typescript
// Web: same split on the TypeScript side
const patch = txResult.accountPatch();
```

If you encounter errors, continue reading for detailed migration steps.

---

## Summary

The client changes fall into four groups. The **store break** is the one that costs users data, and it is unavoidable. The **fee and sealing changes** are covered in [Transaction Changes](./transaction-changes) — they surface here as a new builder method and a node-version requirement. The **rename churn** (`account_delta` → `account_patch`, `send` → `transfer`, and friends) is mechanical. And a handful of **silent behavioural changes** — the `call` argument counting, the transaction summary display, `notes.sendPrivate` requiring a scan height — will not fail your build but will change what your application does.

---

## (Store) Every pre-0.16 SQLite store must be recreated

### Summary

The store schema changed substantially: account SMT forest tables were added, account IDs and all digest columns were retyped from hex `TEXT` to `BLOB`, a `script_root` index was added, and the `migrations` table was dropped in favour of a schema fingerprint.

### Affected Code

A store written by miden-client 0.15.5 fails to open with:

```text
Migration error: Attempt to migrate a database with a migration number that is too high
```

:::note This is not the error the changelog names
The changelog says opening a pre-0.16 database fails with `SchemaHashMismatch`. In practice a 0.15.5 store sits at `user_version = 2`, and because 0.16 defines only one migration the fingerprint check is skipped entirely — the failure surfaces from the migration layer instead. `SchemaHashMismatch` is only reached by a store at `user_version = 1`. Both paths fail; only the message differs.
:::

Beyond the account ID retyping, the schema diff also shows the `latest_account_assets` and `historical_account_assets` column `vault_key` renamed to `asset_id` (following the [protocol rename](./asset-vault-faucet)), a new unique index on `tags(tag, source)`, and *all* digest columns retyped to `BLOB` — `account_commitment`, `note_id`, `nullifier`, `script_root`, `recipient_digest`, and storage keys and values.

### Migration Steps

1. Delete the store database and let the client recreate it, then re-sync.
2. Export anything you need to keep **before** upgrading — private note files in particular.
3. Browser applications need no action; the IndexedDB store resets itself when the client's minor version increases.
4. If you implement a custom `Store`, note that `insert_block_header` now takes a `nodes` argument, `insert_partial_blockchain_nodes` was removed, and the new `NoteFilter::ScriptRoots` variant makes existing exhaustive matches fail to compile.

---

## (Rust) Account updates use `AccountPatch`

`TransactionResult::account_delta()` became `account_patch()`, and `Account::apply_delta` was replaced by construction from a patch. `TransactionSummary::account_delta()` is deliberately unchanged. This is covered in full under [Account Changes](./account-changes#account-updates-move-from-accountdelta-to-accountpatch).

One import detail specific to the client: in 0.15 `AccountStorageDelta` lived in `miden_client::asset`; the 0.16 replacement `AccountStoragePatch` lives in `miden_client::account`. The module moved as well as the name. `StorageMapDelta` and `StorageSlotDelta` were dropped from `miden_client::asset` alongside it, while `AccountVaultDelta` remains there.

---

## (Rust) Fee conversion info on the transaction request

`TransactionRequestBuilder::fee_conversion_info(info, salt)` is new and required on fee-charging chains for `AuthSingleSig` and `AuthMultisig` accounts. See [Transaction Changes](./transaction-changes#transaction-fees-are-paid-by-the-auth-procedure) for the full flow, including the mandatory `salt` argument that the changelog omits.

---

## (Rust) Fungible amounts use `AssetAmount`

### Summary

The client surface switched from raw `u64` to `AssetAmount` for fungible amounts. `AccountReader::get_balance` returns `AssetAmount`, and the token conversion helpers (`tokens_to_base_units`, `base_units_to_tokens`) and `build_pswap_consume` follow.

### Migration Steps

1. Wrap raw amounts with `AssetAmount`, or unwrap with the provided accessor where you need a `u64`.
2. Handle `TokenParseError::InvalidAmount` where you parse user-supplied amounts.

---

## (Rust) Auth and faucet re-exports changed

### Summary

`AuthMethod` and `AuthSingleSigAcl` were removed, and the single fungible faucet factory split into auth-specific factories — see [Assets, Vault & Faucet Changes](./asset-vault-faucet#faucet-factories-split-by-authentication-scheme). Note that the client re-exports only two of the six upstream factory functions; for the rest, depend on `miden-standards` directly.

The account policy components were also renamed, a change absent from the changelog and found by diffing the re-export lists:

```diff
- AllowlistOwnerControlled
+ AllowlistManager
- BlocklistOwnerControlled
+ BlocklistManager
```

---

## (Rust) Note screening methods renamed

### Summary

`NoteScreener::can_consume` became `get_consumability`, and `can_consume_batch` became `get_batch_consumability`. A new `get_batch_consumability_for_account` was added. `Client::get_consumable_notes` keeps its signature — passing a single account is now screened more efficiently, but nothing about the call changes.

:::note The rename is cosmetic
The changelog justifies it by saying the methods now return a consumption status per account rather than a boolean. They never returned a boolean — the return type is identical in 0.15 and 0.16. Rename the call sites; do not change how you handle the result.
:::

---

## (Rust) Debug mode removed

`DebugMode`, `ClientBuilder::in_debug_mode`, `Client::in_debug_mode`, and the `MIDEN_DEBUG` environment variable were all removed. The VM replaced the flag-gated `debug.*` decorators with `miden::core::debug` procedures that print unconditionally, so there is nothing left to gate. See [MASM Changes](./masm-changes#debug-and-trace-decorators-removed).

---

## (Rust) Other library changes

- **`StateSyncUpdate` is immutable** — construct with `from_parts`, read through accessors, and destructure with `into_parts`. `PartialBlockchainUpdates::insert` lost its nodes argument, and `extend_authentication_nodes` was added.
- **`miden_client::assembly::Library` was removed.** Use `miden_client::vm::Package`. Note that `Package` is not new — it was already re-exported in 0.15; only the `Library` removal is a 0.16 change.
- **`Client::fetch_all_private_notes` was removed**, replaced by note transport syncing.
- **`TransactionRecord` gained a private field**, so struct literal construction no longer compiles.
- **`send_notes` reads its payload from the advice provider** and requires a payload-commitment script argument. A `script_arg` passed alongside a `SendNotes` template is ignored.
- **`AccountSmtForest` is generic over its backend**, and the root-staging API was removed.
- **Response verification moved into `VerifyingRpcClient`.** The built-in gRPC constructors now wrap the transport in it automatically, but `ClientBuilder::rpc` does **not** — passing your own `NodeRpcClient` compiles and runs while silently losing response verification. Wrap it yourself with `VerifyingRpcClient::new(..)`.

---

## (Web) Package and API changes

Bump `@miden-sdk/miden-sdk` and `@miden-sdk/react` together — mixing 0.15 and 0.16 packages will not link against the shared WASM ABI.

| Change | Migration |
| --- | --- |
| `ClientOptions.debugMode` removed; `createClient*` drops the trailing `debugMode` argument | Delete the option and the argument. |
| `accountDelta()` → `accountPatch()`; `AccountStorageDelta` removed | Rename. `TransactionSummary.accountDelta()` is unchanged. |
| `TransactionSummary.salt()` → `userParams()` | Rename; the value is now seven field elements. |
| `transactions.preview(..)` returns only a summary while authorization is pending | Do not expect full transaction details from a preview. |
| `notes.sendPrivate` requires `scanAfterBlockNum`; new `notes.sendPrivateOutput` | Pass a scan height. |
| `notes.fetchPrivate({ mode: "all" })` removed | Use note transport syncing. |
| `AccountComponent.createNetworkAuth` → `createNetworkAuthComponents` | Rename; it now returns several components. |
| `FungibleAsset.withCallbacks(flag)` removed | Set callbacks on the account at construction. |
| P2ID and P2IDE notes must carry at least one asset | Building an empty note now throws. |
| Production WASM strips MASM debug metadata | Expect less detail in production stack traces. |
| Notes carrying a `NetworkAccountTarget` are priced via a foreign procedure invocation into the target | Behavioural; see the note below. |

Additive: `notes.list({ scriptRoots })`, `NoteScript.networkAccountConfig()`, `NoteScript.feeSponsorship()`, and `compile.component({ namespace })`.

If you author MASM through the Web SDK, the language changes apply to you as well — `@account_procedure` annotations, `mod` declarations, and the new import syntax. See [MASM Changes](./masm-changes).

:::caution Unverified
The `NetworkAccountTarget` foreign-procedure-invocation requirement is reported from the changelog. We were not able to locate the enforcing call site in source, so treat it as a lead rather than a confirmed behaviour.
:::

---

## (React) Send hooks relay through `sendPrivateOutputNote`

`useSend`, `useTransaction`, and `useMultiSend` now relay private note output via `sendPrivateOutputNote`, following the `notes.sendPrivate` change above. If you wrapped these hooks, re-check the relay path.

---

## (CLI) `send` renamed to `transfer`

### Summary

The `send` subcommand is now `transfer`. Nothing else changed — every flag, short form, and default is identical. `send` is **not** kept as an alias, so existing scripts fail with an unknown-subcommand error.

### Affected Code

```bash
# Before (0.15)
miden-client send -s <SENDER> -t <TARGET> -a 100::<FAUCET> -n private

# After (0.16)
miden-client transfer -s <SENDER> -t <TARGET> -a 100::<FAUCET> -n private
```

### Migration Steps

Replace `miden-client send` with `miden-client transfer` in scripts, aliases, and CI jobs. Change nothing else.

---

## (CLI) `account --with-code` replaced by `account --inspect`

### Summary

`--with-code`, which dumped the account code as one pretty-printed blob, is gone. `account --inspect <ID>[:<PROCEDURE>]` lists the procedures an account exposes, split into resolved procedures (name, signature, originating package) and unresolved ones listed by MAST root.

### Affected Code

```bash
# Before (0.15)
miden-client account --show <ID> --with-code

# After (0.16)
miden-client account --inspect <ID>                     # list procedures
miden-client account --inspect <ID> --verbose           # with MASM disassembly
miden-client account --inspect <ID>:receive_asset       # a single procedure
miden-client account --inspect <ID> -p ./component.masp # resolve names from extra packages
```

### Migration Steps

1. Replace `account --show <ID> --with-code` with `account --inspect <ID> --verbose`.
2. `--inspect` is mutually exclusive with `--list`, `--show`, and `--default`.
3. `--package` and `--verbose` both require `--inspect`.
4. Expect `<unresolved>` entries for procedures whose package the CLI cannot find; pass `--package` to resolve them.

---

## (CLI) `call` counts arguments in field elements

### Summary

`call` validates argument count against the procedure's signature. In 0.15 it compared against the number of *parameters*; in 0.16 it compares against the total stack width in *field elements*. A procedure taking one `Word` now needs four `--args` values.

This change is not in the changelog.

### Affected Code

```bash
# A procedure with signature `set_item(Word) -> ()`

# Before (0.15): one parameter, one argument
miden-client call <ID>:set_item -p component.masp --args 0x1234

# After (0.16): a Word is four felts wide
miden-client call <ID>:set_item -p component.masp --args <f0> <f1> <f2> <f3>
```

### Migration Steps

1. Re-check every scripted `call` whose procedure takes or returns anything wider than one field element.
2. Expand each wide argument into one value per field element, in signature order.
3. Read the `Raw Signature:` line the command prints — it is now the authoritative stack layout.

A mismatched count fails with a clear error rather than executing with a mis-shaped stack, so this one fails loudly.

---

## (CLI) `token_symbol_map.toml`: `id` renamed to `address`

### Summary

The per-symbol entry key changed from `id` to `address`. The value format is unchanged — it was already a bech32 address — so this is a pure key rename. A file still using `id` fails to parse rather than falling back.

### Affected Code

```toml
# Before (0.15)
BTC = { id = "mlcl1qru2e5yvx40ndgqqqzusrryr0ucyd0uj", decimals = 8 }

# After (0.16)
BTC = { address = "mlcl1qru2e5yvx40ndgqqqzusrryr0ucyd0uj", decimals = 8 }
```

### Migration Steps

1. Rename `id =` to `address =` on every entry. Leave the values alone.
2. The file lives in the `.miden` directory alongside `miden-client.toml`. If you have both a local and a global `.miden` directory, update both.

---

## (CLI) `init` writes a different package set

### Summary

`init` now writes nine bundled `.masp` component packages instead of seven.

```text
# Added in 0.16
basic-non-fungible-faucet.masp
auth/guarded-multisig-auth.masp
auth/network-account-auth.masp

# Removed in 0.16
auth/acl-auth.masp
```

The removal is the CLI-side consequence of dropping `AuthSingleSigAcl`, and it is the one most likely to break an existing setup. The changelog mentions only the additions.

Two error-reporting changes also landed: running `init` where a config already exists now names the configured network and points at `clear-config`, and an unparseable `--remote-prover-endpoint` is a hard error instead of being silently discarded.

---

## (CLI) Other changes

- **`--debug` and `MIDEN_DEBUG` removed.** Passing `--debug` is now a usage error; setting `MIDEN_DEBUG` is silently ignored.
- **The pre-confirmation transaction summary shows absolute values, not deltas** — including a column rename and `Nonce incremented by: N` becoming `New account nonce: N`. This follows from the `AccountPatch` move but changes what users read before approving a transaction.
- **`swap` gained `--payback-note-type <private|public>`**, defaulting to `private` (0.15 hardcoded private). Note that `pswap` already had this flag in 0.15 with the same default. The tag the command tells you to track also changed, from a swap-specific tag to an account-target tag derived from the sender's account ID.
- **`consume-notes` gained `--start-debug-adapter <ADDR>` and `--record <FILE>`; `exec` gained `--record`.** `exec --start-debug-adapter` already existed in 0.15. Both require a build with the `dap` feature, which is not enabled by default.

---

## Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `Migration error: Attempt to migrate a database with a migration number that is too high` | Pre-0.16 store | Delete and recreate the store. |
| `error: unrecognized subcommand 'send'` | Renamed | Use `transfer`. |
| `error: unexpected argument '--with-code'` | Removed | Use `--inspect`. |
| `Procedure '<name>' expects 4 value(s), got 1` | Arguments counted in field elements | Expand wide arguments. |
| `missing field 'address'` parsing the token map | Key renamed | Rename `id` to `address`. |
| `error: unexpected argument '--debug'` | Removed | Delete the flag. |
| `no method named account_delta` on a transaction result | Renamed | Use `account_patch()`. |
| Node rejects a submission | Mixed client and node versions | Upgrade both to 0.16. |
| A component package is missing after `init` | `auth/acl-auth.masp` was removed | Migrate off `AuthSingleSigAcl`. |
