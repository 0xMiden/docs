---
sidebar_position: 7
title: "Client Changes"
description: "Local state that does not survive the upgrade, client and node pairing, the fee faucet from the synced protocol configuration, and Rust, Web, React and CLI changes"
---

# Client Changes

:::danger Your local store must be recreated
A 0.16 SQLite store is not rejected up front. The SQL schema did not change, so the store opens, and the 0.17 client fails the first time it decodes a protocol object that 0.16 wrote: `failed to deserialize data from the store`. For a store that has ever synced this happens inside `ClientBuilder::build`, before the client exists. There is no migration path: delete the database and re-sync. Browser applications are handled automatically, as in 0.16: the IndexedDB store detects the version bump and deletes the whole database on first open. **The default browser keystore keeps its secret keys in that database, so the reset deletes every key it holds.** Back the keys up on 0.16.3 before upgrading (see the Web SDK steps in [(Store)](#store-every-016-sqlite-store-must-be-recreated)); only an app with an external keystore (`keystore` callbacks) keeps its keys. In both cases **any state that existed only locally is lost**, including private account state and notes not yet on chain.
:::

:::danger 0.16 account and note files do not import
`AccountFile` and `NoteFile` are Protobuf-encoded in 0.17, and there is no reader for the 0.16 format. `.mac` / `.mno` files exported by a 0.16 client, and `AccountFile` / `NoteFile` bytes serialized by Web SDK 0.16, fail to decode. **The 0.16 guide's advice to export private note files before upgrading does not work for this upgrade.** Consume private notes on 0.16 before upgrading, or have the sender re-send them once both sides run 0.17. What carries over is the filesystem keystore directory (CLI, Rust client, Node.js) and the CLI's `miden-client.toml`; the default browser keystore does not.
:::

:::warning Client, node, remote prover and note transport move together
A 0.17 client talks only to a 0.17 node: the node matches major.minor, so a 0.16 node rejects every 0.17 client. The remote prover wire format and the note transport gRPC service changed as well, so both services must be upgraded to 0.17. See [(Node) Client, node, remote prover and note transport must all be 0.17](#node-client-node-remote-prover-and-note-transport-must-all-be-017).
:::

## Quick Fix

```bash
# CLI: delete the 0.16 store and refresh the bundled packages; miden-client.toml and the keystore carry over
rm ~/.miden/store.sqlite3
( cd "$(mktemp -d)" && miden-client init --local >/dev/null \
  && rm -rf ~/.miden/packages && cp -R .miden/packages ~/.miden/packages )
# point [rpc] endpoint AND [note_transport] endpoint in miden-client.toml at 0.17 services, then
miden-client sync
```

```rust
// Rust: the fee faucet comes from the synced protocol configuration, not the block header
client.sync_state().await?;
let header = client.get_latest_block_header().await?;
let fee_faucet_id = client
    .get_protocol_config(header.protocol_config_commitment())
    .await?
    .fee_asset_id()
    .faucet_id();
```

```bash
# Web: back up browser-keystore keys on 0.16.3 first (see (Store)), then bump every @miden-sdk/* package together
npm install @miden-sdk/miden-sdk@0.17.0 @miden-sdk/react@0.17.0
```

```typescript
// Web: point rpcUrl and noteTransportUrl at 0.17 services, sync, then read the fee faucet
const client = await MidenClient.create({ rpcUrl: "devnet", noteTransportUrl: "devnet" });
await client.sync();
const feeFaucet = await client.feeFaucetId(); // replaces header.feeFaucetId()
```

If you encounter errors, continue reading for detailed migration steps.

---

## Summary

The client changes fall into five groups. **Local state does not survive the upgrade**: the SQLite store, the IndexedDB store (with the default browser keystore's secret keys), exported `.mac` / `.mno` files and the CLI's bundled `.miden/packages` all have to be recreated or backed up first, and only the package failure names a version. **Deployment pairing** is stricter: client, node, remote prover and note transport service must all be 0.17, and a 0.17 node may require an invitation code before it creates a new account. **The fee faucet left the block header**: both the Rust client and the Web SDK now read it from the protocol configuration the node delivers on sync, so sync before executing. **Rename churn** (`ValidatorKeys` → `ValidatorConfig`, `ProvingOptions` → `Prover`, `AccountType.FungibleFaucet` → `FaucetType.FungibleFaucet`, `exec --script-path` → `exec --package`, new trait methods and error variants) fails to compile or fails loudly. And several **silent behavioural changes** will not fail your build: multisig requests built with `fee_conversion_salt` fail at execution, `expiration_delta` now expires consume-only requests, a note stranded by a discarded transaction is refused, a broken note transport no longer fails `sync_state`, the keystore returns an empty set instead of an error, and the Web SDK drops block-locked notes from "available" lists.

---

## (Store) Every 0.16 SQLite store must be recreated

### Summary

The 0.17 client cannot read data a 0.16 client wrote. Block headers, accounts and notes are stored in the protocol's binary encoding, which changed: for example `BlockHeader` replaced `tx_kernel_commitment` / `validator_keys` with `validator_config`, `protocol_config_commitment` and `next_protocol_config`, and `FeeParameters` lost the fee faucet. The SQL migrations are byte-identical between the two releases, so the migration layer accepts a 0.16 store and reports nothing to do, and nothing checks the store version. The failure comes from decoding the first stored protocol object.

### Affected Code

The 0.17.0 CLI on a store written and synced by the 0.16 CLI fails on every command that builds a client (`account`, `notes`, `tx`, `info`, `sync`, `new-wallet`) with exit code 1:

```text
Error: cli::client_error

  × client error
  ├─▶ storage error
  ├─▶ failed to deserialize data from the store
  ╰─▶ invalid value: validator set must contain at least one key
```

In Rust the same store makes `ClientBuilder::build().await` return `ClientError::StoreError(StoreError::DataDeserializationError(_))`. The innermost message depends on the bytes being decoded; only the first three lines are stable.

A 0.16 store that never synced (no genesis header stored) gets past `build`, and even `account -l` works, but the first read of a full account fails the same way, for example `account -s <ID>` (or `account --inspect <ID>` once `.miden/packages` is refreshed) with `invalid value: account code procedures following the authentication procedure are not sorted in ascending order`. Either way the store is unusable.

:::note There is no migration or schema error to look for
The changelog says a new client database is required, which is true, but not how an old one fails. Unlike the 0.15 to 0.16 upgrade, which failed in the migration layer, there is no schema or migration error to match on: look for `failed to deserialize data from the store`, with a cause underneath that depends on the bytes being decoded.
:::

### Migration Steps

**Rust and CLI (SQLite store)**

1. Delete the store file (`store.sqlite3` in the `.miden` directory, or the path you pass to `sqlite_store(path)`) and let the client recreate it, then `sync`.
2. Do not plan to carry private accounts over with `export`: 0.16 `.mac` / `.mno` files do not decode in 0.17 either. A 0.17 client also cannot talk to the 0.16 network the old store was synced against, so plan to recreate accounts on the 0.17 network.
3. Keep the keystore directory. A 0.16 filesystem keystore (key files plus `key_index.json`) loads unchanged in 0.17, and `miden-client keys --list` shows the old keys and their account associations. A recreated account gets a new ID. The CLI can commit it to a kept ECDSA key's public key (`new-wallet --ecdsa <PUBLIC_KEY>`), but `--falcon` always generates a new key.
4. Keep `miden-client.toml`. A 0.16 CLI config parses under 0.17 and the CLI creates a fresh store next to it. Point `[rpc] endpoint` at a 0.17 node **and `[note_transport] endpoint` at a transport that serves `note_transport.Api`**. With a transport that serves only the 0.16 service, `sync` keeps succeeding while private notes stop arriving. Then refresh `.miden/packages` (see [(CLI) Re-create `.miden/packages`](#cli-re-create-midenpackages-after-upgrading)).
5. If you implement a custom `Store`, see the custom-store bullet in [(Rust) Other library changes](#rust-other-library-changes).

**Web SDK (IndexedDB store)**

1. **Back up the browser keystore while the app still runs 0.16.3.** The reset deletes the whole database, and the default browser keystore stores its secret keys in it (table `accountAuth`), so the first 0.17 open deletes every key it holds. Rolling back afterwards cannot bring them back. Apps that pass an external keystore (`keystore: { getKey, insertKey, sign }`) keep their keys outside IndexedDB.

   ```typescript
   // Before upgrading, still on 0.16.3: the first 0.17 open deletes these keys
   const backup: { accountId: string; secretKeys: Uint8Array[] }[] = [];
   for (const header of await client.accounts.list()) {
     const accountId = header.id();
     const secretKeys: Uint8Array[] = [];
     for (const commitment of await client.keystore.getCommitments(accountId)) {
       const key = await client.keystore.get(commitment);
       if (key) secretKeys.push(key.serialize());
     }
     backup.push({ accountId: accountId.toString(), secretKeys });
   }
   // Keep `backup` outside IndexedDB, and encrypted: it holds secret keys
   ```

   The key encoding did not change, so `AuthSecretKey.deserialize(bytes)` reads these bytes in 0.17, and `client.keystore.insert(accountId, key)` stores a key again. A 0.16 `exportStore` dump also holds the keys (hex, in `accountAuth`), but see step 3.
2. Expect the store to be deleted on first open. The SDK logs:

   ```text
   IndexedDB client version mismatch (stored=0.16.3, expected=0.17.0). Resetting store.
   ```

   Re-sync from scratch, and recover accounts from the keys you backed up, or from seeds, not from 0.16 exports.
3. Do not carry a 0.16 `exportStore` dump into a 0.17 client with `importStore`: the import copies tables verbatim, including the stored `clientVersion`.
4. Rolling back from 0.17 to 0.16 does **not** wipe the store (a stored version newer than the client only rewrites the version). Delete the `MidenClientDB_<network>` database, or your `storeName`, yourself.
5. The reset fires only when the stored version is older and a different major.minor, so moving between 0.17 patch releases keeps the store.
6. Point `noteTransportUrl` at a 0.17 transport as well as `rpcUrl` at a 0.17 node. `createTestnet()` and `noteTransportUrl: "testnet"` resolve to `https://transport.miden.io`.
7. Node.js: the Node entry uses a SQLite store that the SDK does not version-check: `~/.miden/stores/<storeName>/<storeName>.db` when you pass `storeName`, and a fresh temporary directory otherwise. Delete the `.db` file yourself; the `keystore` directory next to it is a filesystem keystore and carries over, and the SQLite rules above apply.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `failed to deserialize data from the store` (followed by, for example, `invalid value: validator set must contain at least one key`) | A store written by a 0.16 client | Delete the store and re-sync. |

---

## (Node) Client, node, remote prover and note transport must all be 0.17

### Summary

Every RPC call carries `accept: application/vnd.miden; version=<miden-client crate version>[; genesis=<hex>]`. The node accepts it only if major.minor match its own version; the patch is ignored.

| Client | 0.16.x node | 0.17.x node |
| --- | --- | --- |
| 0.16.1 | accepted | rejected |
| 0.17.0 | rejected | accepted (any 0.17 patch) |

Two more services must match the client:

- **Remote prover.** `remote_prover.ProofRequest` and `Proof` changed from a `proof_type` enum plus an opaque `bytes payload` to typed `oneof` messages. The remote prover has no version negotiation, so a 0.17 client talking to a 0.16 prover fails at decode time rather than with a version error. The endpoint constants (`TESTNET_PROVER_ENDPOINT`, `DEVNET_PROVER_ENDPOINT`, new `MAINNET_PROVER_ENDPOINT`) keep their URLs; the service behind them must match.
- **Note transport.** The client now speaks `note_transport.Api` (defined in the node repository) instead of `miden_note_transport.MidenNoteTransport`. The endpoint URLs are unchanged, so the server behind them must be upgraded. A transport failure no longer fails `sync_state`, so a mismatched transport server is silent; see [(Rust) Note transport](#rust-note-transport-new-service-silent-failures-screening-and-a-new-cursor).

### Affected Code

```text
# What the node returns (gRPC status 3, InvalidArgument)
server does not support any of the specified application/vnd.miden content types

# What the Rust client surfaces (ClientError -> RpcError -> AcceptHeaderError)
RPC error
accept header validation failed
server rejected request - please check your version and network settings (client version: 0.17.0, genesis commitment: none)
```

The Web SDK surfaces the same rejection as `Failed to ensure genesis in place: ... accept header validation failed`.

### Migration Steps

1. Point a 0.17 client at a 0.17 node, public or a local node from the matching release. A 0.16 node rejects it.
2. Upgrade every client in the graph together (Rust client, CLI, Web SDK, any prover crate pinning `miden-client`). A mixed graph fails at the first RPC.
3. For a local node, run node `0.17.0`.
4. Use a remote prover from the 0.17 node release, and a note transport server that serves `note_transport.Api`. Switch the transport endpoint together with the RPC endpoint: the CLI's `[note_transport] endpoint` (`init --network devnet` or `--note-transport-endpoint <URL>` sets it), the Web SDK's `noteTransportUrl`, or in Rust `ClientBuilder::for_devnet()` or `ClientBuilder::note_transport(..)`.
5. The node still keeps account state for only 50 blocks; that window did not change.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `server rejected request - please check your version and network settings (client version: 0.17.0, genesis commitment: ...)` | Client and node differ in major.minor | Use a node and client from the same 0.17 line. |
| `Failed to ensure genesis in place: ... accept header validation failed` (Web) | Same | Same. |

---

## (Node) New accounts may need an invitation code

### Summary

A 0.17 node creates a new (non-network) account on chain only if it is registered on the node's allowlist, unless the operator runs it with `--disable-account-allowlist` (`MIDEN_NODE_DISABLE_ACCOUNT_ALLOWLIST`). Before submitting a transaction that creates such an account (after it is proven), or before proving a batch that does, the client asks the node and fails with `ClientError::AccountNotAllowlisted`. Register the account with an invitation code first. Existing on-chain accounts and network accounts are never gated.

### Affected Code

```rust
// New in 0.17 (Rust): register a tracked, not-yet-deployed, non-network account before its first transaction
client.sync_state().await?; // also puts genesis in place, which RegisterAccount requires
if !client.is_account_allowed(account_id).await? {
    client.register_account(account_id, invitation_code).await?;
}
// If the operator funds registrations: sync until the funding P2ID note arrives, then consume it in the
// account's first transaction.
```

```bash
# New in 0.17 (CLI)
miden-client new-wallet
miden-client sync                                   # puts genesis in place
miden-client account --register <ACCOUNT_ID> --invitation-code <CODE>
miden-client sync                                   # if the network funds registrations
miden-client consume-notes --account <ACCOUNT_ID>   # the funding note creates the account on chain
```

```typescript
// New in 0.17 (Web)
if (!(await client.accounts.isAllowed(account))) {
  await client.accounts.register({ account, invitationCode });
}
```

### Migration Steps

1. On a network that enforces the allowlist, obtain an invitation code and register before the account's first transaction. Note the argument order: `Client::register_account(account_id, invitation_code)` is the reverse of `NodeRpcClient::register_account(invitation_code, account_id)`.
2. Make sure genesis is in place first (any `sync_state`): the node requires the `genesis` accept parameter for `RegisterAccount`, and `register_account` does not fetch genesis itself.
3. In the Web SDK, a submission that would create an account the network does not accept fails with code `ACCOUNT_NOT_ALLOWLISTED` when it is submitted, after the transaction has been executed and proven; check `accounts.isAllowed` first to avoid a wasted proof. The other registration codes are `ACCOUNT_ALREADY_ALLOWED`, `INVITATION_NOT_FOUND`, `ALREADY_REGISTERED` and `INVALID_REGISTRATION_REQUEST`.
4. Node operators running a dev network without invitations start the node with `--disable-account-allowlist`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `account <ID> is not registered on the network allowlist` | Submitting a transaction that creates an unregistered account | Register the account first. |
| `account <ID> is already allowed on the network and does not need an invitation code` | Already registered, or the node does not enforce the allowlist | Skip registration. |
| `account <ID> is a network account and does not need an invitation code` | Network accounts are exempt | Skip registration. |
| `account <ID> is already deployed and does not need an invitation code` | The account exists on chain | Skip registration. |
| `invitation code does not exist` / `the invitation code or the account is already registered` | The node rejected the code | Use a valid, unused code. |

---

## (Rust) The fee faucet comes from the synced protocol configuration

### Summary

In 0.17 the block header no longer names the fee faucet; it commits to a `ProtocolConfig`, which carries the fee asset. The client stores each configuration it receives during `Client::sync_state` and looks it up by the reference block's `protocol_config_commitment()` for execution and for note screening. Read the fee faucet through `Client::get_protocol_config`. The protocol side is covered in [Transaction Changes](./transaction-changes).

### Affected Code

```rust
// Before (0.16): the fee faucet was part of the block header's fee parameters
let header = client.get_latest_block_header().await?;
let fee_faucet_id = header.fee_parameters().fee_faucet_id();
```

```rust
// After (0.17): sync first, then read the configuration the header commits to
client.sync_state().await?;
let header = client.get_latest_block_header().await?;
let config = client.get_protocol_config(header.protocol_config_commitment()).await?;
let fee_faucet_id = config.fee_asset_id().faucet_id();
```

`ProtocolConfig` is re-exported as `miden_client::protocol_config::ProtocolConfig`, alongside `NextProtocolConfig` and `ProtocolConfigError`.

### Migration Steps

1. Replace `header.fee_parameters().fee_faucet_id()` with `client.get_protocol_config(header.protocol_config_commitment()).await?.fee_asset_id().faucet_id()`. `FeeParameters` now carries only `verification_base_fee()`.
2. Call `client.sync_state()` at least once on a new store before executing a transaction or listing consumable notes. Fetching genesis alone does not deliver a configuration, and note screening loads it as soon as there is a note to screen, so `get_consumable_notes` fails as well as execution.
3. The node sends the configuration only when a sync starts at genesis or when the configuration changed over the synced range. A store whose sync height is past genesis but holds no configuration for the current commitment never receives it, and syncing again does not help. If `protocol configuration ... is not stored` persists after a sync, delete the store and sync from genesis. There is no supported way to supply a configuration yourself; `Client::seed_protocol_config` exists only behind the `testing` feature, for mock chains.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `protocol configuration <commitment> is not stored; sync the client to get it from the node` | Execution or note screening before the first `sync_state`, or a store past genesis that never received a configuration | Run `sync_state`; if it persists, recreate the store. |
| ``error[E0599]: no method named `fee_faucet_id` found`` on `&FeeParameters` | The fee faucet moved to `ProtocolConfig` | Use `get_protocol_config(..).fee_asset_id().faucet_id()`. |
| `received an invalid response from the Miden node: node returned a protocol configuration with commitment ... for a block header that commits to ...` | The node sent a configuration that does not match the header | Report it to the node operator. |

---

## (Rust) Multisig requests need `MultisigAuthArgs` and `block_numbers`

0.17 multisig components (`AuthMultisig`, `AuthMultisigSmart`, `AuthGuardedMultisig`) read a three-word auth-args preimage and bind the transaction summary to a block the caller chooses instead of the reference block. The client does not build that preimage: `TransactionRequestBuilder::fee_conversion_salt(salt)` still commits the 0.16 two-word preimage, which the 0.17 components cannot read. **Nothing fails to compile; the transaction fails at execution.** Build `MultisigAuthArgs` yourself, set it as the auth arg with its preimage in the advice map, add the bound block with the new `TransactionRequestBuilder::block_numbers`, and execute at the chain tip. The full flow, with code, is in [Transaction Changes](./transaction-changes).

Client-specific details:

- `MultisigAuthArgs` and `FeeConversionInfo` resolve from `miden_client::account::component`. `SequentialCommit` (for `to_commitment` / `to_elements`) is not re-exported by `miden-client`, so it needs a direct `miden-protocol` dependency.
- Setting any non-empty auth arg makes the client skip its own fee commitment. Set one on a fee-free chain too: the component asserts the preimage is present whatever the base fee.
- Nothing derives the bound block from the auth args: add it with `.block_numbers([bound_block])`. The client fetches that header from the node if it is not in the store.
- `TransactionRequest` now always serializes `block_numbers` first, so stored request bytes from any 0.16 client do not deserialize. Rebuild and re-serialize them.
- `chain_anchor_for_request` and `execute_transaction_at` still exist and now also track the blocks in `block_numbers`, but do not re-execute a multisig proposal at an old anchor: the node keeps account state for only 50 blocks, and foreign accounts, the fee faucet included, are loaded at the reference block.
- Take the fee faucet from `get_protocol_config`, not from the block header.

:::note `fee_conversion_info` in the 0.16 guide
The 0.16 guide names `TransactionRequestBuilder::fee_conversion_info(info, salt)`. In 0.16.0, 0.16.1 and 0.17.0 the builder has `fee_conversion_salt(salt)` instead, and the client builds the native `FeeConversionInfo` from the reference block itself.
:::

---

## (Rust) `AccountFile` and `NoteFile` moved to `miden-objects`, and 0.16 files no longer load

### Summary

Both types now live in `miden-objects` and are Protobuf-encoded; the protocol side is covered in [Imports & Dependencies](./imports-dependencies). The client re-exports them from `miden_client::account` and `miden_client::note`, and the old `miden_client::notes` module is gone. `AccountFile` fields are private, `read` / `write` return `AccountFileError` / `NoteFileError` instead of `std::io::Error`, and the types no longer implement `Serializable` / `Deserializable`.

### Affected Code

```rust
// Before (0.16)
use miden_client::account::AccountFile;
use miden_client::notes::NoteFile;          // or miden_client::note::NoteFile
use miden_client::Deserializable;

let file = AccountFile::read_from_bytes(&bytes)?;
let account = file.account;
let keys = file.auth_secret_keys;
AccountFile::new(account, keys).write("acct.mac")?;   // std::io::Result<()>
```

```rust
// After (0.17)
use miden_client::account::{AccountFile, AccountFileError};
use miden_client::note::{NoteFile, NoteFileError};

let file = AccountFile::try_from_bytes(&bytes)?;      // Result<AccountFile, AccountFileError>
let (account, keys) = file.into_parts();              // or file.account() / file.auth_secret_keys()
AccountFile::new(account, keys).write("acct.mac")?;   // Result<(), AccountFileError>
let note_file = NoteFile::read("note.mno")?;          // Result<NoteFile, NoteFileError>
```

### Migration Steps

1. Replace `miden_client::notes::NoteFile` with `miden_client::note::NoteFile`.
2. Replace `AccountFile::read_from_bytes` / `NoteFile::read_from_bytes` with `try_from_bytes`. `to_bytes()` is now an inherent method and still works.
3. Replace field access with `account()`, `auth_secret_keys()` or `into_parts()`.
4. Map `AccountFileError` / `NoteFileError` where you previously expected `std::io::Error` from `read` / `write`.
5. Regenerate every exported file with a 0.17 client. `NoteFile` variants are unchanged.

:::note `NoteSyncHint` did not change
The changelog says `NoteSyncHint` "likewise exposes `after_block_num()` and `tag()`". It already had private fields and exactly those accessors in 0.16.1; only its crate changed.
:::

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| ``error[E0432]: unresolved import `miden_client::notes` `` (could not find `notes` in `miden_client`) | `miden_client::notes` removed | Use `miden_client::note::NoteFile`. |
| ``error[E0599]: no associated function or constant named `read_from_bytes` found for struct `AccountFile` `` | `Deserializable` impl removed | Use `try_from_bytes`. |
| ``error[E0616]: field `account` of struct `AccountFile` is private`` | Fields made private | Use `account()` or `into_parts()`. |
| `failed to decode the account file` / `failed to decode the note file` | A file written by 0.16 | Re-export with 0.17, or recreate the account or note. |

---

## (Rust) Removed and renamed re-exports

### Summary

The client dropped or renamed several re-exports. The token helpers moved into the CLI crate as private functions, so there is no public replacement.

### Affected Code

```diff
- use miden_client::block::ValidatorKeys;
+ use miden_client::block::ValidatorConfig;
- use miden_client::transaction::ProvingOptions;
+ use miden_client::transaction::Prover;
- use miden_client::asset::{FungibleAssetDelta, NonFungibleAssetDelta, NonFungibleDeltaAction};
- use miden_client::crypto::SmtForest;
- use miden_client::notes::NoteFile;
+ use miden_client::note::NoteFile;
- use miden_client::transaction::AccountInputs;
- use miden_client::utils::{base_units_to_tokens, tokens_to_base_units, TokenParseError};
```

```rust
// Before (0.16)
let prover = LocalTransactionProver::new(ProvingOptions::new(Poseidon2));

// After (0.17): the same configuration is the default
let prover = LocalTransactionProver::default();
```

### Migration Steps

1. `ValidatorKeys` → `ValidatorConfig`. See [(Rust) State sync authenticates the chain tip](#rust-state-sync-authenticates-the-chain-tip-with-validatorconfig).
2. `ProvingOptions` → `Prover` (from `miden-prover`). Use `LocalTransactionProver::default()` for the standard configuration.
3. The vault delta types are gone because `AccountVaultDelta` now tracks whole assets (see [Assets, Vault & Faucet](./asset-vault-faucet)); `AccountVaultDelta` itself is still re-exported. `SmtForest` has no client re-export.
4. `AccountInputs` went with prefetched foreign accounts; see [(Rust) `ForeignAccount::Prefetched`](#rust-foreignaccountprefetched-and-get_foreign_account_inputs-are-gone).
5. Token formatting: copy `tokens_to_base_units` / `base_units_to_tokens` from 0.16.1 into your code if you need them. 0.17 keeps them only as `pub(crate)` in the CLI.

:::warning `Prover::default()` is not the old default
`Prover::default()` and `Prover::new()` select `Blake3_256`. `LocalTransactionProver::default()` uses `Prover::new().with_hash_fn(Poseidon2)`, which is what 0.16's `LocalTransactionProver::default()` used. Do not translate `ProvingOptions::default()` to `Prover::default()` without checking the hash function.
:::

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| ``error[E0432]: unresolved import `miden_client::block::ValidatorKeys` `` | Renamed | `ValidatorConfig` |
| ``error[E0432]: unresolved import `miden_client::transaction::ProvingOptions` `` | Replaced | `Prover`, or `LocalTransactionProver::default()` |
| ``error[E0432]: unresolved import `miden_client::utils::tokens_to_base_units` `` (a braced import of several missing items reports them in one `unresolved imports` error) | Moved into the CLI | Copy the helper. |

---

## (Rust) `ForeignAccount::Prefetched` and `get_foreign_account_inputs` are gone

:::caution 0.16.1-only features, replaced in 0.17
`ForeignAccount::Prefetched(AccountInputs)` and `Client::get_foreign_account_inputs` shipped in `miden-client` 0.16.1 only and were deliberately not carried forward: 0.17 executes a multisig proposal at the chain tip, with the proposal's block added through `block_numbers`, instead of re-executing it at an old block. Code written against 0.16.0 is unaffected.
:::

### Summary

0.16.1 let a request carry a foreign account's state and witness, fetched with `Client::get_foreign_account_inputs`, so a transaction pinned to an old block could run after the node pruned that state. 0.17 has none of it: the variant, the method, `From<AccountInputs> for ForeignAccount`, `TransactionRequestError::ForeignAccountNotAtReferenceBlock` and the `miden_client::transaction::AccountInputs` re-export are all absent.

### Affected Code

```rust
// Before (0.16.1)
let inputs = client.get_foreign_account_inputs([ForeignAccount::public(id, reqs)?], anchor_block).await?;
let request = TransactionRequestBuilder::new()
    .foreign_accounts(inputs.into_iter().map(ForeignAccount::from))
    .build()?;
```

```rust
// After (0.17): declare the account and execute at the current tip
let request = TransactionRequestBuilder::new()
    .foreign_accounts([ForeignAccount::public(id, reqs)?])
    .build()?;
```

### Migration Steps

1. Declare foreign accounts as `ForeignAccount::Public` / `ForeignAccount::Private` and execute at the current tip. The node still keeps account state for 50 blocks.
2. If you used prefetching to re-execute a multisig proposal at an old block, use the 0.17 flow instead: bind the block through `MultisigAuthArgs` and add it with `block_numbers` (see [(Rust) Multisig requests](#rust-multisig-requests-need-multisigauthargs-and-block_numbers)).
3. Remove matches on `TransactionRequestError::ForeignAccountNotAtReferenceBlock`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| ``error[E0599]: no variant, associated function, or constant named `Prefetched` found for enum `ForeignAccount` `` | Removed | Declare the account as public or private. |
| ``error[E0599]: no method named `get_foreign_account_inputs` found`` | Removed | Execute at the tip. |

---

## (Rust) `expiration_delta` now applies to consume-only and bare requests

### Summary

In 0.16 `TransactionRequestBuilder::expiration_delta` only took effect through the `SendNotes` script, so a request without own output notes (`build_consume_notes`, a PSWAP cancel, a bare `build()`) silently never expired: its `expiration_block_num()` was `u32::MAX`. In 0.17 such a request runs the standard `ExpirationTransactionScript` with the delta as its script argument, so the delta you set is enforced. `CustomScript` requests are unchanged: `build()` still rejects `expiration_delta` combined with a custom script (`transaction script template error: Cannot set expiration delta when a custom script is set`). The changelog files this under fixes, but it changes what existing code does.

### Affected Code

```rust
// Same code in 0.16 and 0.17
let request = TransactionRequestBuilder::new()
    .expiration_delta(10)
    .build_consume_notes(notes)?;
// 0.16: executed without a transaction script; never expires
// 0.17: runs ExpirationTransactionScript; expires 10 blocks after the reference block
```

### Migration Steps

1. Audit requests that set `expiration_delta` without own output notes: they can now expire and be discarded.
2. Drop the call if you relied on it being a no-op.
3. After submitting, confirm the transaction reached `Committed` after a sync before treating it as done (next section). Transactions that call standards procedures reading security-sensitive foreign state (faucet transfer policies, the fee manager) also get a 20-block expiration; see [Transaction Changes](./transaction-changes).

---

## (Rust) A note held by a pending transaction is refused, and a discarded transaction strands it

### Summary

Executing a request that consumes a note the store marks as being processed by a local transaction now fails before execution with `TransactionRequestError::InputNoteBeingProcessed`. In 0.16 the transaction was executed, proven and submitted, and only the local store update failed.

The client never moves such a note back when its transaction is discarded: sync undoes the account state of a discarded transaction, not its input notes. The new check therefore turns a note stranded by a discarded transaction into a hard refusal. This has been observed with a consume transaction the node accepted and then dropped as expired: its input notes stayed `Processing`, `consume-notes` found nothing consumable, and consuming them by ID was refused with the new error. It is more likely on 0.17 because standards procedures that read security-sensitive foreign state (faucet transfer policies, the fee manager) cap expiration at 20 blocks.

### Affected Code

```rust
let tx_id = client.submit_new_transaction(account_id, request).await?; // Ok is not "landed"
client.sync_state().await?;
let records = client.get_transactions(TransactionFilter::Ids(vec![tx_id])).await?;
// check records[0].status: Pending, Committed { .. } or Discarded(cause)
```

### Migration Steps

1. Treat a successful submit as "accepted", not "committed": sync and read the transaction's status until it is `Committed` or `Discarded`.
2. Handle `TransactionRequestError::InputNoteBeingProcessed { note, transaction_id }` (reached through `ClientError::TransactionRequestError`) instead of retrying the same consume.
3. Keep the window between building a request and submitting it short when the transaction reads foreign state.
4. We found no supported way in 0.17 to return a stranded note to a consumable state. Retrying the consume is refused; the observed recovery was a fresh note.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `invalid transaction request` with source `note with details commitment <hex> is being consumed by pending transaction <id>` | The note is still marked as processing, including after its transaction was discarded | Wait for the pending transaction; if it was discarded, see step 4. |

---

## (Rust) Note transport: new service, silent failures, screening and a new cursor

### Summary

Three behaviour changes and one API change:

1. **New gRPC service.** The client speaks `note_transport.Api` instead of `miden_note_transport.MidenNoteTransport`, at unchanged URLs, so the server must be upgraded (see [(Node) Client, node, remote prover and note transport must all be 0.17](#node-client-node-remote-prover-and-note-transport-must-all-be-017)). The default endpoints are `NOTE_TRANSPORT_TESTNET_ENDPOINT = "https://transport.miden.io"`, `NOTE_TRANSPORT_DEVNET_ENDPOINT`, and the new `NOTE_TRANSPORT_MAINNET_ENDPOINT`.
2. **Failures no longer fail `sync_state`.** A transport failure inside `Client::sync_state` is logged (`note transport fetch failed; syncing the chain without it`) and the chain sync still applies, so an incompatible or unreachable transport server is silent. Calling `Client::sync_note_transport` directly still returns the error.
3. **Deliveries are screened.** Transport-delivered notes whose tag matches a tracked account's tag are screened, and notes no tracked account can consume are dropped instead of imported. Notes with other tags are kept as before.
4. **Cursor and streaming API.** `NoteTransportCursor` is now a (nonce, sequence) pair, and `NoteTransportClient::stream_notes` and the `NoteStream` trait were removed.

### Affected Code

```rust
// Before (0.16)
let cursor = NoteTransportCursor::new(42);   // also NoteTransportCursor::from(42u64)
let raw: u64 = cursor.value();
let stream = transport.stream_notes(tag, cursor).await?;
```

```rust
// After (0.17)
let cursor = NoteTransportCursor::from_parts(nonce, sequence); // or NoteTransportCursor::init()
let parts: Option<(u64, u64)> = cursor.parts();              // None for the initial cursor
let (notes, next) = transport.fetch_notes(&[tag], cursor).await?; // poll instead of streaming
```

### Migration Steps

1. Check that your transport endpoint serves `note_transport.Api`.
2. Do not rely on `sync_state` erroring to detect transport problems; call `sync_note_transport` or watch the logs if you need to know.
3. Expect private notes addressed to another account with a colliding tag to no longer appear in the store.
4. Replace `NoteTransportCursor::new(u64)`, `From<u64>` and `value()` with `from_parts(nonce, sequence)`, `init()` and `parts()`.
5. Replace `stream_notes` with polling `fetch_notes`. Custom `NoteTransportClient` implementations: delete `stream_notes`.

---

## (Rust) Custom `NodeRpcClient` implementations must follow the trait

### Summary

The trait gained two required methods, takes submitted payloads by reference, and returns a signed block plus an optional proof. The `ChainMmrInfo` your `sync_chain_mmr` returns must now carry the chain tip's validator signatures and, when present, the protocol configuration. This only affects code that implements `NodeRpcClient` or builds its return types.

### Affected Code

```rust
// Before (0.16)
async fn submit_proven_transaction(&self, proven_transaction: ProvenTransaction,
    sealed_transaction_inputs: SealedTransactionInputs) -> Result<BlockNumber, RpcError>;
async fn submit_proven_batch(&self, proven_batch: ProvenBatch, proposed_batch: ProposedBatch,
    transaction_inputs: Vec<SealedTransactionInputs>) -> Result<BlockNumber, RpcError>;
async fn get_block_by_number(&self, block_num: BlockNumber, include_proof: bool)
    -> Result<ProvenBlock, RpcError>;
```

```rust
// After (0.17)
async fn submit_proven_transaction(&self, proven_transaction: &ProvenTransaction,
    sealed_transaction_inputs: SealedTransactionInputs) -> Result<BlockNumber, RpcError>;
async fn submit_proven_batch(&self, proven_batch: &ProvenBatch, proposed_batch: &ProposedBatch,
    transaction_inputs: Vec<SealedTransactionInputs>) -> Result<BlockNumber, RpcError>;
async fn get_block_by_number(&self, block_num: BlockNumber, include_proof: bool)
    -> Result<(SignedBlock, Option<ExecutionProof>), RpcError>;
async fn register_account(&self, invitation_code: &str, account_id: AccountId) -> Result<(), RpcError>;
async fn is_account_allowed(&self, account_id: AccountId) -> Result<bool, RpcError>;

// ChainMmrInfo gained two public fields (no constructor, struct literal only)
ChainMmrInfo { block_from, block_to, mmr_delta, block_header, protocol_config, block_signatures }
```

### Migration Steps

1. Add `register_account` and `is_account_allowed`. A wrapper can delegate, as `VerifyingRpcClient` does.
2. Change the two submit methods to take references; clone inside if you need ownership.
3. Return `(SignedBlock, Option<ExecutionProof>)` from `get_block_by_number`. The proof is `None` when not requested, and also when the node has not proven the block yet.
4. Fill `ChainMmrInfo::block_signatures` (the validator signatures over `block_header`) and `ChainMmrInfo::protocol_config` (`Some` when the node sent one) in `sync_chain_mmr`. Sync rejects a tip whose signatures do not verify.
5. Handle the new `RpcEndpoint::RegisterAccount`, `RpcEndpoint::IsAccountAllowed` and `EndpointError::RegisterAccount` variants in exhaustive matches.
6. Still wrap a custom client in `VerifyingRpcClient::new(..)` if you pass it to `ClientBuilder::rpc`, as in 0.16.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| ``error[E0046]: not all trait items implemented, missing: `register_account`, `is_account_allowed` `` | New required methods | Implement or delegate them. |
| ``error[E0053]: method `submit_proven_transaction` has an incompatible type for trait`` | Payload now by reference | Take `&ProvenTransaction` (and `&ProvenBatch`, `&ProposedBatch`). |
| ``error[E0063]: missing fields `block_signatures` and `protocol_config` in initializer of `ChainMmrInfo` `` | New public fields | Fill them from the node response. |
| `error[E0004]: non-exhaustive patterns` on `RpcEndpoint` or `EndpointError` | New variants | Add arms. |

---

## (Rust) State sync authenticates the chain tip with `ValidatorConfig`

### Summary

Every `sync_chain_mmr` response is checked against the validator set committed by the client's latest stored header. `StateSync::new` takes that `ValidatorConfig`, and the `miden_client::block::ValidatorKeys` re-export became `ValidatorConfig`. `Client::sync_state` does this for you; only callers of `StateSync::new` change.

### Affected Code

```rust
// Before (0.16)
let sync = StateSync::new(rpc, note_screener, tx_discard_delta);
```

```rust
// After (0.17)
let validator_config = client.get_validator_config().await?;
let sync = StateSync::new(rpc, note_screener, tx_discard_delta, validator_config);
```

### Migration Steps

1. Pass `client.get_validator_config().await?` as the fourth `StateSync::new` argument.
2. Rename `ValidatorKeys` to `ValidatorConfig`. Its constructor also takes a `quorum`, which must equal the number of keys; see [Transaction Changes](./transaction-changes). `AttestedTransactionEncryptionKey::verify` now takes `&ValidatorConfig`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `chain validation error: chain tip block header <N> does not carry valid validator signatures: <err>` | The node served a tip not signed by the stored validator set | Check the endpoint points at the chain the store was synced on. |
| `error[E0061]: this function takes 4 arguments but 3 arguments were supplied` | `StateSync::new` gained `validator_config` | Pass `get_validator_config()`. |

---

## (Rust) New error variants, and one rename

### Summary

`TransactionScriptError` became `MastForestScriptError` upstream, and the client renamed its wrapping variants to match. The error enums also gained variants, and none of them is `#[non_exhaustive]`, so exhaustive matches stop compiling. The changelog lists only some of them.

### Affected Code

```diff
- ClientError::TransactionScriptError(e)
+ ClientError::MastForestScriptError(e)
- StoreError::TransactionScriptError(e)
+ StoreError::MastForestScriptError(e)
  TransactionRequestError::InvalidTransactionScript(e) // e: TransactionScriptError -> MastForestScriptError
```

New variants:

```text
ClientError:              AccountNotAllowlisted, AccountAlreadyAllowed, AccountIsNetworkAccount, AccountIsNotNew,
                          UnscreenedNoteBlocks
StoreError:               DatabaseTransientError, DatabasePermanentError, ProtocolConfigNotFound,
                          ProtocolConfigCommitmentMismatch
TransactionRequestError:  SwapNoteWithZeroAsset, InputNoteBeingProcessed   (ForeignAccountNotAtReferenceBlock removed; 0.16.1 only)
BatchBuilderError:        BatchSubmissionOutcomeUnknown
```

### Migration Steps

1. Rename the `TransactionScriptError` arms. The payload type is `miden_protocol::MastForestScriptError`; `miden-client` does not re-export it.
2. Add arms, or a wildcard, for the new variants.
3. Code that retried on `StoreError::DatabaseError` for a busy or locked SQLite database must now match `StoreError::DatabaseTransientError`. Constraint violations and corrupt files are `DatabasePermanentError`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| ``error[E0599]: no variant, associated function, or constant named `TransactionScriptError` found for enum `ClientError` `` | Renamed | `MastForestScriptError` |
| `error[E0004]: non-exhaustive patterns` | New variants | Add arms. |

---

## (Rust) `SyncedNote` is flat and `NoteObserver::observe` takes it

### Summary

`SyncedNote` carries `note_id`, `metadata` and `inclusion_proof` directly instead of a nested `committed: CommittedNote`, and `NoteObserver::observe` receives the whole `SyncedNote`.

### Affected Code

```rust
// Before (0.16)
async fn observe(&self, committed_note: &CommittedNote, attachments: &NoteAttachments)
    -> Result<bool, ClientError>;
let id = synced.committed.note_id();
```

```rust
// After (0.17)
async fn observe(&self, note: &SyncedNote) -> Result<bool, ClientError>;
let id = synced.note_id;
let attachments = &note.attachments;
let committed: CommittedNote = synced.into_committed_note(); // when you need the old record
```

### Migration Steps

1. Change `NoteObserver::observe` to take `&SyncedNote`, and read attachments from `note.attachments`.
2. Replace `synced.committed.<x>()` with the flat fields, or call `into_committed_note()`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| ``error[E0050]: method `observe` has 3 parameters but the declaration in trait `NoteObserver::observe` has 2`` | Signature changed | Take `&SyncedNote`. |
| ``error[E0609]: no field `committed` on type `SyncedNote` `` | Flattened | Use `note_id`, `metadata`, `inclusion_proof`. |

---

## (Rust) Protobuf conversions moved to `miden-objects`

### Summary

Protocol object messages now come from the canonical `miden-objects` schemas. The client's own `From` / `TryFrom` conversions (modules `rpc::domain::{block, digest, merkle, smt}`) are gone, `RpcConversionError` lost five variants and gained `CanonicalConversion`, and the remote prover's `TryFrom<proto::Proof> for ProvenTransaction` now fails with `TransactionProverError`. This affects code using `miden_client::rpc::generated` (public only with the `testing` feature) or matching `RpcConversionError`.

### Affected Code

```rust
// Before (0.16)
match err {
    RpcConversionError::DeserializationError(e) => ..,
    RpcConversionError::NotAValidFelt | RpcConversionError::NoteTypeError(_)
    | RpcConversionError::MerkleError(_) | RpcConversionError::InvalidInt(_) => ..,
    RpcConversionError::InvalidField(_) | RpcConversionError::MissingFieldInProtobufRepresentation { .. } => ..,
}
```

```rust
// After (0.17)
match err {
    RpcConversionError::CanonicalConversion(e /* miden_client::rpc::ConversionError */) => ..,
    RpcConversionError::InvalidField(_) | RpcConversionError::MissingFieldInProtobufRepresentation { .. } => ..,
}
```

### Migration Steps

1. Replace matches on the removed variants with `RpcConversionError::CanonicalConversion`. `ConversionError` is re-exported from `miden_client::rpc`.
2. Drop imports of `rpc::domain::block`, `digest`, `merkle` and `smt`. If you handle raw protobuf messages, convert through `miden_objects` (`DecodeMessageExt::decode_and_verify` / `decode_and_build_unchecked`). `primitives.Digest` is now `primitives.Word`.
3. Expect `TransactionProverError` from `ProvenTransaction::try_from(proto::Proof)`.

---

## (Rust) `BatchBuilder::submit` reports an unknown outcome as its own error

### Summary

When a batch submission fails without a definite answer from the node (any gRPC failure other than a deliberate rejection such as `InvalidArgument` or `FailedPrecondition`), `submit` returns `ClientError::BatchBuilder(BatchBuilderError::BatchSubmissionOutcomeUnknown { submission, source })` instead of `ClientError::RpcError`. Resend the carried submission with the new `Client::retry_proven_batch`, which re-seals the inputs and does not execute or prove again. Single-transaction submission already behaved this way in 0.16 (`ClientError::SubmissionOutcomeUnknown`).

### Affected Code

```rust
let mut batch = client.new_transaction_batch();
batch.push(account_id, request).await?;
let outcome = batch.submit().await;
match outcome {
    Ok(block_num) => { /* accepted at block_num */ },
    Err(ClientError::BatchBuilder(BatchBuilderError::BatchSubmissionOutcomeUnknown { submission, .. })) => {
        client.retry_proven_batch(&submission).await?;
    },
    Err(err) => return Err(err.into()),
}
```

### Migration Steps

1. Code matching `ClientError::RpcError` around batch submission still compiles but no longer sees transport-level failures. Match `BatchSubmissionOutcomeUnknown` and retry with `retry_proven_batch`.
2. A retry of a batch that did land is rejected by the node as a conflict. The batch ID is fixed, so nothing is duplicated.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `submission of a batch of <N> transactions came back without a definite outcome, so the node may or may not have accepted it; nothing was recorded locally` | Indeterminate submission | `retry_proven_batch(&submission)` |

---

## (Rust) `Keystore::get_account_key_commitments` returns an empty set for an unknown account

### Summary

`FilesystemKeyStore` used to fail with `KeyStoreError::StorageError("account not found <id>")` for an account without keys. It now returns `Ok` with an empty set, because an account may sign with keys held elsewhere (for example an external ECDSA key). `get_keys_for_account` returns an empty vector. Code that treated the error as "no keys" still compiles and silently stops detecting it.

### Affected Code

```rust
// Before (0.16): an error meant "no keys for this account"
if keystore.get_account_key_commitments(&account_id).await.is_err() { /* unknown */ }

// After (0.17)
if keystore.get_account_key_commitments(&account_id).await?.is_empty() { /* no local keys */ }
```

### Migration Steps

1. Check for an empty set instead of an error.
2. Custom `Keystore` implementations should return an empty set, not an error, for an account they hold no key for.

---

## (Rust) Other library changes

- **Zero-amount swaps are rejected when the request is built.** `TransactionRequestBuilder::build_swap` and `build_pswap_create` return `TransactionRequestError::SwapNoteWithZeroAsset("offered" | "requested")` for a zero-amount fungible asset on either side. In 0.16 they produced a note that paid or received nothing. The CLI `swap` and `pswap` commands are affected the same way.
- **`TransactionRequest::incoming_assets`** returns `(BTreeMap<AccountId, u64>, Vec<Asset>)` instead of `Vec<NonFungibleAsset>` for the second element, because `Asset` is now a struct. Filter with `asset.is_non_fungible()`.
- **`NoteExecutionHint`** (re-exported as `miden_client::note::NoteExecutionHint`) gained `Unknown(Felt)`, `into_parts()` returns `Option<(u8, u32)>`, and the `u64` conversions became `Felt` conversions. See [Note Changes](./note-changes).
- **Custom `Store` implementations** must persist the protocol configuration a sync delivers: `StateSyncUpdate::from_parts` gained a trailing `protocol_config: Option<ProtocolConfig>` argument and `into_parts` a sixth element. Store it in client settings under `miden_client::protocol_config::protocol_config_setting_key(config.to_commitment())`; execution and screening read it from there. `TransactionFilter::to_query` was removed (the SQL moved into the SQLite store), and the stored note-transport cursor setting changed format (no longer eight big-endian bytes). The `Store` trait's method signatures did not change.
- **`miden-client-sqlite-store`**: `column_value_as_u64`, `u64_to_value` and the `SqliteStore::{apply_transaction, apply_transaction_batch, prune_account_history, prune_irrelevant_blocks, upsert_foreign_account_code}` associated functions are no longer public. This is not in the changelog.
- **Testing helpers** (`testing` feature): the loose functions in `miden_client::testing::common` (`execute_tx_and_sync`, `wait_for_tx`, `mint_note`, ...) are now methods on `TestClient`, `insert_new_wallet` and its `_with_seed` / `_unfunded` variants are replaced by `TestClient::insert_wallet(account_type)`, and `TestClient::keystore()` exposes the keystore. `ClientConfig::into_client` / `into_unsynced_client` (in `miden-client-integration-tests`) return `TestClient` instead of `(TestClient, FilesystemKeyStore)`.
- **`DapProgramExecutor`** (`dap` feature): its `ProgramExecutor::new` now returns `Result<Self, AdviceError>`. This is not in the changelog.
- **`AccountReader::get_balance`** now errors, instead of returning `AssetAmount::ZERO`, when the stored value under the fungible asset ID cannot be decoded as a fungible asset. In practice only a corrupt store hits this.
- **`block_numbers` adds blocks the transaction authenticates** beyond its reference block. Multisig uses it for the bound block; a MASM script that reads an older block with `tx::get_block_commitment` also needs that block in the transaction inputs (see [MASM Changes](./masm-changes)).

New in 0.17, no migration needed: `Endpoint::mainnet()`, `ClientBuilder::for_mainnet()`, `MAINNET_PROVER_ENDPOINT`, `NOTE_TRANSPORT_MAINNET_ENDPOINT`, `Client::get_validator_config`, `Client::get_protocol_config`, `Client::register_account`, `Client::is_account_allowed`, `Client::retry_proven_batch`, `TransactionRequestBuilder::block_numbers`, `SyncedNote::into_committed_note`, `Client::fetch_chain_updates` / `apply_chain_updates` with `ChainSyncData`, the keystore helpers `FilesystemKeyStore::{store_key, list_keys, associate_key, disassociate_key, account_ids_for_key}` with `StoredKeyInfo`, and pricing re-exports (`NetworkNotePricer`, `NotePricingError`, `NoteCheckerError`, `transaction::{TransactionFee, TransactionFeeError}`, `note::{NoteCost, NoteConsumptionCost}`) that remove the need for a direct `miden-tx` dependency to price note consumption.

---

## (Web) Bump every `@miden-sdk/*` package together

### Summary

All 20 published `@miden-sdk/*` packages share one version, and every first-party peer range moved to `^0.17.0` (`react`, `para`, `para-react`, `turnkey`, `turnkey-react`, `wallet-adapter-base`, `wallet-adapter-miden`, `wallet-adapter-react`, `telemetry-otel`, `telemetry-sentry`). A 0.16 peer range does not accept 0.17, so bump them together.

### Affected Code

```diff title="package.json"
- "@miden-sdk/miden-sdk": "0.16.3",
- "@miden-sdk/react": "0.16.3"
+ "@miden-sdk/miden-sdk": "0.17.0",
+ "@miden-sdk/react": "0.17.0"
```

### Migration Steps

1. Before the bump reaches users, back up the default browser keystore's secret keys on 0.16.3: the first 0.17 open deletes them with the rest of the IndexedDB store. See [(Store) Every 0.16 SQLite store must be recreated](#store-every-016-sqlite-store-must-be-recreated).
2. Install `0.17.0` (`npm install <package>@0.17.0`). Do the same for every other `@miden-sdk/*` package you depend on (vite plugin, wallet adapters, Para, Turnkey, telemetry).
3. The 0.16 guide pinned `miden-sdk 0.16.1` with `react 0.16.0`; since 0.16.2 the two ship in lockstep at the same version.
4. Node.js: the Node entry still resolves its native binary through the `optionalDependencies` `@miden-sdk/node-darwin-arm64`, `node-darwin-x64` and `node-linux-x64-gnu`, pinned to the exact same version. Do not install them directly.
5. Rust crates published from the Web SDK repository (`miden-client-web`, `miden-idxdb-store`, `js-export-macro`, `miden-mobile-prover`) are at `0.17.0`. `miden-client-web` requires `miden-client` `0.17.0` and `miden-protocol` `0.17.0`; `miden-idxdb-store` and `miden-mobile-prover` require `miden-client` `0.17.0`.

---

## (Web) `BlockHeader.feeFaucetId()` removed: ask the client

### Summary

The fee asset moved from the block header into the protocol configuration. The client receives that configuration from the node when it syncs, so `await client.feeFaucetId()` replaces `header.feeFaucetId()`. A bare `RpcClient` can no longer discover the fee faucet.

### Affected Code

```typescript
// Before (0.16)
const header = await new RpcClient(Endpoint.testnet()).getBlockHeaderByNumber(undefined);
const feeFaucet = header.feeFaucetId();
```

```typescript
// After (0.17)
const client = await MidenClient.create({ rpcUrl });
await client.sync();
const feeFaucet = await client.feeFaucetId();   // AccountId
```

```typescript
// Optional: seed what feeFaucetId() reports before the first sync (bech32 or hex)
const client = await MidenClient.create({ rpcUrl, feeFaucetId: "0x..." });
```

```tsx
// React: the same option on MidenProvider
<MidenProvider config={{ rpcUrl, feeFaucetId: "0x..." }}>{children}</MidenProvider>
```

### Migration Steps

1. Replace `header.feeFaucetId()` with `await client.feeFaucetId()`. The low-level `WasmWebClient` / `WebClient` have the same method.
2. Sync before reading it. After the first sync it reports the faucet named by the protocol configuration the block at the sync height commits to. Before it, it falls back to `ClientOptions.feeFaucetId` (or the mock chain's), and rejects when neither is set.
3. Code that read the faucet from a bare `RpcClient` must now use a synced client, or configure the faucet per network.
4. `BlockHeader.verificationBaseFee()` is unchanged.

:::note `feeFaucetId` is optional, whatever some doc comments say
`ClientOptions.feeFaucetId` and `MidenConfig.feeFaucetId` are optional. You do not need them to execute or screen notes, and a wrong value is corrected by the next sync rather than executed under. Some shipped 0.17.0 text still says it is required (the JSDoc on `MidenClient.create`, `createTestnet` and `createDevnet`, and some doc samples); the code makes it optional.
:::

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `Property 'feeFaucetId' does not exist on type 'BlockHeader'.` (TS2339) | Accessor removed | `await client.feeFaucetId()` |
| ``the chain's fee faucet is not known yet: sync the client so it receives the protocol configuration from the node, or pass `feeFaucetId` when creating it`` | `feeFaucetId()` before the first sync, with no option set | Sync first, or pass the option. |
| `` `<value>` is not a fee faucet: expected a bech32 address or a hex account ID `` | Malformed `feeFaucetId` option | Pass a bech32 address or a hex account ID. |

---

## (Web) `AccountType` is the visibility enum; faucets use `FaucetType`

### Summary

The JS object that shadowed the native `AccountType` (`{FungibleFaucet, NonFungibleFaucet}`) is gone. `AccountType` is now `AccountType.Private` / `AccountType.Public` on both the browser and Node entries, and faucets are selected with the new `FaucetType.FungibleFaucet` (the string `"FungibleFaucet"`). `accounts.create` validates its selectors and throws instead of silently creating a wallet.

### Affected Code

```typescript
// Before (0.16): worked at runtime in JS; TypeScript already rejected it (TS2339)
const faucet = await client.accounts.create({
  type: AccountType.FungibleFaucet, symbol: "TOK", decimals: 8, maxSupply: 10_000_000n,
});
```

```typescript
// After (0.17)
import { FaucetType, AccountType, AccountBuilder } from "@miden-sdk/miden-sdk";
const faucet = await client.accounts.create({
  type: FaucetType.FungibleFaucet, symbol: "TOK", decimals: 8, maxSupply: 10_000_000n,
});
new AccountBuilder(seed).accountType(AccountType.Public); // works now (was undefined in 0.16)
```

### Migration Steps

1. Replace `AccountType.FungibleFaucet` with `FaucetType.FungibleFaucet`. On Node the 0.16 value was already the string `"FungibleFaucet"`, so this is a pure rename there; in the browser the 0.16 value was the number `0`.
2. Drop `AccountType.NonFungibleFaucet`. `FaucetType` has no non-fungible member; non-fungible faucets are rejected.
3. Remove imports of the `AccountTypeValue` type, and use `FaucetType` for `FaucetCreateOptions.type`.
4. Never pass a visibility value as `type`: `0` / `1` (= `AccountType.Private` / `Public`) are still read as legacy faucet selectors. Choose visibility with `storage`.
5. Code that passed faucet fields without a faucet type, or an unknown `type`, used to get a wallet silently (a contract, for an unknown `type` with `components`), and `components` on a faucet were silently ignored. Each now throws a `TypeError` before creating anything.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `Property 'FungibleFaucet' does not exist on type 'typeof AccountType'.` (TS2339) | Stale selector | `FaucetType.FungibleFaucet` |
| `TypeError: accounts.create(): symbol, decimals, maxSupply only apply to faucets, and no faucet type was given. Pass type: FaucetType.FungibleFaucet for a faucet, omit type for a wallet, or pass components for a contract.` | JS passed `AccountType.FungibleFaucet`, now `undefined` (the field list varies with the fields passed) | `FaucetType.FungibleFaucet` |
| `accounts.create(): a faucet request needs symbol, decimals, maxSupply. ...` | `type: AccountType.Private` / `Public`, or a legacy `0` / `1`, without faucet fields | Use `storage` for visibility. |

---

## (Web) Block-locked notes are no longer "available"

### Summary

`notes.listAvailable({ account })` and `transactions.consumeAll({ account })` keep only notes the note screener reports as consumable now, at the last synced block. `consumeAll`'s `consumed` / `remaining` count only those, so `remaining === 0` no longer means "no unconsumed notes". The React hooks apply the same rule (see [(React) Hook behaviour changes](#react-hook-behaviour-changes)). Nothing fails to compile.

### Affected Code

```typescript
// 0.17: to also see notes that unlock later
// Read the hex first: in the browser build, listConsumable consumes an AccountId handle passed to it
const accountIdHex = accountId.toString();
const records = await client.notes.listConsumable({ account: accountIdHex }); // ConsumableNoteRecord[]
const nowOnly = records.filter((r) => isConsumableNow(r, accountIdHex));
// low-level: NoteConsumptionStatus.isConsumableNow()
```

### Migration Steps

1. If you showed pending or time-locked notes from `listAvailable`, switch to the new `notes.listConsumable()` and read each record's `noteConsumability()[i].consumptionStatus().consumableAfterBlock()`, or filter with the exported `isConsumableNow()`.
2. Do not treat `consumeAll(...).remaining === 0` as "inbox empty".

---

## (Web) Prefetched foreign accounts removed

:::caution 0.16.x-only feature, replaced in 0.17
Prefetched foreign accounts came with `miden-client` 0.16.1 and are exposed by Web SDK 0.16.1 through 0.16.3. 0.17 removes them deliberately, as the Web SDK changelog records, in favour of executing against a recent block or at the tip.
:::

### Summary

`ForeignAccount.prefetched()`, `AccountInputs`, `AccountInputsArray`, `client.transactions.foreignAccountInputs()` and `WebClient.getForeignAccountInputs()` are gone. 0.17 resolves a foreign account's vault and storage entries during execution against the reference block.

### Affected Code

```typescript
// Before (0.16)
const inputs = await client.transactions.foreignAccountInputs([ForeignAccount.public(id, reqs)], anchor.blockNum());
const fa = ForeignAccount.prefetched(AccountInputs.deserialize(bytes));
```

```typescript
// After (0.17)
const targets = new ForeignAccountArray();
targets.push(ForeignAccount.public(id, new AccountStorageRequirements()));
const request = (await client.feeAwareTransactionRequestBuilder(account)).withForeignAccounts(targets).build();
```

`withForeignAccounts` takes a `ForeignAccountArray`, not a plain array; TypeScript rejects a plain array at both 0.16 and 0.17.

### Migration Steps

1. Declare foreign accounts with `ForeignAccount.public(id, requirements)` or `ForeignAccount.private(account)`.
2. Execute against a recent reference block, within the node's 50-block account-history window: capture an anchor close to execution, and re-capture an aged one. For multisig, execute at the tip (see [(Web) Multisig](#web-multisig-requests-come-from-feeawaretransactionrequestbuilder-and-execute-at-the-tip)).

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `Module '"@miden-sdk/miden-sdk"' has no exported member 'AccountInputs'.` (TS2305) | Type removed | Declare the account instead. |
| `Property 'prefetched' does not exist on type 'typeof ForeignAccount'.` (TS2339) | Factory removed | `ForeignAccount.public` / `private` |
| `Property 'foreignAccountInputs' does not exist on type 'TransactionsResource'.` (TS2339) | Method removed | Remove the prefetch step. |

---

## (Web) Multisig requests come from `feeAwareTransactionRequestBuilder` and execute at the tip

0.17's multisig auth procedure reads three words of auth args (bound block and approval expiration, salt, conversion info) on every chain, fee-free included, and binds the summary to that bound block. A multisig request built with `withFeeConversionSalt`, or from a bare builder on a fee-free chain, now aborts at execution; on a fee-charging chain a bare builder still fails before execution with `FeeConversionInfoRequired`, as in 0.16. The full flow is in [Transaction Changes](./transaction-changes#multisig-auth-args-are-a-multisigauthargs-preimage-required-on-every-chain).

- Build every request a multisig (including a guarded multisig) executes from `await client.feeAwareTransactionRequestBuilder(account, options)`, on fee-free chains too. It builds the auth args and declares the bound block. The new options are `feeConversionSalt`, `boundBlockNum` and `approvalExpirationDelta`. For any other account it still returns an untouched builder.
- Do not call `withFeeConversionSalt` or `withAuthArg` on the builder it returns for a multisig: each clears the other and discards the auth args.
- The `feeConversionSalt` option consumes the `Word` (it moves across the WASM boundary). Build a fresh `Word` per call: a spent handle is not rejected, it arrives as "no salt" and a random salt is drawn.
- Stop passing `anchor` for multisig requests (`preview`, `executeRequest`, `submit`). Sync each party to at least the bound block (`Math.max(...request.blockNumbers())`) and execute at the tip.
- `TransactionRequest.serialize()` now always carries block numbers, so bytes from 0.16 do not interoperate with 0.17. A dApp and its wallet exchanging a `CustomTransaction` through the wallet adapter must both be on 0.17.
- New: `TransactionRequestBuilder.withBlockNumbers()` and `TransactionRequest.blockNumbers()`.

---

## (Web) Rebuild a bundled native mobile prover

`miden-mobile-prover` links `miden-client`, now 0.17.0 on protocol 0.17.0. A prover binary built for 0.16 proves against the 0.16 kernel and fails on 0.17 transactions. Capacitor, iOS and Android apps that embed it must rebuild the library from `miden-mobile-prover` 0.17.0 (or from the Web SDK release tag) and ship it with the SDK bump. This is not in the changelog.

---

## (Web) Other API changes

| Change | Migration |
| --- | --- |
| `BlockHeader.txKernelCommitment()` → `protocolConfigCommitment()` | Rename. TypeScript suggests `txCommitment()`; that is a different value. |
| `ForeignAccount.account_id()` / `storage_slot_requirements()` → `accountId()` / `storageSlotRequirements()` on the browser build | Rename. The Node build was already camelCase. |
| Raw `WebClient.createClientWithExternalKeystore` inserts `feeFaucetId` **before** the three callbacks | Insert the argument (see below), or use `MidenClient.create({ keystore: { getKey, insertKey, sign } })`. Not in the changelog. |
| Wrapper statics `WasmWebClient.createClient` / `createClientWithExternalKeystore` gained trailing `observability` (already accepted at runtime in 0.16.3, newly typed) and `feeFaucetId` parameters | No change needed. |
| `AccountVaultDelta.fungible()`, `FungibleAssetDelta` and `FungibleAssetDeltaItem` removed | Use `addedFungibleAssets()` / `removedFungibleAssets()`. See [Assets, Vault & Faucet](./asset-vault-faucet). |
| `NoteFile.deserialize` / `AccountFile.deserialize` reject bytes serialized by 0.16 | Re-export from a 0.17 client. |
| Network accounts cannot be deployed by an empty transaction, must use the chain's fee faucet, and always allowlist P2ID | See [Account Changes](./account-changes). |
| Emitting a note to a network account caps the transaction at 20 blocks; `createNetworkNote` declares the target as a foreign account | See [Transaction Changes](./transaction-changes). |
| New account creation can be gated by an allowlist | See [(Node) New accounts may need an invitation code](#node-new-accounts-may-need-an-invitation-code). |

```typescript
// Raw WASM instance method, before (0.16)
await raw.createClientWithExternalKeystore(nodeUrl, noteTransportUrl, seed, storeName, getKey, insertKey, sign);

// After (0.17): TypeScript flags the old call (a function is not assignable to `string`)
await raw.createClientWithExternalKeystore(nodeUrl, noteTransportUrl, seed, storeName, undefined /* feeFaucetId */, getKey, insertKey, sign);
```

New in 0.17, no migration needed: `client.feeFaucetId()`, `ClientOptions.feeFaucetId`, `MidenConfig.feeFaucetId`, the `feeAwareTransactionRequestBuilder` options, `TransactionRequestBuilder.withBlockNumbers()`, `TransactionRequest.blockNumbers()`, `notes.listConsumable()`, `NoteConsumptionStatus.isConsumableNow()`, the exported `isConsumableNow()`, `compile.component({ libraries })`, `accounts.register()` / `accounts.isAllowed()`, `WebClient.registerAccount` / `isAccountAllowed`, `RpcClient.registerAccount` / `isAccountAllowed`, `AccountVaultDelta.numAssets()`, `FaucetType`, `MultisigAuthOptions` and `RegisterAccountOptions`.

---

## (React) Hook behaviour changes

No hook signature changed: the React typings add only `MidenConfig.feeFaucetId?`. Behaviour changed in these places:

| Hook | 0.17 behaviour |
| --- | --- |
| `MidenProvider` | New optional `config.feeFaucetId`. It only seeds `client.feeFaucetId()` before the first sync. |
| `useNotes().consumableNotes` / `consumableNoteSummaries` | Exclude block-locked notes. |
| `useWaitForNotes().waitForConsumableNotes` | Waits only for notes consumable now. |
| `useSessionAccount` funding step | Consumes only notes consumable now, and waits on locked ones. |
| `useCreateNetworkNote` | Declares the target as a foreign account; its transaction must land within 20 blocks. |
| `usePreview` / `useTransaction` / `useChainAnchor` | Multisig requests drop the anchor; see the next section. |

---

## (React) Multisig co-signing drops the anchor

Do not capture an anchor with `useChainAnchor`, and do not pass `anchor` to `usePreview` or `useTransaction`, for a multisig request built by `feeAwareTransactionRequestBuilder`. `usePreview` does not sync, so call `sync()` and check `client.getSyncHeight()` against `Math.max(...request.blockNumbers())` first. The full flow is in [Transaction Changes](./transaction-changes).

```tsx
// After (0.17): multisig co-signer
const { client, sync } = useMiden();
const { preview } = usePreview();
const verify = async (requestBytes: Uint8Array) => {
  const request = TransactionRequest.deserialize(requestBytes);
  await sync();
  if (!client || (await client.getSyncHeight()) < Math.max(0, ...request.blockNumbers())) {
    throw new Error("not synced yet");
  }
  return preview({ accountId, request }); // no anchor
};
```

---

## (CLI) Re-create `.miden/packages` after upgrading

### Summary

`init` writes the bundled component packages into `package_directory` once and never again (it refuses to run while a config exists). Those 0.16 files are package format `6.0.0`; the 0.17 CLI reads only `7.0.0`. `new-wallet` (which loads `basic-wallet` by name), `new-account -p <bundled name>` and `account --inspect` (which loads every `.masp` in the directory) all fail until the directory is refreshed. This is not in the changelog.

### Affected Code

```bash
# After upgrading, with the .miden directory created by 0.16
miden-client new-wallet
# Error: account component error: failed to deserialize Package in .../.miden/packages/basic-wallet.masp
#   invalid value: unsupported version. Got '[6, 0, 0]', but only '[7, 0, 0]' is supported

# Refresh only the packages, keeping the config and keystore
( cd "$(mktemp -d)" && miden-client init --local >/dev/null \
  && rm -rf ~/.miden/packages && cp -R .miden/packages ~/.miden/packages )
```

### Migration Steps

1. The simplest path, since the store has to be recreated anyway: move the old `.miden` directory aside and run `miden-client init` again, with `--network` pointing at a 0.17 node (`--network devnet` also sets devnet's note transport; a custom URL sets none, so add `--note-transport-endpoint`). This writes fresh packages. The keystore lives in `.miden/keystore` by default, so copy that directory into the new `.miden` if you want to keep your keys.
2. To keep the directory, replace only `packages/`: run `init --local` in a temporary directory and copy its `.miden/packages` over the old one, as above.
3. Rebuild any custom `.masp` component packages you pass with `-p`, `--extra-packages` or `--package` with a VM 0.33 toolchain; they fail with the same `unsupported version` error.
4. The nine bundled package names are unchanged: `basic-wallet.masp`, `basic-fungible-faucet.masp`, `basic-non-fungible-faucet.masp`, `auth/basic-auth.masp`, `auth/ecdsa-auth.masp`, `auth/no-auth.masp`, `auth/multisig-auth.masp`, `auth/guarded-multisig-auth.masp`, `auth/network-account-auth.masp`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `account component error: failed to deserialize Package in <path>` caused by `invalid value: unsupported version. Got '[6, 0, 0]', but only '[7, 0, 0]' is supported` | A package written by a 0.16 `init`, or built with a VM 0.29 toolchain | Refresh `.miden/packages`; rebuild custom packages. |
| `configuration file already exists: "miden-client.toml" already exists in the local .miden directory (...), configured with the network "..."` | `init` refuses to overwrite, so it cannot refresh packages in place | Use a temporary directory and copy, or move the old `.miden` aside. |

---

## (CLI) `init` still defaults to testnet

`miden-client init` with no `--network` still configures `https://rpc.testnet.miden.io`, and `[note_transport] endpoint` defaults to `https://transport.miden.io`. A 0.17 CLI needs a 0.17 node: a 0.16 node rejects it at the accept header, so the first `sync` fails until the CLI is pointed at a 0.17 node. A note transport that serves only the 0.16 service does not fail `sync` at all. Point both at 0.17 services: pass `--network <0.17 endpoint>` with `--note-transport-endpoint <URL>`, or edit `[rpc] endpoint` and `[note_transport] endpoint`. See [(Node) Client, node, remote prover and note transport must all be 0.17](#node-client-node-remote-prover-and-note-transport-must-all-be-017).

```text
$ miden-client init --local && miden-client sync
Error: cli::client_error

  × client error
  ├─▶ RPC error
  ├─▶ accept header validation failed
  ╰─▶ server rejected request - please check your version and network settings (client version: 0.17.0, genesis commitment: none)
  help: The node rejected the request due to a version mismatch. Ensure your client version is compatible with the node version. See docs: https://docs.miden.xyz/builder/tools/clients/rust-client/cli/cli-troubleshooting
```

---

## (CLI) `exec` runs compiled packages only; `--script-path` is removed

### Summary

`exec` no longer compiles MASM. `--package` / `-p` is required and takes a compiled library package that exports exactly one `@transaction_script` procedure. `--script-path` / `-s` is gone and not aliased, and an executable (program) package is rejected too.

### Affected Code

```bash
# Before (0.16)
miden-client exec -a <ACCOUNT_ID> --script-path script.masm --inputs-path inputs.toml

# After (0.17)
midenc script.masm --lib -o script.masp          # or `miden build` for a Rust #[tx_script]
miden-client exec -a <ACCOUNT_ID> --package script.masp --inputs-path inputs.toml
miden-client exec -a <ACCOUNT_ID> -p script        # bare name: resolved as <package_directory>/script.masp
```

The MASM itself keeps the 0.16 shape:

```masm
@transaction_script
pub proc main
    push.1.2 add push.3 mul push.9 assert_eq
end
```

### Migration Steps

1. Compile each script to a `.masp` library package with a toolchain on VM 0.33: the `midenc` 0.11 line. A `midenc` 0.10 writes package format `6.0.0`, which the 0.17 CLI rejects. See [Rust Contract SDK & Compiler](./rust-sdk-compiler).
2. Replace `--script-path <file>.masm` / `-s <file>.masm` with `--package <file>.masp` / `-p <file>.masp`. A path without an extension is looked up in the configured `package_directory`.
3. `--inputs-path`, `--hex-words` and `-a` / `--account` are unchanged.
4. DAP builds (`--features dap`): `--start-debug-adapter` now loads the package's debug info, and a DAP "restart" reloads the `.masp` file from disk instead of recompiling source. Rebuild the package before restarting to pick up source edits, and compile with debug info (`--debug full`) for source stepping.

:::note `miden build` covers Rust scripts only
The changelog says to compile scripts with `miden build` first. That is the path for a Rust `#[tx_script]` project; for a MASM script use `midenc <file>.masm --lib -o <file>.masp`.
:::

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `error: unexpected argument '--script-path' found` (followed by `tip: a similar argument exists: '--inputs-path'`) | Flag removed | Compile the script and pass `--package`. |
| `error: unexpected argument '-s' found` | Short flag removed | Use `-p <PACKAGE>`. |
| `error: the following required arguments were not provided:` / `--package <PACKAGE>` | `--package` is mandatory | Pass a compiled `.masp`. |
| `execute program error: the package at <path> is not a transaction script` | The package has no single `@transaction_script` export, or is an executable package | Build a library package whose one transaction script is marked `@transaction_script`. |

---

## (CLI) 0.16 `.mac` and `.mno` files cannot be imported

### Summary

`miden-client import` of a file written by `export` in 0.16 fails for both the note and the account decoding attempt. There is no conversion path. The changelog records the Rust side only.

### Affected Code

```bash
miden-client import account-from-016.mac
# import error: failed to read `account-from-016.mac`
#   as a note: failed to decode the note file: failed to decode Protobuf message: invalid tag value: 0: ...
#   as an account: failed to decode the account file: failed to decode Protobuf message: invalid tag value: 0: ...
```

This was verified with a `.mac` file; a `.mno` file goes through the same decoding path.

### Migration Steps

1. Do not rely on 0.16 exports to carry accounts or notes into 0.17.
2. Private notes: consume them on 0.16 before upgrading, or have the sender re-send them after both sides run 0.17.
3. Accounts: 0.16 secret keys survive (the keystore directory is readable by 0.17), but the account state must come from the chain or be recreated; see [(Store) Every 0.16 SQLite store must be recreated](#store-every-016-sqlite-store-must-be-recreated).
4. Files exported by 0.17 (`export --account`, `export --note`) are the new format and import normally.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| ``import error: failed to read `<file>` `` followed by `as a note: failed to decode the note file: ...` and `as an account: failed to decode the account file: ...` | A file written by a 0.16 client | Re-export from a 0.17 client, or recreate the account or note. The Protobuf detail after the colon depends on the file bytes. |

---

## (CLI) Bech32 addresses from another network are rejected

### Summary

Every account argument that accepts a bech32 address now checks the address's network prefix against the configured network: `transfer`, `mint`, `consume-notes`, `call`, `export`, `account`, the recipient of `notes --send`, the faucet in `<AMOUNT>::<FAUCET_ADDRESS>`, and every `address` in `token_symbol_map.toml`. In 0.16 the prefix was ignored and the embedded account ID was used. A token symbol map containing one foreign-network address now fails to load, breaking every command that resolves assets. (The changelog lists `send`; the check applies to `transfer`, its name since 0.16.)

### Affected Code

```bash
# CLI configured for testnet (prefix mtst), address encoded for devnet (mdev)
miden-client account -s mdev1ar5czf6r2fl5lsf34ylexzpxzs90mwwf
# 0.16: used the account ID inside the address
# 0.17: input error: Address network `mdev` does not match configured network `mtst`
```

```toml
# token_symbol_map.toml: every entry must use the configured network's prefix
BTC = { address = "mtst1...", decimals = 8 }   # on testnet
```

### Migration Steps

1. Use addresses with the prefix of the network the CLI is configured for (`mm` mainnet, `mtst` testnet, `mdev` devnet, `mlcl` localhost, `mcst` any other endpoint), or pass the hex account ID, which carries no network.
2. Re-encode `token_symbol_map.toml` entries if you share one file across networks, or keep one map per `.miden` directory.
3. For your own node of a known network, set `init --network-id <HRP>` / `[rpc] network_id` so the expected prefix is not `mcst` (next section).

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| ``input error: Address network `<hrp>` does not match configured network `<hrp>` `` | Address from another network | Use the configured network's address, or the hex ID. |
| ``config error: Failed to parse `address` for token symbol <SYMBOL>`` caused by `input error: Address network ... does not match configured network ...` | Foreign-network entry in the token symbol map | Fix or remove the entry. |

---

## (CLI) Mainnet support and an explicit network ID

### Summary

`init --network mainnet` configures `https://rpc.mainnet.miden.io` with note transport `https://transport.mainnet.miden.io`. A new optional `[rpc] network_id`, set by `init --network-id <HRP>`, overrides the bech32 prefix derived from the endpoint, which is `mcst` for any unrecognised endpoint.

### Affected Code

```bash
miden-client init --network mainnet
miden-client init --network https://my-node.example.com --network-id mm
```

```toml
[rpc]
endpoint = "https://my-node.example.com"
timeout_ms = 10000
network_id = "mm"      # new, optional
```

### Migration Steps

1. Nothing is required: a 0.16 config without `network_id` loads unchanged.
2. If a 0.16 config already pointed at `https://rpc.mainnet.miden.io` as a custom endpoint, the CLI now renders and expects `mm` addresses there instead of `mcst`.
3. If you run your own node for a public network behind a custom URL, set `network_id`. With the new cross-network check, `mcst` would otherwise reject that network's real addresses.

---

## (CLI) `new-account` / `new-wallet` validate component packages

### Summary

Every package passed to `new-account -p` or `new-wallet -e` must now be built as an account component and carry account component metadata. In 0.16 a package without the metadata section was silently skipped. A composite storage slot can now be given as one slot-level value in the init-data TOML.

### Affected Code

```bash
miden-client new-wallet -e ./my-lib.masp
# 0.16: package silently ignored if it had no component metadata
# 0.17: account error: failed to read account component metadata from package <name>
#   or: invalid argument: package <name> was built as a `<kind>`, not as an account component
```

### Migration Steps

1. Build extra packages as account components (with component metadata), not plain libraries.
2. Mark every procedure the account should expose with `@account_procedure`, or `@auth_script` for the auth procedure, and watch stderr for `Warning: package <name> has no procedures marked with ...`.
3. The multiple-auth-component checks moved to the account builder, so the old CLI message (`Multiple auth components found in packages...`) no longer appears; the builder reports the error instead.

:::note Unmarked procedures produce a warning, not an error
The changelog says the commands now reject a package that exports procedures without an `@account_procedure` or `@auth_script` attribute. They print a warning on stderr only when no procedure is marked, and continue; unmarked exports alongside marked ones are silently not exposed. The kind and metadata checks are real rejections.
:::

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| ``invalid argument: package <name> was built as a `<kind>`, not as an account component`` | A library or executable package passed as a component | Rebuild as an account component. |
| `account error: failed to read account component metadata from package <name>` | The package lacks the account component metadata section | Rebuild with component metadata. |

---

## (CLI) `export --account` succeeds without keys

### Summary

Exporting an account whose keys the keystore does not hold (for example one using an external ECDSA key) now succeeds and writes a keyless `.mac`. In 0.16 it failed, with `keystore error` / `storage error: account not found <id>` for an account the keystore index does not know, or `No keys found for account` for one indexed without keys. The new `--no-keys` leaves keys out deliberately. The success line now reports the key count.

### Affected Code

```bash
miden-client export <ID> --account --no-keys
# Successfully exported account <ID> without secret keys
miden-client export <ID> --account
# Successfully exported account <ID> with 1 secret key(s)
```

### Migration Steps

1. Scripts that matched `Successfully exported account <ID>` as a whole line must accept the new suffix.
2. Do not treat a successful export as proof the file can sign; check for `without secret keys`.

---

## (CLI) Authentication scheme flags and the `keys` command

### Summary

Additive, with one output change. `new-wallet` and `new-account` accept `--ecdsa-k256-keccak [PUBLIC_KEY]` (alias `--ecdsa`) or `--falcon512-poseidon2` (alias `--falcon`). With a `0x`-prefixed SEC1 public key (33-byte compressed or 65-byte uncompressed) the account commits to that external key and stores no secret. The default is unchanged: a generated Falcon512/Poseidon2 key, unless a package supplies an auth component. A scheme flag combined with a package auth component is an error. The new `keys` subcommand lists, generates, imports and associates keystore keys, and computes a public-key commitment.

### Affected Code

```bash
miden-client new-wallet --ecdsa                 # generate and store an ECDSA key
miden-client new-wallet --ecdsa 0x02...         # external key, nothing stored
miden-client keys --list
miden-client keys --commitment 0x04...          # 65-byte uncompressed SEC1 accepted
```

### Migration Steps

1. Scripts matching `Generated and stored Falcon512 authentication key in keystore.` must match `Generated and stored falcon512-poseidon2 authentication key in keystore.` (or `ecdsa-k256-keccak`).

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `error: the argument '--ecdsa-k256-keccak [<PUBLIC_KEY>]' cannot be used with '--falcon512-poseidon2'` | Both scheme flags | Pick one. |
| `invalid argument: the given packages contribute an auth component, which cannot be combined with --ecdsa-k256-keccak or --falcon512-poseidon2` | A scheme flag plus an auth package | Drop one. |
| `invalid argument: ECDSA public key must use a 0x-prefixed hexadecimal encoding` | Missing `0x` | Add the prefix. |

---

## (CLI) Other changes

- **`import` requires a path.** `miden-client import` with no file used to succeed silently; it is now a usage error (`error: the following required arguments were not provided:` / `<FILENAMES>...`).
- **The protocol configuration arrives through `sync`.** Nothing to configure: the CLI gets the chain's protocol configuration, including the fee asset, from the node on `sync`. Sync before running transactions on a fresh store.
- **`notes --list consumable --account-id <ID>` now filters.** In 0.16 the filter was ignored and consumable notes for every tracked account were listed.
- **`call` accepts bech32 addresses** for `account-id` arguments and for the faucet half of an `asset` argument. A result that does not decode as the declared return type now prints `The result is not a valid value of the procedure's return type: ...` plus the raw stack, instead of failing the command.
- **Bundled packages named by bare name are read with the trusted reader** (resolved from `package_directory`); a path ending in `.masp` is still validated.
- **`notes --show` prefix errors are reported as `input error:` instead of `import error:`.** This is not in the changelog, and only matters to scripts matching the prefix.
- **DAP builds pin `miden-debug` 0.16** (0.10 in 0.16.1). Use a matching `miden-debug` to connect or replay.
- **Zero-amount `swap` / `pswap`** are rejected when the request is built: `swap note assets must be non-zero: a zero offered asset makes the exchange one-sided` (or `requested`).

---

## Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `failed to deserialize data from the store` | A 0.16 SQLite store | Delete the store and re-sync. |
| `server rejected request - please check your version and network settings (client version: ..., genesis commitment: ...)` | Client and node differ in major.minor | Run a 0.17 node with a 0.17 client. |
| `Failed to ensure genesis in place: ... accept header validation failed` (Web) | Same | Same. |
| `failed to decode the account file` / `failed to decode the note file` | A `.mac` / `.mno` file or `AccountFile` / `NoteFile` bytes written by 0.16 | Re-export with 0.17, or recreate the account or note. |
| `invalid value: unsupported version. Got '[6, 0, 0]', but only '[7, 0, 0]' is supported` | Stale `.miden/packages` or a package built with a VM 0.29 toolchain | Refresh `.miden/packages`; rebuild custom packages. |
| `protocol configuration <commitment> is not stored; sync the client to get it from the node` | Execution or note screening before the first sync | Run `sync_state`; if it persists, recreate the store. |
| `account <ID> is not registered on the network allowlist` | Creating an account the node's allowlist does not know | Register with an invitation code. |
| `advice stack read failed` (inside the executor error chain) | `fee_conversion_salt` / `withFeeConversionSalt` on a multisig account | Build `MultisigAuthArgs` (Rust) or use `feeAwareTransactionRequestBuilder` (Web). |
| `the advice map holds no preimage for the multisig auth args` | A multisig request without auth args | Same. |
| `failed to lookup value in Merkle store` | Multisig bound block not added to the request | Add it with `block_numbers` / `withBlockNumbers`. |
| `note with details commitment <hex> is being consumed by pending transaction <id>` | The note is held by a pending or discarded transaction | Wait for the pending transaction; if it was discarded, 0.17 has no supported way to release the note. |
| `Property 'feeFaucetId' does not exist on type 'BlockHeader'.` (TS2339) | Accessor removed | `await client.feeFaucetId()` |
| `Property 'FungibleFaucet' does not exist on type 'typeof AccountType'.` (TS2339) | Stale selector | `FaucetType.FungibleFaucet` |
| `error: unexpected argument '--script-path' found` | `exec` takes packages only | Compile the script and pass `--package`. |
| ``input error: Address network `<hrp>` does not match configured network `<hrp>` `` | Address from another network | Use the configured network's address, or the hex ID. |
| ``error[E0432]: unresolved import `miden_client::block::ValidatorKeys` `` | Renamed | `ValidatorConfig` |
| ``error[E0046]: not all trait items implemented, missing: `register_account`, `is_account_allowed` `` | New `NodeRpcClient` methods | Implement or delegate them. |
