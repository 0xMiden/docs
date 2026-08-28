---
title: Transactions
sidebar_position: 4
---

# Transactions

`client.transactions` is the resource namespace for sending, minting, consuming, swapping, running custom scripts, and inspecting transaction history. The simplified operations below handle the full lifecycle — execute, prove, submit — in one call.

## Simplified operations

### `send`

Creates a pay-to-ID note that transfers tokens from one account to another.

```typescript
import { MidenClient } from "@miden-sdk/miden-sdk";

const client = await MidenClient.createTestnet();

const { txId } = await client.transactions.send({
  account: senderWallet,
  to: recipientWallet,
  token: faucet,
  amount: 100n,
  type: "private",       // "public" or "private" — default "public"
  reclaimAfter: 100,     // optional: block number after which sender can reclaim
  timelockUntil: 90,     // optional: block number until which note is timelocked
});
console.log("Send tx:", txId.toHex());
```

Set `returnNote: true` to receive the created `Note` in the result (useful when you need the note body — for QR delivery, for example):

```typescript
const { txId, note } = await client.transactions.send({
  account: senderWallet,
  to: recipientWallet,
  token: faucet,
  amount: 100n,
  returnNote: true,
});
// `note` is guaranteed non-null when returnNote is true
```

`reclaimAfter` and `timelockUntil` are **block numbers**, not wall-clock times.

:::note
The `returnNote: true` branch is a separate overload: it does not accept `reclaimAfter` or `timelockUntil`. If you need either of those, use the default branch (without `returnNote`) and retrieve the note through `client.notes.listSent()` instead.
:::

### `mint`

```typescript
const { txId } = await client.transactions.mint({
  account: faucet,    // the faucet account
  to: wallet,         // recipient
  amount: 1000n,
  type: "private",    // optional, default "public"
});
console.log("Mint tx:", txId.toHex());
```

### `consume`

```typescript
// Consume one or more input notes
const { txId } = await client.transactions.consume({
  account: wallet,
  notes: [noteId1, noteId2],  // note references — hex strings, NoteIds, records, or Notes
});

// Single note also accepted directly, no array needed
await client.transactions.consume({
  account: wallet,
  notes: noteId1,
});
```

### `consumeAll`

Consumes every available note for an account, up to an optional limit. Useful for quickly draining an inbox.

```typescript
const result = await client.transactions.consumeAll({ account: wallet });
console.log(`Consumed ${result.consumed}, ${result.remaining} remaining`);
if (result.txId) {
  console.log("Tx:", result.txId.toHex());
}

// Cap the number of notes consumed in one transaction
await client.transactions.consumeAll({ account: wallet, maxNotes: 5 });
```

`result.remaining > 0` signals pagination — call `consumeAll` again to drain the rest.

### `swap`

Atomic swap between two assets.

```typescript
const { txId } = await client.transactions.swap({
  account: wallet,
  offer: { token: faucetA, amount: 100n },
  request: { token: faucetB, amount: 200n },
  type: "public",           // optional — visibility of the offer note
  paybackType: "private",   // optional — visibility of the payback note
});
```

## Waiting for confirmation

All simplified operations return as soon as the transaction is submitted to the mempool. To block until the network commits the transaction, use `waitFor`:

```typescript
const { txId } = await client.transactions.mint({
  account: faucet,
  to: wallet,
  amount: 1000n,
});

// Default: 60s timeout, 5s polling interval
await client.transactions.waitFor(txId.toHex());

// Custom polling
await client.transactions.waitFor(txId.toHex(), {
  timeout: 120_000,   // 2 minutes — set to 0 to poll indefinitely
  interval: 3_000,
  onProgress: (status) => {
    console.log(`Status: ${status}`); // "pending" | "submitted" | "committed"
  },
});
```

`waitFor` throws on rejection or timeout.

## Preview transactions awaiting authorization

`preview()` derives the `TransactionSummary` that an account is being asked to authorize without proving or submitting the transaction. It only returns a summary when authorization is still pending, such as a multisig request that has not reached its threshold:

```typescript
const summary = await client.transactions.preview({
  operation: "send",
  account: multisigAccount,
  to: recipient,
  token: faucet,
  amount: 100n,
});
```

If the account already authorizes the request, execution succeeds without producing a pending summary and `preview()` rejects with `TRANSACTION_ALREADY_AUTHORIZED`. Submit that transaction normally instead. The built-in preview operations follow the same rule. Use `operation: "custom"` when previewing a pre-built `TransactionRequest`, as in the cross-client flow below.

### Keep a cross-client summary reproducible

A transaction summary commits to its reference block. When one client proposes a transaction and another verifies or executes it later, capture a `ChainAnchor` and send it alongside the summary so every participant derives the transaction at the same block:

```typescript
import { ChainAnchor, TransactionSummary } from "@miden-sdk/miden-sdk";

// Proposer: capture the request's reference block and derive the summary there.
const anchor = await client.transactions.captureAnchor(request);
const summary = await client.transactions.preview({
  operation: "custom",
  account: multisigAccount,
  request,
  anchor,
});

const anchorBytes = anchor.serialize();
const summaryBytes = summary.serialize();
await sendProposal(anchorBytes, summaryBytes);

// Co-signer or executor: restore the proposal and re-derive it at the same block.
const receivedAnchor = ChainAnchor.deserialize(anchorBytes);
const proposedSummary = TransactionSummary.deserialize(summaryBytes);
const derivedSummary = await client.transactions.preview({
  operation: "custom",
  account: multisigAccount,
  request,
  anchor: receivedAnchor,
});

if (derivedSummary.toCommitment().toHex() !== proposedSummary.toCommitment().toHex()) {
  throw new Error("The request does not match the proposed summary");
}

if (receivedAnchor.commitment().toHex() !== proposedSummary.blockCommitment().toHex()) {
  throw new Error("The anchor does not match the proposed summary");
}

// After collecting the required authorization, replay at the anchored block.
await client.transactions.submit(multisigAccount, request, { anchor: receivedAnchor });
receivedAnchor.free();
anchor.free();
```

An anchor makes the request reproducible; it does not prove that the transaction matches the signer's intent. Inspect the summary's account delta and input/output notes before signing. Also verify a received anchor's block against a trusted node when the proposer is not trusted. If `summary.expirationDelta()` is non-zero, the transaction expires at `anchor.blockNum() + summary.expirationDelta()`; if that deadline passes, capture a new anchor and collect authorization again.

## Custom transaction scripts (`execute`)

When the simplified operations aren't enough — for example to call a procedure on a contract account — compile a transaction script with [`client.compile.txScript()`](./compile.md) and run it through `execute`:

```typescript
import { MidenClient } from "@miden-sdk/miden-sdk";

const client = await MidenClient.createTestnet();

const script = await client.compile.txScript({
  code: `
    use external_contract::counter_contract

    @transaction_script
    pub proc main
      call.counter_contract::increment_count
    end
  `,
  // Reuse the component installed on contractAccount.
  libraries: [{ component: counterComponent }],
});

const { txId } = await client.transactions.execute({
  account: contractAccount.id(),
  script,
});

console.log("Tx:", txId.toHex());
```

### Foreign procedure invocation (FPI)

Pass `foreignAccounts` to read state from other contracts during execution:

```typescript
import { MidenClient, StorageSlot } from "@miden-sdk/miden-sdk";

const client = await MidenClient.createTestnet();

// Compile the foreign contract to get a procedure hash
const counterComponent = await client.compile.component({
  code: counterContractCode,
  namespace: "external_contract::counter_contract",
  slots: [StorageSlot.emptyValue("miden::tutorials::counter")],
});
const getCountHash = counterComponent.getProcedureHash("get_count");

const script = await client.compile.txScript({
  code: `
    use external_contract::count_reader_contract
    use miden::core::sys

    @transaction_script
    pub proc main
      padw padw padw padw
      push.${getCountHash}
      push.${counterAccount.id().prefix()}
      push.${counterAccount.id().suffix()}
      call.count_reader_contract::copy_count
      exec.sys::truncate_stack
    end
  `,
  // Reuse the component installed on countReaderAccount.
  libraries: [{ component: countReaderComponent }],
});

const { txId } = await client.transactions.execute({
  account: countReaderAccount.id(),
  script,
  foreignAccounts: [
    // A bare reference is sufficient here because get_count reads a value slot.
    counterAccount.id(),
    // Storage-map entries require explicit storage requirements:
    // { id: counterAccount.id(), storage: requirements },
  ],
});
```

## View calls (`executeProgram`)

`executeProgram` runs a transaction script locally, returning the resulting stack without submitting or proving anything. Use it to read onchain state — similar to `eth_call` in Ethereum.

```typescript
const script = await client.compile.txScript({
  code: `
    use external_contract::counter_contract

    @transaction_script
    pub proc main
      call.counter_contract::get_count
    end
  `,
  libraries: [{ component: counterComponent }],
});

const stack = await client.transactions.executeProgram({
  account: contractAccount.id(),
  script,
});

// Node.js returns Felt[]; browser WASM returns the FeltArray wrapper.
const first = Array.isArray(stack) ? stack[0] : stack.get(0);
const count = first.asInt();
console.log("Count:", count);
```

Options:

| Option | Type | Description |
| --- | --- | --- |
| `account` | `AccountRef` | Account to execute the script against. |
| `script` | `TransactionScript` | Compiled script. |
| `adviceInputs` | `AdviceInputs?` | Advice inputs for the VM. Defaults to empty. |
| `foreignAccounts` | `(AccountRef \| { id, storage? })[]?` | Foreign accounts for FPI reads. |

## Manual `TransactionRequest`

For full control over note inputs and outputs — e.g. emitting multiple output notes from one transaction — build a `TransactionRequest` yourself and pass it to `submit`.

The builder accepts WASM array classes (`NoteArray`, `NoteDetailsAndTagArray`, `NoteRecipientArray`) rather than plain TypeScript arrays.

```typescript
import {
  MidenClient,
  TransactionRequestBuilder,
  NoteArray,
} from "@miden-sdk/miden-sdk";

const client = await MidenClient.createTestnet();

// Populate a NoteArray with your output notes
const ownOutputs = new NoteArray();
for (const note of outputNotes) {
  ownOutputs.push(note);
}

const request = new TransactionRequestBuilder()
  .withOwnOutputNotes(ownOutputs)
  .build();

const { txId } = await client.transactions.submit(wallet, request);
console.log("Tx:", txId.toHex());
```

Expected-note hints are also available:

- `withExpectedFutureNotes(NoteDetailsAndTagArray)` — notes the transaction should produce but won't emit directly (e.g. for later pickup).
- `withExpectedOutputRecipients(NoteRecipientArray)` — recipients for expected output notes.

### Setting an expiration

```typescript
const request = new TransactionRequestBuilder()
  .withOwnOutputNotes(ownOutputs)
  .withExpirationDelta(10) // expires 10 blocks after the reference block
  .build();

await client.transactions.submit(wallet, request);
```

`withExpirationDelta()` cannot be combined with `withCustomScript()`; `build()` rejects that combination. A custom script must set its expiration through the transaction context instead.

## Remote proving

Local proving is CPU-intensive. Offload globally via `ClientOptions.proverUrl`, or per-transaction via the `prover` field:

```typescript
// Global: every transaction uses the remote prover
const client = await MidenClient.create({
  rpcUrl: "testnet",
  proverUrl: "https://prover.example.com",
});

// Per-transaction: pass a TransactionProver instance
await client.transactions.send({
  account: wallet,
  to: recipient,
  token: faucet,
  amount: 100n,
  prover: customProver,
});
```

## History

Query past transactions through `client.transactions.list()`.

```typescript
// All transactions
const all = await client.transactions.list();

// Only uncommitted
const uncommitted = await client.transactions.list({ status: "uncommitted" });

// By ID
const specific = await client.transactions.list({ ids: [txId1, txId2] });

// By expiration
const expired = await client.transactions.list({ expiredBefore: 1000 });
```

Each record exposes:

```typescript
for (const tx of all) {
  tx.id().toHex();
  tx.accountId().toString(); // AccountId.toString() returns canonical hex
  tx.blockNum().toString();

  const status = tx.transactionStatus();
  if (status.isPending())    console.log("Pending");
  if (status.isCommitted())  console.log("Committed at", status.getBlockNum(), status.getCommitTimestamp());
  if (status.isDiscarded())  console.log("Discarded");

  tx.initAccountState().toHex();
  tx.finalAccountState().toHex();

  tx.inputNoteNullifiers().map((n) => n.toHex());
  tx.outputNotes().notes().map((note) => note.id().toString());
}
```

## Next

- [Notes](./notes.md) — list, import, export, private-note transport.
- [Compile](./compile.md) — MASM for account components, transaction scripts, note scripts.
- [Testing](./testing.md) — drive a fully in-memory mock chain for fast, deterministic tests.
