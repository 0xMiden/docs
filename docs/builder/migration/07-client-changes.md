---
sidebar_position: 7
title: "Client Changes"
description: "Client RPC rebuilt around GetAccount, removed check_nullifiers, required block_to, and Web/React/CLI surface changes in v0.15"
---

# Client Changes

:::warning Breaking Change
v0.15 rebuilds the client RPC surface around the node's `GetAccount` endpoint: `get_account_proof` / `get_account_details` are reshaped, `check_nullifiers` is **removed** (use `sync_nullifiers`), and most sync methods now require an explicit `block_to`. The Web SDK moved to the 0.15 protocol surface — there is no more `"network"` storage mode, the WASM `AccountType` narrowed to `{ Private, Public }`, attachments are word‑vector‑shaped, `Felt` / `Word` throw on overflow, several methods return `undefined` / `string` instead of throwing or returning objects, the raw client's `proveTransactionWithProver` is renamed `proveTransaction`, and `storeIdentifier()` went async. Review every sub‑section below if you maintain Rust, Web, React, or CLI client code.
:::

Sub‑sections are grouped by surface — **Rust client**, **Web SDK**, **React SDK**, and **CLI**. Each change keeps its own `##` heading prefixed with `(Rust)` / `(Web)` / `(React)` / `(CLI)`.

---

## (Rust) `NodeRpcClient` `GetAccount` surface reshaped

### Summary
The account‑fetching surface on the `NodeRpcClient` trait was rebuilt around the node's `/GetAccount` endpoint:
- `get_account_proof(account_id, storage_requirements, account_state, known_account_code, known_vault_commitment)` was **replaced** by `get_account(account_id, request: GetAccountRequest)`, where `GetAccountRequest` bundles the previous positional args behind a builder.
- `get_account_details` no longer returns a `FetchedAccount` enum — it returns `Result<Option<Account>, RpcError>` (`None` for accounts without public state), fetching all of a public account's storage maps and vault in a single round‑trip. It no longer returns anything for private accounts; use `get_account` for a private account's commitment.
- New default helpers `resolve_oversize_vault` / `resolve_oversize_storage_maps` fill in vault/map entries the node flagged as oversize.

`GetAccountRequest`, `StorageMapFetch`, `VaultFetch`, and `AccountStateAt` live under `miden_client::rpc::domain`.

### Affected Code
```rust
// 0.15 — new API:
use miden_client::rpc::domain::account::{GetAccountRequest, StorageMapFetch, VaultFetch};
let (block, proof) = rpc_api
    .get_account(account_id, GetAccountRequest::new()
        .with_storage(StorageMapFetch::All)
        .with_vault(VaultFetch::Always)
        .with_known_code(Some(known_code)))
    .await?;
let account: Option<Account> = rpc_api.get_account_details(account_id).await?;
```

### Migration Steps
1. Replace `get_account_proof(...)` calls with `get_account(account_id, GetAccountRequest::new()....)`; move each positional arg onto the corresponding builder method.
2. Replace `match FetchedAccount { Public | Private }` on `get_account_details` with `Option<Account>` handling; route private‑account commitment lookups through `get_account`.
3. The default `get_account_details` now calls `resolve_oversize_vault` / `resolve_oversize_storage_maps` for you.

---

## (Rust) `NodeRpcClient`: `SyncTarget`, `check_nullifiers` removed, required `block_to`

### Summary
Several `NodeRpcClient` methods changed to match the `0.15` RPC definitions:
- `sync_chain_mmr`'s `block_to: Option<BlockNumber>` became `upper_bound: SyncTarget`. `SyncTarget` has exactly two variants: use `SyncTarget::CommittedChainTip` for the old `None` behavior, or `SyncTarget::ProvenChainTip` for the latest proven block. There is no explicit block-height target.
- `check_nullifiers` (and `RpcEndpoint::CheckNullifiers`, `EndpointError::CheckNullifiers`, `CheckNullifiersError`) were **removed**. Use `sync_nullifiers` to retrieve nullifier updates.
- `sync_nullifiers`, `sync_notes`, `sync_notes_with_details`, `sync_storage_maps`, and `sync_account_vault` lost their `Option<BlockNumber>` upper bound in favor of a required `block_to: BlockNumber`.
- `get_block_by_number` gained an `include_proof: bool` parameter.
- `submit_proven_batch` is a new required trait method.

`SyncTarget` lives at `miden_client::rpc::domain::sync::SyncTarget`.

### Affected Code
```rust
// 0.15 — new API:
use miden_client::rpc::domain::sync::SyncTarget;
let mmr = rpc_api.sync_chain_mmr(block_from, SyncTarget::CommittedChainTip).await?;
let updates = rpc_api.sync_nullifiers(&prefixes, block_from, chain_tip).await?; // check_nullifiers is gone
let block = rpc_api.get_block_by_number(block_num, /* include_proof */ false).await?;
```

### Migration Steps
1. Replace `sync_chain_mmr(_, None)` with `sync_chain_mmr(_, SyncTarget::CommittedChainTip)`. v0.15 dropped explicit-height targeting, so map any explicit `Some(n)` to `SyncTarget::CommittedChainTip` as well (or `SyncTarget::ProvenChainTip` if you need the latest proven block).
2. Replace `check_nullifiers` with `sync_nullifiers` and adapt to `Vec<NullifierUpdate>` (drop the `SmtProof` path).
3. Pass an explicit `block_to` (e.g. the client's current sync height / chain tip) to `sync_nullifiers`, `sync_notes`, `sync_storage_maps`, `sync_account_vault`.
4. Add `include_proof` to `get_block_by_number` calls (`false` unless you need the block proof).
5. If you implement `NodeRpcClient` yourself, add `submit_proven_batch`.

---

## (Rust) Note‑import APIs return `Vec<NoteDetailsCommitment>`

### Summary
`Client::import_notes`, `Client::sync_note_transport`, and the `SyncSummary::new_private_notes` field now yield `Vec<NoteDetailsCommitment>` instead of `Vec<NoteId>`. A metadata‑less import has no `NoteId` yet, so the client identifies such notes by their metadata‑independent details commitment. Resolve a commitment back to a record with `Client::get_input_notes(NoteFilter::DetailsCommitments(vec![..]))`.

### Affected Code
```rust
// 0.15 — new API:
use miden_client::store::NoteFilter;
use miden_protocol::note::NoteDetailsCommitment;
let imported: Vec<NoteDetailsCommitment> = client.import_notes(&note_files).await?;
let private:  Vec<NoteDetailsCommitment> = sync_summary.new_private_notes;
// Resolve commitments to the stored records (works even before metadata is known):
let records = client.get_input_notes(NoteFilter::DetailsCommitments(imported)).await?;
```

### Migration Steps
1. Change the bound type of `import_notes` / `sync_note_transport` results and the `SyncSummary::new_private_notes` field from `NoteId` to `NoteDetailsCommitment`.
2. Where you used a returned `NoteId` to look a note up, switch to `NoteFilter::DetailsCommitments(..)` against `get_input_notes`.

---

## (Rust) `FungibleFaucet` builder + `TokenPolicyManager` construction

### Summary
The fungible‑faucet construction story was redesigned end to end. The client previously re‑exported `BasicFungibleFaucet` plus the `MintAuthControlled` / `MintOwnerControlled` / `BurnAuthControlled` / `BurnOwnerControlled` policy components. In `0.15`:
- The faucet component is `FungibleFaucet`, built via `FungibleFaucet::builder()`.
- Mint/burn policy is configured by installing a single `TokenPolicyManager` (`.with_mint_policy(MintPolicyConfig, PolicyRegistration).with_burn_policy(...)`), with standalone `MintAllowAll` / `MintOwnerOnly` / `BurnAllowAll` / `BurnOwnerOnly` policy components. The old `Mint*Controlled` / `Burn*Controlled` types were removed.

These are re‑exported from `miden_client::account`.

### Affected Code
```rust
// 0.15 — new API:
use miden_client::account::{
    AccountBuilder, AccountType, FungibleFaucet, TokenName, TokenPolicyManager,
    MintPolicyConfig, BurnPolicyConfig, PolicyRegistration,
};
use miden_protocol::asset::AssetAmount;
let faucet = FungibleFaucet::builder()
    .name(TokenName::new(&symbol.to_string())?).symbol(symbol).decimals(10)
    .max_supply(AssetAmount::new(max_supply)?).build()?;
let policy_manager = TokenPolicyManager::new()
    .with_mint_policy(MintPolicyConfig::AllowAll, PolicyRegistration::Active)?
    .with_burn_policy(BurnPolicyConfig::AllowAll, PolicyRegistration::Active)?;
let account = AccountBuilder::new(init_seed)
    .account_type(account_visibility)              // AccountType::Public / ::Private
    .with_auth_component(auth_component)
    .with_component(faucet)
    .with_components(policy_manager)
    .build_with_schema_commitment()?;
```

### Migration Steps
1. Replace `BasicFungibleFaucet::new(symbol, decimals, max_supply)` with `FungibleFaucet::builder()....build()`, wrapping `max_supply` in `AssetAmount::new(..)`.
2. Replace the standalone mint‑policy component with a `TokenPolicyManager` configured via `with_mint_policy` / `with_burn_policy`, installed with `.with_components(policy_manager)`.
3. Drop `Mint*Controlled` / `Burn*Controlled` imports.

---

## (Rust) `InputNoteRecord::new` takes `NoteAttachments`; store `attachments` column

### Summary
`InputNoteRecord::new` gained a second positional parameter, `attachments: NoteAttachments`, so input notes persist their attachment content. The SQLite store's `input_notes` table gained an `attachments` column. `NoteAttachments` is re‑exported from `miden_client::note`.

### Migration Steps
1. Thread a `NoteAttachments` (or `NoteAttachments::default()`) into every `InputNoteRecord::new` call as the second argument.
2. If you use a custom `Store`, add an `attachments` column to your input‑notes table and persist/load it.

---

## (Rust) `sync_notes` / `sync_transactions` return updates directly

### Summary
`sync_notes` and `sync_transactions` now return the fetched updates directly. The wrapper structs `NoteSyncInfo` and `TransactionsInfo` were removed: `sync_notes` returns `Vec<NoteSyncBlock>` and `sync_transactions` returns `Vec<TransactionRecord>`.

### Migration Steps
1. Drop the `.blocks` / `.transactions` field access — the methods return the collections directly.
2. Source the chain tip separately (e.g. `get_block_header_by_number(None, false)`) where you previously read it off `NoteSyncInfo`.

---

## (Rust) `get_note_script_by_root` returns `Option<NoteScript>`

### Summary
`NodeRpcClient::get_note_script_by_root` no longer errors when the node has no script registered for the requested root — it returns `Ok(None)`. Implementations must still verify a returned script's root matches the request.

### Migration Steps
1. Handle the `Option` — `None` means "no script for this root", which previously surfaced as an error.

---

## (Rust) `miden_client::note` re‑exports realigned

### Summary
The protocol split attachment data off `NoteMetadata`, and the client's `note` re‑exports follow:
- **Removed:** `NoteAttachmentKind`, `NoteMetadataHeader`.
- **Added:** `NoteAttachmentHeader`, `NoteAttachments`, `PartialNoteMetadata`.
- `NoteScript::root()` now returns `NoteScriptRoot` (re‑exported from `miden_client::note`) instead of `Word`.

### Migration Steps
1. Replace `NoteAttachmentKind` / `NoteMetadataHeader` imports with `NoteAttachmentHeader` / `NoteAttachments` / `PartialNoteMetadata` as needed.
2. Where `note_script.root()` was used as a `Word`, insert a `.into()` / `Word::from(..)` conversion.

---

## (Rust) `CommittedNoteMetadata` removed

### Summary
The `CommittedNoteMetadata` enum (with `Full(NoteMetadata)` and a header‑only `Header { sender, note_type, tag, attachment_kind }` variant) was removed. Sync responses now always carry full metadata, so `CommittedNote::metadata()` returns `&NoteMetadata` directly — no `Option`, no header‑only case.

### Migration Steps
1. Delete the `CommittedNoteMetadata` match — read `NoteMetadata` directly off the committed note.

---

## (Rust) `build_wallet_id` signature

### Summary
`build_wallet_id` dropped its trailing `is_mutable: bool` (code mutability isn't encoded in the account ID) and its `storage_mode: AccountStorageMode` parameter was replaced by `account_visibility: AccountType`.

### Migration Steps
1. Drop the `is_mutable` argument.
2. Replace the `AccountStorageMode` argument with the corresponding `AccountType` visibility.

---

## (Rust) `compile_note_script` expects a `@note_script` library

### Summary
`client.code_builder().compile_note_script(src)` now expects a MASM **library** with a single procedure annotated `@note_script` instead of a bare `begin … end` program (the underlying assembly switched from `assemble_program` to `assemble_library`).

### Migration Steps
1. Wrap each note‑script body in `@note_script` + `pub proc main … end`; remove the `begin … end` framing.

---

## (Web) `AccountStorageMode.network()` removed

### Summary
The `0.15` chain has no separate network‑account flag. `AccountStorageMode.network()` was removed, and the `StorageMode` string union dropped `"network"` (it is now `"public" | "private"`). Anywhere you constructed a network‑mode account — `AccountStorageMode.network()`, `StorageMode.Network`, or `accounts.create({ storage: "network" })` — must switch to `"public"` or `"private"`. `AccountStorageMode.tryFromStr("network")` now rejects.

### Affected Code
```typescript
// 0.15 — new API:
const mode = AccountStorageMode.public();          // or .private()
await client.accounts.create({ storage: "public" });   // "public" | "private"
```

### Migration Steps
1. Replace every `AccountStorageMode.network()` with `.public()` or `.private()`.
2. Replace `StorageMode.Network` / the `"network"` string with `"public"` or `"private"`.
3. Audit `accounts.create({ storage })` and any `tryFromStr` call sites for `"network"`.

---

## (Web) `AccountType` narrowed; faucet checks move to `Account`

### Summary
The on‑chain `AccountType` no longer encodes faucet‑vs‑regular or updatable‑vs‑immutable. The WASM‑exported `AccountType` enum narrowed from `{ FungibleFaucet, NonFungibleFaucet, RegularAccountImmutableCode, RegularAccountUpdatableCode }` to `{ Private, Public }`. As a result:
- `AccountId.isFaucet()`, `AccountId.isNetwork()`, and `AccountId.isRegularAccount()` were **removed** (only `isPublic()` / `isPrivate()` remain).
- Faucet / regular detection now lives on `Account`: `Account.isFaucet()` / `Account.isRegularAccount()`.
- `Account.isNetwork()` and `Account.isUpdatable()` were **removed** outright.

> This is the low‑level WASM `AccountType` enum. The high‑level resource‑API `AccountType` constant used by `accounts.create({ type: "FungibleFaucet" | ... })` is unchanged.

### Affected Code
```typescript
// 0.15 — new API:
if (account.isFaucet()) {}          // moved onto Account
if (account.isRegularAccount()) {}
if (account.id().isPublic()) {}     // isPublic()/isPrivate() still on both
// account.isNetwork() / account.isUpdatable() have no replacement — drop them.
```

### Migration Steps
1. Move `accountId.isFaucet()` / `.isRegularAccount()` onto the materialised `Account`. You need the full `Account`, not just its `AccountId`.
2. Remove `accountId.isNetwork()`, `account.isNetwork()`, and `account.isUpdatable()` — they have no replacement.
3. Replace any `switch` on the WASM `AccountType` enum's faucet/regular variants with the `Account` predicates; the enum only carries `Private` / `Public` now.

---

## (Web) `NoteAttachment` reshaped to word‑vector content

### Summary
Attachments are now always word‑vector‑shaped. The `NoteAttachmentKind { Word, Array }` dispatch and the per‑variant accessors/constructors `NoteAttachment.newWord` / `.newArray` / `.asWord` / `.asArray`, the `attachmentKind` getter, and the `NoteMetadata.attachment()` getter were all **removed**. Build attachments with `NoteAttachment.fromWord(scheme, word)` or `NoteAttachment.fromWords(scheme, words)`, and read them back with `NoteAttachment.toWords()`. The attachment words now live on the note record (`InputNoteRecord.attachments()`), not on `NoteMetadata`. `NoteAttachmentScheme` is now u16‑backed: its constructor throws if the value exceeds the u16 range, and `NoteAttachmentScheme.asU32()` was removed.

### Affected Code
```typescript
// 0.15 — new API:
const att = NoteAttachment.fromWord(scheme, word);    // single word
const attMulti = NoteAttachment.fromWords(scheme, [w0, w1]);
const words = att.toWords();                          // Word[] — inverse of fromWord/fromWords
// NoteAttachmentKind, asWord, asArray, attachmentKind, scheme.asU32(),
// and NoteMetadata.attachment() no longer exist.
```

### Migration Steps
1. Replace `NoteAttachment.newWord(scheme, word)` with `NoteAttachment.fromWord(scheme, word)` and `newArray(scheme, felts)` with `fromWords(scheme, words)`.
2. Replace `att.asWord()` / `att.asArray()` / `att.attachmentKind()` reads with `att.toWords()` and decode the `Word[]` yourself.
3. Replace `noteMetadata.attachment()` with `inputNoteRecord.attachments()`.
4. Drop `NoteAttachmentScheme.asU32()`; the scheme is u16‑backed and its constructor validates the range.

---

## (Web) `InputNoteRecord.id()` returns `NoteId | undefined`; IDB re‑keyed

### Summary
A partial (metadata‑less) input note has no note ID yet, so `InputNoteRecord.id()` now returns `NoteId | undefined`. A new `InputNoteRecord.attachments()` getter returns the note's attachments (`NoteAttachment[]`; empty when none). On the storage side, `miden-idxdb-store` now keys input notes by their **details commitment** instead of their note ID (matching the SQLite store): the `InputNotes` table's primary index changed from `noteId` to `detailsCommitment`, so a partial note later completed with its note ID updates the same row instead of creating a duplicate.

### Affected Code
```typescript
// 0.15 — new API:
const id = record.id();                          // NoteId | undefined
if (id) { const idStr = id.toString(); }
const attachments = record.attachments();        // NoteAttachment[]
```

### Migration Steps
1. Guard every `record.id()` use against `undefined` (partial notes have no ID).
2. Replace `noteMetadata.attachment()` reads with `record.attachments()`.
3. If you query IndexedDB directly, switch input‑note lookups from `noteId` to `detailsCommitment`. Re‑sync existing `0.14` stores under `0.15`.

---

## (Web) `importNoteFile` / `notes.import` resolve to a hex `string`

### Summary
`WebClient.importNoteFile(...)` (and `notes.import(...)`) now resolves to a hex `string` instead of a `NoteId` object. Upstream `Client::import_notes` returns details‑commitments rather than note IDs, so the web method returns the note‑id hex for a metadata‑bearing file, or the details‑commitment hex for a details‑only file. Pass it to `NoteId.fromHex(...)` if you need a `NoteId` instance.

### Migration Steps
1. Treat the return value as a hex `string`; drop any `.toString()` / `NoteId` method calls on it.
2. If you need a `NoteId`, wrap the result with `NoteId.fromHex(hex)`.
3. Be aware the returned hex may be a details‑commitment (not a note‑id) for details‑only files.

---

## (Web) `Felt` and `Word` constructors throw on overflow

### Summary
`new Felt(value)` and `new Word(values)` now throw when an input is at or beyond the field modulus, instead of silently constructing an out‑of‑range value. Each input must be a canonical field element. Wrap construction from untrusted input in `try`/`catch`.

### Migration Steps
1. Reduce or validate values to the field modulus before constructing `Felt` / `Word`, or catch the thrown error.
2. Audit any code that fed raw `u64` / `bigint` values (e.g. from external systems) into these constructors.

---

## (Web) `syncNotes` `blockTo` required; `chainTip()` removed

### Summary
`RpcClient.syncNotes(blockFrom, blockTo, noteTags)`'s `blockTo` parameter is now **required** (was optional). The upstream RPC no longer returns the chain tip, so `NoteSyncInfo.chainTip()` was removed — use `client.syncState()` to learn the chain tip. `NoteSyncInfo.blockTo()` still exists.

### Migration Steps
1. Always pass an explicit `blockTo` to `syncNotes`.
2. Replace `NoteSyncInfo.chainTip()` reads with `client.syncState()`.

---

## (Web) `getNoteScriptByRoot` returns `NoteScript | undefined`

### Summary
`RpcClient.getNoteScriptByRoot(scriptRoot)` now resolves to `NoteScript | undefined` instead of throwing when the node has no script for the given root.

### Migration Steps
1. Replace the `try`/`catch` "not found" path with an `=== undefined` check.
2. Keep a `try`/`catch` only for genuine transport/RPC failures.

---

## (Web) `FetchedNote` exposes `noteId`/`metadata`; `header` removed

### Summary
`FetchedNote` (returned by `RpcClient.getNotesById(...)`) now stores `noteId` and `metadata` directly and exposes them as getters. The synthetic `header` getter was **removed** — a `NoteHeader` can no longer be reconstructed from header‑shaped fields alone for private notes. A new `attachments` getter exposes the note's attachments (populated for both public and private fetched notes). The JS constructor signature is unchanged.

### Migration Steps
1. Replace `fetched.header.id()` with `fetched.noteId` and `fetched.header.metadata()` with `fetched.metadata`.
2. Remove any code that reconstructs a `NoteHeader` from a `FetchedNote`.
3. Read attachments via `fetched.attachments` (works for private notes too).

---

## (Web) `newFaucet` rebuilt on `FungibleFaucet` + `TokenPolicyManager`

### Summary
`WebClient.newFaucet(...)` (and `accounts.create({ type: "FungibleFaucet", ... })`) now assembles a faucet from the `0.15` `FungibleFaucet` component plus a `TokenPolicyManager` that registers `AllowAll` mint and burn policies (transfer policies are intentionally omitted). `non_fungible = true` still fails fast. The JS signature `newFaucet(storageMode, nonFungible, tokenName, tokenSymbol, decimals, maxSupply, authScheme)` is unchanged. Separately, `BasicFungibleFaucetComponent.fromAccount(account)` now reads the new `0.15` metadata slot, so **faucets minted by prior SDK versions can no longer be introspected through it**.

### Migration Steps
1. No call‑site change for creating faucets — the JS signature is the same.
2. Re‑create faucets under `0.15` if you need `BasicFungibleFaucetComponent.fromAccount(...)` to introspect them.
3. Keep passing `non_fungible = false`; `true` still throws "Non‑fungible faucets are not supported yet".

---

## (Web) `idxdb-store`: `committedNoteIds` → `committedNoteTagSources`

### Summary
On `miden-idxdb-store`'s `JsStateSyncUpdate`, the `committedNoteIds` field was renamed to `committedNoteTagSources` and now carries details‑commitment hex rather than note‑id hex. Anyone driving the IndexedDB store's sync apply path directly (or stubbing `JsStateSyncUpdate` in tests) must rename the field and feed details‑commitment hex.

### Migration Steps
1. Rename `committedNoteIds` → `committedNoteTagSources` everywhere you construct or read `JsStateSyncUpdate`.
2. Supply details‑commitment hex (not note‑id hex) for those entries.

---

## (Web) `getAccountProof` rewired; WASM `ClientError` gains a `code`

### Summary
Two smaller web changes:
- `RpcClient.getAccountProof(accountId, storageRequirements?, blockNum?, knownVaultCommitment?)` keeps the **same JS signature** but is now wired onto the `0.15` `get_account(GetAccountRequest...)` upstream API. No JS call‑site change is required; it needs a `0.15` node.
- WASM client errors now carry a stable, machine‑readable **`code`** property on the thrown JS error — currently `ACCOUNT_NOT_FOUND_ON_CHAIN` and `ACCOUNT_ALREADY_TRACKED`. This is additive (message‑string matching still works) but branching on `code` is the recommended pattern, and the worker shim forwards it.

### Migration Steps
1. Point `getAccountProof` callers at a `0.15` node (the underlying RPC was renamed/reshaped).
2. Where you match on `ClientError` message text for "account not found on chain" or "already tracked", switch to `error.code`. Keep a fallback for errors without a `code` (only those two variants are mapped today).

---

## (Web) `WasmWebClient.proveTransactionWithProver` → `proveTransaction`

### Summary
On the raw WASM client (`WasmWebClient` — the low-level surface behind `MidenClient`), `proveTransactionWithProver(txResult, prover)` was **renamed `proveTransaction(txResult, prover?)`**, with the prover now an optional second parameter (omitting it uses the local prover). The high-level `MidenClient` resource API is unaffected, but anything driving the raw client directly — worker shims, offscreen/prover documents, `_withInnerWebClient` callbacks — must rename the call.

### Affected Code
```typescript
// 0.15 — new API (raw WasmWebClient surface):
const proven = await wasmWebClient.proveTransaction(txResult, prover);
// prover may be omitted to prove locally:
const proven2 = await wasmWebClient.proveTransaction(txResult);
```

### Migration Steps
1. Rename `proveTransactionWithProver(txResult, prover)` to `proveTransaction(txResult, prover)`.
2. Audit any code that already called a 0.14 `proveTransaction()` *without* a prover — the 0.15 signature is compatible (prover optional), no change needed.

---

## (Web) `storeIdentifier()` is now async

### Summary
`MidenClient.storeIdentifier()` now returns a **`Promise<string>`** instead of a plain `string` (the identifier is read from the client behind the worker/async boundary). Call sites that fed the result into `exportStore` / `importStore` or string operations must `await` it.

### Migration Steps
1. `await client.storeIdentifier()` everywhere; un-awaited uses surface as `Promise<string>`-vs-`string` type errors (or `[object Promise]` store names at runtime).

---

## (Web) `InputNoteRecord.nullifier()` returns `string | undefined`

### Summary
Because a 0.15 nullifier folds in the note's metadata (see [Nullifier now includes metadata and attachments commitment](./note-changes#nullifier-now-includes-metadata-and-attachments-commitment)), a **partial (metadata-less) input note record has no computable nullifier** — `InputNoteRecord.nullifier()` now returns `string | undefined`, pairing with `id()`'s `NoteId | undefined`. A record missing either is a partial note that sync has not yet completed.

### Migration Steps
1. Guard `record.nullifier()` against `undefined` alongside the existing `record.id()` guard; treat records missing either as not-yet-consumable and skip them from listings.

---

## (React) `useCreateWallet` / `useCreateFaucet` drop `"network"`

### Summary
Matching the `StorageMode` narrowing, the React `useCreateWallet({ storageMode })` and `useCreateFaucet({ storageMode })` hooks no longer accept `"network"`. The `storageMode` option type is now `"private" | "public"`.

### Migration Steps
1. Replace `storageMode: "network"` with `"public"` or `"private"` in every `createWallet` / `createFaucet` call.
2. Update any local `StorageMode`‑typed state feeding these hooks.

---

## (CLI) `--account-type` accepts only `private` / `public`

### Summary
The `-t` / `--account-type` flag on `new-account` / `new-wallet` now takes only `private` or `public` (account *visibility*); the legacy values (`fungible-faucet`, `non-fungible-faucet`, `regular-account-immutable-code`, `regular-account-updatable-code`), the separate `--mutable` flag, and the standalone `--storage-mode` toggle were removed. Whether an account is a faucet is derived from its components — installing a `FungibleFaucet` component yields a fungible faucet (with an implicit `TokenPolicyManager`).

### Affected Code
```diff
# 0.15 — new API:
+ miden-client new-wallet --account-type public
```

### Migration Steps
1. Replace `--account-type <regular/faucet variant>` with `--account-type private|public`.
2. Drop `--mutable` and `--storage-mode`; pick the faucet vs. wallet shape via the `-p` package/components.

---

## (CLI) `new-faucet` requires a `[fungible-faucet-metadata]` block

### Summary
The faucet init‑data file passed via `-i` now uses a typed `[fungible-faucet-metadata]` block (`symbol`, `decimals`, `max_supply`, optional `name`) instead of the old stringly‑typed `["miden::standards::fungible_faucets::metadata"]` section. Faucet accounts created with the previous layout are no longer recognized by `account list` / `account show`.

### Affected Code
```diff
# 0.15 — new API: — init-data TOML
+ [fungible-faucet-metadata]
+ symbol = "BTC"
+ decimals = 10
+ max_supply = 10000000
```

### Migration Steps
1. Rename the section to `[fungible-faucet-metadata]` and switch to typed scalars (`decimals` / `max_supply` are integers, not quoted strings).
2. Re‑create existing faucets — the previous component layout is no longer recognized.

---

## (CLI) `address add` takes bech32; new `address encode`

### Summary
`address add` now takes `<ACCOUNT_ID> <BECH32_ADDRESS>` (a pre‑encoded address) instead of `<ACCOUNT_ID> <INTERFACE> [TAG_LEN]`. A new `address encode <ACCOUNT_ID> <INTERFACE> [TAG_LEN]` subcommand produces the bech32 string from the individual fields.

### Affected Code
```bash
# 0.15 — new API:
miden-client address encode <ACCOUNT_ID> <INTERFACE> [TAG_LEN]   # produces the bech32 string
miden-client address add <ACCOUNT_ID> <BECH32_ADDRESS>          # stores the pre-encoded address
```

### Migration Steps
1. Build the bech32 address first with `address encode <ACCOUNT_ID> <INTERFACE> [TAG_LEN]`.
2. Pass that string to `address add <ACCOUNT_ID> <BECH32_ADDRESS>`.
