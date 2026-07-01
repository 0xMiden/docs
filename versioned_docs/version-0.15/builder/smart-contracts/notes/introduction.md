---
title: "What are Notes?"
sidebar_position: 0
description: "Miden's cross-account communication mechanism — programmable UTXOs that carry assets, execute scripts, and trigger logic on consuming accounts."
---

# What are Notes?

Notes are Miden's primary mechanism for cross-account communication — they carry assets, execute programmable logic, and trigger state changes on the consuming account. Like UTXOs, notes are created and consumed atomically. Unlike Bitcoin's UTXOs, each Miden note carries an arbitrary executable script — written in Rust — that runs when the note is consumed, enabling programmable conditions far beyond simple locking scripts.

While asset transfers are the most common use of notes, notes are how accounts communicate with one another in general: a note can trigger a counter increment, initiate a swap, delegate an operation, or carry arbitrary data to be acted on by the recipient's logic.

Assets never transfer directly between accounts. Instead, they always move through notes. This indirection is what makes Miden private: the network sees notes being created and consumed, but it can't link sender and recipient accounts because those operations happen in separate transactions.

## Anatomy of a note

Every note has four parts:

| Part | Description |
|------|-------------|
| **Assets** | The fungible or non-fungible tokens the note carries |
| **Script** | Code that executes when the note is consumed — determines who can claim it and what side effects occur |
| **Storage** | Custom data stored with the note that the script can read at consumption time (e.g., a target account ID, an expiration block) |
| **Metadata** | Sender ID, note tag (for discovery routing), and auxiliary data |

The **recipient** is a Poseidon2 hash that encodes who can consume the note. When creating notes programmatically (via [`output_note::create`](./output-notes#create-a-note)), you compute a `Recipient` from the note's serial number, script root, and storage commitment:

```
recipient = hash(hash(hash(serial_num, [0;4]), script_root), storage_commitment)
```

Only someone who knows these values can construct a valid consumption proof. See [Computing a Recipient](./output-notes#computing-a-recipient) for the protocol helpers.

## The two-transaction model

Unlike Ethereum where a transfer is a single atomic call, Miden transfers happen across two separate transactions:

```
Transaction 1 (Sender)                Transaction 2 (Recipient)
┌─────────────────────────┐            ┌─────────────────────────┐
│ 1. Create note           │            │ 1. Discover note         │
│ 2. Attach assets         │            │ 2. Consume note          │
│ 3. Note published        │──────────▶│ 3. Script runs           │
│    (onchain or private) │            │ 4. Assets move to vault  │
│                          │            │ 5. Note nullified        │
└─────────────────────────┘            └─────────────────────────┘
```

**Transaction 1**: The sender's account creates an output note, attaches assets to it, and the note is published (either onchain or kept private).

**Transaction 2**: The recipient discovers the note, consumes it in their own transaction, the note script runs and verifies the consumer is authorized, and assets transfer into the recipient's vault. A **nullifier** is recorded to prevent the same note from being consumed again (see [note design](/reference/protocol/note)).

This separation is what enables privacy and parallelism — the two transactions are independent and unlinkable from the network's perspective.

## Public vs. private notes

Notes come in two visibility modes:

| Mode | Description |
|------|-------------|
| **Public** | The note's full data (assets, script, storage) is stored by the Miden network and visible onchain. Anyone can discover and attempt to consume it. |
| **Private** | Only a commitment (hash) is stored onchain. The actual note data must be communicated offchain between sender and recipient. |

Private notes provide stronger privacy guarantees — the network can't even see what assets a note carries — but they require the sender and recipient to have a communication channel outside the protocol.

Miden provides built-in note patterns (P2ID, P2IDE, SWAP) for common transfer scenarios — see [Standard Note Types](./note-types). You can also write fully custom note scripts for arbitrary consumption logic.

## How notes differ from EVM transfers

| | EVM | Miden |
|---|---|---|
| **Transfer model** | Single `transfer()` call on a token contract | Two transactions: create note, then consume note |
| **Privacy** | Sender, recipient, and amount are public | Transactions are unlinkable; private notes hide all data |
| **Programmability** | Token contracts control transfer logic | Each note carries its own script with custom conditions |
| **Failure** | Revert onchain, gas consumed | Proof can't be generated — no onchain trace |
| **Parallelism** | Transfers contend for contract state | Notes are independent — unlimited parallel creation |
