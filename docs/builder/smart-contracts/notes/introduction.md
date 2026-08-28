---
title: "What are Notes?"
sidebar_position: 0
description: "Miden's cross-account communication mechanism — programmable UTXOs that carry assets, execute scripts, and trigger logic on consuming accounts."
---

# What are Notes?

Notes are Miden's primary mechanism for cross-account communication — they carry assets, execute programmable logic, and trigger state changes on the consuming account. Like UTXOs, notes are created and consumed atomically. Unlike Bitcoin's UTXOs, each Miden note carries an arbitrary executable script that runs when the note is consumed, enabling programmable conditions far beyond simple locking scripts.

While asset transfers are the most common use of notes, notes are how accounts communicate with one another in general: a note can trigger a counter increment, initiate a swap, delegate an operation, or carry arbitrary data to be acted on by the recipient's logic.

Assets never transfer directly between accounts. Instead, they always move through notes. With private notes, creation and consumption can be unlinkable to observers because the full note details are not published. Public notes expose those details.

## Anatomy of a note

Every note has four main parts:

| Part | Description |
|------|-------------|
| **Assets** | The fungible or non-fungible tokens the note carries. |
| **Recipient** | The serial number, script, and storage that define the conditions under which the note can be consumed. |
| **Metadata** | Sender ID, note type, note tag, and attachment headers and commitment. Metadata is always public. |
| **Attachments** | Optional public auxiliary data associated with the note. |

The **recipient** is not necessarily an account address. It is a Poseidon2 commitment to the note's serial number, script, and storage, which together define the conditions under which the note can be consumed:

```
recipient = hash(hash(hash(serial_num, [0;4]), script_root), storage_commitment)
```

To consume the note, a transaction must provide the values that open this commitment and execute the script successfully. See [Computing a Recipient](./output-notes#computing-a-recipient) for the protocol helpers.

## The two-transaction model

Unlike Ethereum where a transfer is a single atomic call, Miden transfers happen across two separate transactions:

```
Transaction 1 (Sender)                Transaction 2 (Consumer)
┌─────────────────────────┐            ┌─────────────────────────┐
│ 1. Create note           │            │ 1. Discover note         │
│ 2. Attach assets         │            │ 2. Consume note          │
│ 3. Note published        │──────────▶│ 3. Script runs           │
│    (details/commitment)  │            │ 4. Assets move to vault  │
│                          │            │ 5. Note nullified        │
└─────────────────────────┘            └─────────────────────────┘
```

**Transaction 1**: The sender's account creates an output note, attaches assets to it, and publishes the note's public representation.

**Transaction 2**: A consuming account discovers the note and consumes it in its own transaction. The note script runs, its conditions must succeed, and any assets handled by the script can be added to the consumer's vault. A **nullifier** is recorded to prevent the same note from being consumed again (see [note design](/reference/protocol/note)).

This separation lets notes be processed independently and allows private-note creation and consumption to remain unlinkable to observers who do not know the note details.

## Public vs. private notes

Notes come in two visibility modes:

| Mode | Description |
|------|-------------|
| **Public** | Metadata, attachments, and full note details (assets, serial number, script, and storage) are published. Anyone can discover and attempt to consume the note. |
| **Private** | Metadata and attachments remain public, but only a commitment to the note details is published. The consumer must obtain the full details separately, for example through a private channel or an encrypted public attachment. |

Miden provides built-in note patterns (P2ID, P2IDE, SWAP) for common transfer scenarios — see [Standard Note Types](./note-types). You can also write fully custom note scripts for arbitrary consumption logic.

## How notes differ from EVM transfers

| | EVM | Miden |
|---|---|---|
| **Transfer model** | Single `transfer()` call on a token contract | Two transactions: create note, then consume note |
| **Privacy** | Sender, recipient, and amount are public | Private notes can hide their details and unlink creation from consumption; metadata and attachments remain public |
| **Programmability** | Token contracts control transfer logic | Each note carries its own script with custom conditions |
| **Failure** | Revert onchain, gas consumed | Proof can't be generated — no onchain trace |
| **Parallelism** | Transfers contend for contract state | Notes can be created and consumed independently |
