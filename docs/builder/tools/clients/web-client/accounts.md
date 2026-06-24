---
title: Accounts
sidebar_position: 3
---

# Accounts

`client.accounts` is the resource namespace for everything account-related: creation, lookup, listing, import / export, and address management. All ID fields accept an `AccountRef` — a hex string, bech32 string, `AccountId`, `Account`, or `AccountHeader` — so you rarely need to convert between them.

## Account type and auth scheme values

Account creation uses a few small option values. Wallets are the default shape; faucet creation is selected with a faucet type literal; contract creation is selected by passing `components`.

| Kind | Accepted values | Meaning |
| --- | --- | --- |
| faucet `type` field | `0` \| `1` | Fungible or non-fungible faucet selector |
| `auth` field | `"falcon"` \| `"ecdsa"` | Signing scheme — Falcon is the default |
| `storage` field | `"public"` \| `"private"` | Account visibility mode |
| low-level `AccountType` | `AccountType.Public` \| `AccountType.Private` | WASM builder visibility flag |

The v0.15 protocol no longer encodes wallet/faucet/contract role or mutability in the low-level `AccountType`; role comes from the create options and attached components.

## Create

### Wallet

```typescript
import { MidenClient } from "@miden-sdk/miden-sdk";

const client = await MidenClient.createTestnet();

// Default: wallet, private storage, Falcon auth
const wallet = await client.accounts.create();

// With explicit options
const wallet2 = await client.accounts.create({
  storage: "public",
  auth: "ecdsa",
  seed: "my-seed", // hashed to 32 bytes via SHA-256
});

console.log(wallet.id().toString());       // hex
console.log(wallet.nonce().toString());
console.log(wallet.isPublic());
console.log(wallet.isPrivate());
console.log(wallet.isFaucet());
console.log(wallet.isRegularAccount());
```

### Faucet

```typescript
import {
  MidenClient,
  type AccountTypeValue,
} from "@miden-sdk/miden-sdk";

const FUNGIBLE_FAUCET: AccountTypeValue = 0;

const client = await MidenClient.createTestnet();

const faucet = await client.accounts.create({
  type: FUNGIBLE_FAUCET,
  symbol: "TEST",
  decimals: 8,
  maxSupply: 10_000_000n, // number | bigint
});

const faucet2 = await client.accounts.create({
  type: FUNGIBLE_FAUCET,
  symbol: "DAG",
  decimals: 8,
  maxSupply: 10_000_000n,
  storage: "public",
  auth: "falcon",
});
```

### Contract

Contract accounts hold custom MASM code. Compile the code into an `AccountComponent` with [`client.compile.component()`](./compile.md), then create the account:

```typescript
import {
  MidenClient,
  AuthSecretKey,
  StorageSlot,
} from "@miden-sdk/miden-sdk";

const counterCode = `
  use miden::protocol::active_account
  use miden::protocol::native_account
  use miden::core::word
  use miden::core::sys

  const COUNTER_SLOT = word("miden::tutorials::counter")

  pub proc get_count
    push.COUNTER_SLOT[0..2] exec.active_account::get_item
    exec.sys::truncate_stack
  end

  pub proc increment_count
    push.COUNTER_SLOT[0..2] exec.active_account::get_item
    add.1
    push.COUNTER_SLOT[0..2] exec.native_account::set_item
    exec.sys::truncate_stack
  end
`;

const client = await MidenClient.createTestnet();

const component = await client.compile.component({
  code: counterCode,
  slots: [StorageSlot.emptyValue("miden::tutorials::counter")],
});

const seed = crypto.getRandomValues(new Uint8Array(32));
const auth = AuthSecretKey.rpoFalconWithRNG(seed);

const contract = await client.accounts.create({
  seed,
  auth,
  components: [component],
});

console.log("Contract:", contract.id().toString());
console.log("Is public:", contract.isPublic()); // contracts default to public
```

Contract defaults:

- **Storage** — defaults to `"public"` (so other accounts can read state for FPI). Pass `storage: "private"` to override.
- **Auth** — must be a concrete `AuthSecretKey` instance, not a scheme string. The caller retains the key; the client uses it to sign transactions that touch the contract.
- **Seed** — required, 32 bytes. Determines the account ID.

### Pre-built via `AccountBuilder`

When you need full control — e.g. an external signer that provides an auth commitment instead of a secret key — build the account manually and hand it to `insert()`:

```typescript
import {
  MidenClient,
  AccountBuilder,
  AccountComponent,
  AccountType,
} from "@miden-sdk/miden-sdk";

const client = await MidenClient.createTestnet();

const commitment = /* externalSigner.getPublicKeyCommitment() */ (undefined as any);
const seed = new Uint8Array(32); // deterministic seed from your derivation path

const account = new AccountBuilder(seed)
  .withAuthComponent(
    AccountComponent.createAuthComponentFromCommitment(commitment, 1),
  )
  .accountType(AccountType.Public)
  .withBasicWalletComponent()
  .build().account;

await client.accounts.insert({ account });
```

`accounts.insert()` is local-only: it persists the account to the store without any network call. Use it when you already have a valid `Account` object and just need to track it.

## Retrieve

### `get`

```typescript
const account = await client.accounts.get("0x1234...");
if (!account) {
  console.log("Not found locally");
  return;
}
console.log(account.id().toString());
console.log(account.nonce().toString());
console.log(account.isPublic());
console.log(account.isFaucet());
```

`get` only consults the local store. It returns `null` if the account isn't tracked.

### `getOrImport`

```typescript
// Returns the local copy if present; otherwise fetches from the network and stores it.
const account = await client.accounts.getOrImport(
  "mtst1arjemrxne8lj5qz4mg9c8mtyxg954483",
);
console.log("Nonce:", account.nonce().toString());
```

Use `getOrImport` for accounts you didn't create — a faucet or contract deployed by another party, for example. Once imported, subsequent calls return the local copy without hitting the network.

`get` vs `getOrImport`:

- `get` for local-only reads. Cheap, no network.
- `getOrImport` when the account may need to be pulled from chain.

### `list`

```typescript
const accounts = await client.accounts.list();
for (const header of accounts) {
  console.log(header.id().toString(), header.nonce().toString());
}
```

Returns `AccountHeader[]` — a lightweight summary suitable for listing UIs. Call `get()` if you need the full `Account`.

### `getDetails`

```typescript
const details = await client.accounts.getDetails("0x1234...");
console.log(details.account.id().toString());
console.log(details.vault);   // AssetVault
console.log(details.storage); // AccountStorage
console.log(details.code);    // AccountCode | null
console.log(details.keys);    // Word[] (public-key commitments)
```

One round-trip returns the full account plus its vault, storage, code, and key commitments.

### `getBalance`

```typescript
const balance: bigint = await client.accounts.getBalance(
  "0xACCOUNT...",
  "0xFAUCET...",
);
console.log(`Balance: ${balance}`);
```

## Address management

```typescript
await client.accounts.addAddress("0xACCOUNT...", "mtst1address...");
await client.accounts.removeAddress("0xACCOUNT...", "mtst1address...");
```

Associates one or more bech32 addresses with an account. Useful when your UI lets users alias accounts by a human-readable string.

## Import

`client.accounts.import()` accepts a discriminated union:

```typescript
// 1. By reference — fetches a public account from the network.
await client.accounts.import("0x1234...");                           // hex
await client.accounts.import("mtst1arjemrxne8lj5qz4mg9c8mtyxg954483"); // bech32

// 2. From a previously exported file.
await client.accounts.import({ file: accountFile });

// 3. From a seed — PUBLIC ACCOUNTS ONLY.
await client.accounts.import({
  seed: initSeed, // Uint8Array
  auth: "falcon",
});
```

:::warning[Seed imports are public-only]
Import-by-seed works only for accounts originally created with `storage: "public"`. Private account state is never published onchain, so it can't be reconstructed from a seed alone. For private accounts, use the file export / import workflow below.
:::

If you aren't sure whether the account is already in your local store, prefer [`getOrImport()`](#getorimport) — it skips the network call when the account is already known.

## Export

```typescript
const accountFile = await client.accounts.export("0x1234...");
// Persist accountFile to disk, send it to another device, etc.
```

`AccountFile` includes the full account state, code, seed (if new), and tracked secret keys. Treat it as sensitive.

## Error behaviour

- `get()` returns `null` when the account is not in the local store.
- `getDetails()`, `getBalance()`, and `export()` throw `"Account not found: 0x..."` when the account is missing.
- `import({ seed, ... })` on a private account throws at resolve time — private state isn't recoverable from a seed.

## Next

- [Transactions](./transactions.md) — spend, mint, consume, swap.
- [Compile](./compile.md) — turn MASM into `AccountComponent`s for contract accounts.
- [Sync and store](./sync.md) — refresh account state from the network.
