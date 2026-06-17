---
sidebar_position: 7
title: "Client Changes"
description: "Web SDK resource-based API, Rust SDK keystore trait, lazy readers, state sync, and CLI changes in v0.14"
---

# Client Changes

:::info Affects Both Rust and Web SDKs
v0.14 introduces significant API changes to both the Rust and Web Miden clients. The Web SDK adopts a resource-based API pattern, while the Rust SDK gains a new `Keystore` trait, lazy readers, and streamlined state sync. Review both sections if you maintain cross-platform code.
:::

---

## Web SDK

### New resource-based MidenClient API

The monolithic `WebClient` god-object has been replaced by `MidenClient` with dedicated resource sub-objects. All operations are now accessed through typed namespaces: `client.accounts`, `client.transactions`, `client.notes`, `client.tags`, `client.settings`, `client.compile`, and `client.keystore`.

#### Construction

```typescript
// Before (0.13)
import { WebClient } from "@miden-sdk/miden-sdk";

const client = new WebClient();
await client.createClient({
  node_url: "https://rpc.testnet.miden.io",
  store_name: "my-store",
});
```

```typescript
// After (0.14)
import { MidenClient, AccountType } from "@miden-sdk/miden-sdk";

const client = await MidenClient.create({
  rpcUrl: "https://rpc.testnet.miden.io",
  noteTransportUrl: "https://ntx.testnet.miden.io",
  storeName: "my-store",
});

// Or use the testnet convenience constructor
const client = await MidenClient.createTestnet();
```

#### Account creation

```typescript
// Before (0.13)
const wallet = await client.newWallet(
  AccountStorageMode.private(),
  true,
  undefined,
);
const faucet = await client.newFaucet(
  AccountStorageMode.public(),
  false,
  "DAG",
  8,
  BigInt(10_000_000),
);
```

```typescript
// After (0.14)
const wallet = await client.accounts.create(); // mutable, private wallet (defaults)
const faucet = await client.accounts.create({
  type: AccountType.FungibleFaucet,
  symbol: "DAG",
  decimals: 8,
  maxSupply: 10_000_000n,
  storage: "public",
});
```

#### Sending assets

```typescript
// Before (0.13)
const request = client.newSendTransactionRequest(
  wallet.id(),
  AccountId.fromHex(targetHex),
  faucet.id(),
  NoteType.private(),
  BigInt(100),
  null,
  null,
);
const tx = await client.submitNewTransaction(wallet.id(), request);
```

```typescript
// After (0.14)
const { txId } = await client.transactions.send({
  account: wallet,        // executing (sender) account
  to: targetHex,          // string hex ID, AccountId, or Account all accepted
  token: faucet,          // faucet account that minted the asset
  amount: 100n,
  waitForConfirmation: true,
});
```

#### Consuming notes

```typescript
// Before (0.13)
const notes = await client.getConsumableNotes(wallet.id());
const req = client.newConsumeTransactionRequest(
  [notes[0].inputNoteRecord().id().toString()],
);
await client.submitNewTransaction(wallet.id(), req);
```

```typescript
// After (0.14)
const notes = await client.notes.listAvailable({ account: wallet });
await client.transactions.consume({ account: wallet, notes: [notes[0]] });

// Or consume every available note in one call:
await client.transactions.consumeAll({ account: wallet });
```

#### Listing accounts

```typescript
// Before (0.13)
const accounts = await client.getAccounts();
```

```typescript
// After (0.14)
const accounts = await client.accounts.list();
```

#### Custom contracts

The new API adds first-class support for deploying custom smart contracts:

```typescript
// After (0.14) — compile and deploy a custom contract
const component = await client.compile.component({
  code: contractMasm,
  slots: [],
});

const contract = await client.accounts.create({
  type: AccountType.MutableContract,
  seed: new Uint8Array(32),
  auth: secretKey,
  components: [component],
});

// Compile a transaction script and execute it against the contract.
const script = await client.compile.txScript({
  code: scriptMasm,
});
await client.transactions.execute({ account: contract, script });
```

---

### AccountId.fromHex and key getters return Result

`AccountId.fromHex()` and related key getter methods previously called `unwrap()` internally and panicked on invalid input. They now return a `Result` type that throws on error in JavaScript.

```typescript
// Before (0.13) — panics on invalid hex
const id = AccountId.fromHex(hexString);

// After (0.14) — throws a descriptive error on invalid hex
try {
  const id = AccountId.fromHex(hexString);
} catch (e) {
  console.error("Invalid account ID:", e.message);
}
```

---

### Keystore API moved to client.keystore sub-object

Top-level keystore functions have been consolidated into the `client.keystore` namespace:

```typescript
// Before (0.13)
import { addAccountSecretKeyToWebStore, getAccountSecretKeyFromWebStore } from "@miden-sdk/miden-sdk";

await addAccountSecretKeyToWebStore(accountId, secretKey);
const key = await getAccountSecretKeyFromWebStore(accountId);
```

```typescript
// After (0.14)
await client.keystore.insert(accountId, secretKey);
const key = await client.keystore.get(pubKeyCommitment);       // takes a Word commitment
const commitments = await client.keystore.getCommitments(accountId);
const id = await client.keystore.getAccountId(pubKeyCommitment);
```

---

## Rust SDK

### Keystore trait replaces TransactionAuthenticator in Client

The new `Keystore` super-trait extends `TransactionAuthenticator` and consolidates key management. The client no longer requires separate calls to register public key commitments.

```rust
// Before (0.13)
keystore.insert_key(&secret).await?;
client.register_account_public_key_commitments(
    account_id,
    &[public_key_commitment],
).await?;
```

```rust
// After (0.14)
// Keystore::add_key handles both storage and commitment registration
keystore.add_key(&secret, account_id).await?;
```

The `Client::new()` constructor now accepts `impl Keystore` instead of `impl TransactionAuthenticator`:

```rust
// Before (0.13)
let client = Client::new(rpc, store, authenticator, ...);

// After (0.14)
let client = Client::new(rpc, store, keystore, ...);
```

---

### New AccountReader and InputNoteReader

Lazy readers allow you to access account and note data without loading everything into memory at once.

```rust
// Before (0.13) — loads the full Account object
let account = client.get_account(account_id).await?.unwrap();
let vault = account.vault();
let storage = account.storage();
```

```rust
// After (0.14) — lazy reader exposes commitments, balances, and storage items
let reader = client.account_reader(account_id);
let (header, status) = reader.header().await?;
let balance = reader.get_balance(faucet_id).await?;
let storage_item = reader.get_storage_item(slot_name).await?;
// plus reader.nonce(), vault_root(), storage_commitment(), code_commitment()
```

```rust
// After (0.14) — lazy, iterator-style traversal of notes consumable by an account
let mut notes = client.input_note_reader(consumer_account_id);
while let Some(note) = notes.next().await? {
    // process each InputNoteRecord
}
```

---

### Lazy foreign-account loading

Public foreign accounts are now fetched automatically via RPC when needed during transaction execution. You only need to provide `PartialAccount` data upfront for **private** foreign accounts.

```rust
// Before (0.13) — all foreign accounts had to be provided
let foreign_accounts = vec![
    ForeignAccount::public(public_account_id).await?,
    ForeignAccount::private(private_partial_account),
];
let tx_request = TransactionRequestBuilder::new()
    .with_foreign_accounts(foreign_accounts)
    .build()?;

// After (0.14) — only private foreign accounts need explicit loading
let tx_request = TransactionRequestBuilder::new()
    .with_foreign_accounts(vec![
        ForeignAccount::private(private_partial_account),
    ])
    .build()?;
// Public foreign accounts are auto-fetched via RPC during execution
```

---

### StorageMapKey is now a newtype

`StorageMapKey` was previously a type alias for `Word`. It is now a proper newtype, and the `LexicographicWord` wrapper has been removed.

```rust
// Before (0.13)
use miden_objects::accounts::StorageMapKey;
let key: StorageMapKey = [felt0, felt1, felt2, felt3]; // Was just a Word alias

// After (0.14)
use miden_protocol::account::StorageMapKey;
use miden_protocol::Word;
let key = StorageMapKey::new(Word::from([felt0, felt1, felt2, felt3]));
// LexicographicWord is no longer needed — StorageMapKey handles ordering.
// For sequential u32 keys, use the StorageMapKey::from_index(idx) shortcut.
```

---

### `sync_state()` no longer takes arguments; `StateSyncInput` now internal

`Client::sync_state()` builds its own `StateSyncInput` from the current store state — you no longer pass `account_ids`, `note_tags`, or `nullifiers` by hand. For custom sync scenarios, construct a `StateSyncInput` explicitly via `Client::build_sync_input()` and use the lower-level `StateSync` type.

```rust
// Before (0.13)
client.sync_state(
    &mut partial_mmr,
    account_ids,
    note_tags,
    nullifiers,
).await?;
```

```rust
// After (0.14)
let summary = client.sync_state().await?;

// For custom sync scenarios, build the input manually:
use miden_client::sync::StateSyncInput;
let input: StateSyncInput = client.build_sync_input().await?;
// …tweak `input.note_tags`, `input.input_notes`, etc. and drive
// a `StateSync` instance directly.
```

---

### MSRV 1.93

The minimum supported Rust version is now **1.93**. Update your toolchain:

```toml title="rust-toolchain.toml"
[toolchain]
channel = "1.93"
```

---

### CLI: CliConfig::load and CliClient::new

The CLI configuration and client constructors have been renamed for consistency.

```rust
// Before (0.13)
let config = CliConfig::from_system()?;
let client = CliClient::from_system_user_config(config, keystore).await?;
```

```rust
// After (0.14)
let config = CliConfig::load()?;
let client = CliClient::new(config, keystore).await?;
```

---

## New Client Features

:::info New in v0.14
These are new capabilities introduced in v0.14 that do not require migration but are worth adopting.
:::

- **NoteScreener and batch screening** - The `Client::note_screener()` API provides efficient batch screening of notes against account filters, replacing manual note-by-note checking.

- **Account history pruning** - New methods allow pruning old account state history to reduce local storage usage while preserving the current state.

- **GrpcClient automatic retry on rate limiting** - The gRPC client now automatically retries requests when rate-limited by the node, with up to 5 retries and honoring the server's `retry-after` header.

- **Automatic NTX note script registration** - Note scripts sent via the NTX transport are now registered automatically. Manual `register_note_script()` calls are no longer needed.

- **Typed RPC error parsing** - RPC errors are now parsed into structured Rust types, enabling programmatic error handling instead of string matching on error messages.
