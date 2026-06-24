---
title: "What are Transactions?"
sidebar_position: 0
description: "Transactions are Miden's execution unit — they consume input notes and produce output notes, executed locally and proven before submission."
---

# What are Transactions?

Transactions are the execution unit in Miden. Every state change — transferring assets, updating storage, minting tokens — happens inside a transaction. Each transaction runs against a single account, consumes zero or more input notes, and produces zero or more output notes.

The critical difference from other blockchains: transactions execute locally on the user's machine, not on a shared VM. After execution, the Miden VM generates a zero-knowledge proof that the transaction was valid (see [transaction design](/reference/protocol/transaction)). Only this proof and the resulting state commitments are submitted to the network. The network never sees the transaction inputs, the account's private state, or the logic that ran.

## Anatomy of a transaction

Every transaction has these elements:

| Element | Description |
|---------|-------------|
| **Account** | The single account this transaction mutates — its storage, vault, and nonce |
| **Input notes** | Zero or more notes being consumed — their scripts run and assets transfer to the account |
| **Output notes** | Zero or more notes being created — carrying assets and scripts for future consumption |
| **Transaction script** | Optional entry-point logic that runs in addition to note scripts and component code |
| **Block reference** | The chain state the transaction executes against — provides block number, timestamp, and commitments |

A transaction can only modify one account. Cross-account interactions happen through notes: one account's transaction creates a note, another account's transaction consumes it.

## Transaction lifecycle

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Build    │────▶│ Execute  │────▶│  Prove   │────▶│  Submit  │────▶│  Verify  │
│          │     │          │     │          │     │          │     │          │
│ Assemble │     │ VM runs  │     │ ZK proof │     │ Proof +  │     │ Network  │
│ tx inputs│     │ locally  │     │ generated│     │ state    │     │ updates  │
│          │     │          │     │          │     │ sent     │     │ state    │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
```

1. **Build**: The client assembles the transaction — which account, which notes to consume, what methods to call.
2. **Execute**: The Miden VM runs the transaction locally. Note scripts execute, component code runs, storage is mutated, output notes are created.
3. **Prove**: The VM produces a zero-knowledge proof of correct execution. If any assertion fails (e.g., insufficient balance, unauthorized caller), the proof cannot be generated — the transaction is rejected before it ever reaches the network.
4. **Submit**: The proof and public state updates (new note commitments, updated account commitment, nullifiers for consumed notes) are submitted to the network.
5. **Verify**: The network verifies the proof, records the state changes, and includes the transaction in a batch and eventually a block.

## The transaction context

During execution, your code runs inside a **transaction context** that provides access to:

- **Block data** — current block number, timestamp, and commitments via the `tx` module
- **Input notes** — the notes being consumed, their assets, inputs, and metadata
- **Account state** — the executing account's storage, vault, and nonce
- **Output notes** — the ability to create new notes and attach assets

The transaction context is what connects your component code to the chain state. For example, you can implement time-based logic by comparing `tx::get_block_number()` against a stored value, or read note inputs to determine what action to take.

## What happens when execution fails

When an assertion fails in your code:

```rust
assert!(amount > felt!(0));
```

The ZK circuit **cannot produce a valid proof**. This means:

- The transaction is rejected **before it ever reaches the network**
- No state changes occur — it's as if the transaction never happened
- No gas or fees are consumed
- The client gets an error explaining which assertion failed

This is fundamentally different from Ethereum's `revert`, where the failed transaction still lands onchain, consumes gas, and is visible to everyone.

A separate failure mode is the **empty transaction**: a transaction that runs to completion but mutates no account state (storage, vault, or nonce) and consumes no input notes. Both the Rust client (which raises `TransactionRequestError::NoInputNotesNorAccountChange` before submission) and the VM kernel reject it. This typically catches transaction scripts whose conditional logic takes a no-op branch — see [Empty Transaction](../../tutorials/helpers/pitfalls#empty-transaction-no-state-change-no-notes) in the pitfalls guide for the recommended pattern.

## How transactions differ from EVM transactions

| | EVM | Miden |
|---|---|---|
| **Execution** | Every validator re-executes the transaction | Client executes locally, submits only the proof |
| **Scope** | Can call multiple contracts in one tx | One transaction mutates one account; cross-account via notes |
| **Privacy** | All inputs, state reads, and call traces are public | Network sees only the proof and state commitments |
| **Failure** | Onchain revert, gas consumed, visible trace | Proof can't be generated — no onchain trace, no cost |
| **Parallelism** | Transactions touching same state must serialize | Single-account scope enables parallel execution |
| **Authentication** | `msg.sender` set by protocol | Falcon-512 Poseidon2 signatures verified inside the transaction |
