---
sidebar_position: 6
title: Coming from Ethereum
description: A mental-model map for developers familiar with Ethereum, the EVM, and Solidity — how accounts, tokens, transfers, storage, and execution translate to Miden.
---

# Coming from Ethereum

If you already know Ethereum and Solidity, this page maps the concepts you know to their Miden equivalents so the rest of the documentation reads faster.

## The three big shifts

Almost every difference between Ethereum and Miden follows from three architectural decisions:

1. **Local execution instead of global execution.** On Ethereum, every node re-executes every transaction to agree on a single global state. On Miden, the user executes a transaction locally and produces a zero-knowledge proof; the network only verifies the proof and records the resulting commitments.
2. **Notes instead of direct balance updates.** Ethereum is account-based: a transfer mutates two balances in one global state transition. Miden transfers are note-based (UTXO-like) and span two transactions: the sender creates a note carrying the assets, and the recipient consumes it in a separate transaction. A Miden transaction is always the state transition of a _single_ account.
3. **Privacy by default.** On Ethereum, all state and calldata is public. On Miden, accounts, notes, and transactions can be public or private — private state is held by its owner, with only commitments onchain.

## Concept mapping

| Ethereum / Solidity                                    | Miden                                                                                                            |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Smart contract (code + storage at an address)          | Account — every account is a smart contract with code, storage, and an asset vault                                |
| Externally owned account (EOA)                         | Account composed of a wallet component and an authentication component                                            |
| State variables / `mapping`                            | Account storage slots and storage maps (up to 255 slots per account)                                              |
| ERC-20 token contract                                  | Fungible faucet account issuing a fungible asset                                                                  |
| `transfer(to, amount)`                                 | Creating a P2ID (pay-to-ID) note; the recipient consumes it in a second transaction                               |
| Token minting / issuance                               | A faucet mints assets into a note addressed to the recipient                                                      |
| `msg.sender`                                           | The account's authentication component (e.g. a signature scheme) authorizes its transactions                      |
| Events / logs                                          | Notes — the primary communication primitive between accounts                                                      |
| `eth_call` (read-only call)                            | `executeProgram` — runs a script locally against account state, without submitting or proving                     |
| Public mempool, all data public                        | Public and private notes; private note data is exchanged offchain via a note transport layer                      |
| One transaction can touch many contracts atomically    | One transaction transitions one account; cross-account interaction happens via notes and foreign procedure calls  |

## Assets and transfers

In Solidity, moving tokens is a single call that updates two balances atomically:

```solidity title="ERC-20 transfer (Solidity)"
// balances[msg.sender] -= amount; balances[to] += amount;
token.transfer(bob, 100);
```

In Miden, the same transfer is two transactions connected by a note:

```typescript title="P2ID transfer (TypeScript web client)"
import { MidenClient } from "@miden-sdk/miden-sdk";

const client = await MidenClient.createTestnet();

// Tx 1 (Alice): create a pay-to-ID note carrying 100 tokens, addressed to Bob.
const { txId } = await client.transactions.send({
  account: aliceWallet,
  to: bobWallet,
  token: faucet,
  amount: 100n,
  type: "private", // note data is not posted onchain
});

// Tx 2 (Bob): consume the note; the tokens move into Bob's vault.
await client.transactions.consume({ account: bobWallet, notes: noteId });
```

Two things are worth noticing:

- **Alice's transaction is final on its own.** Bob does not need to be online; the note waits until he consumes it. Alice can even attach a `reclaimAfter` block number to reclaim the assets if Bob never does.
- **The two transactions are unlinkable onchain** when the note is private — there is no global transfer event connecting sender and recipient.

The "sealed envelope" intuition and the full mint → consume flow are covered in [Notes & Transactions](./notes).

## Smart contracts

- **Language**: contracts are written in Rust and compiled to Miden assembly (MASM), or written directly in MASM — see [Smart Contracts](../smart-contracts/).
- **Storage**: instead of Solidity's flat storage layout, each account has up to 255 storage slots plus storage maps — see [Read Storage Values](./read-storage).
- **Authorization**: there is no implicit `msg.sender`; an account's authentication component defines how its transactions are authorized (e.g. a Falcon512 signature).
- **Read-only queries**: instead of `eth_call`, run a transaction script locally with `executeProgram`, which returns the resulting VM stack without submitting or proving anything.

## What stays familiar

- Wallets, token faucets, fungible and non-fungible assets, and DeFi-style flows all exist — they are just composed from accounts and notes.
- TypeScript tooling is first-class: the web client runs in the browser via WebAssembly, so dApp frontends look like any other web3 app.

## Where to go next

- [Accounts](./accounts) — create wallets and faucets programmatically
- [Notes & Transactions](./notes) — the two-transaction transfer model in depth
- [Read Storage Values](./read-storage) — query contract state
- [Smart Contracts](../smart-contracts/) — write contracts in Rust/MASM

---
