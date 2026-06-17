---
title: "Standard Note Types"
sidebar_position: 3
description: "Built-in note types from miden-standards: P2ID, P2IDE (with expiration), and SWAP (atomic exchange)."
---

# Standard Note Types

The `miden-standards` crate provides built-in note patterns for common asset transfer scenarios. These are pre-compiled note scripts you can use directly via the builder API in client code.

## P2ID (Pay to ID)

The most common pattern — a note that can only be consumed by a specific account. The note script checks that the consuming account's ID matches the target, then transfers all assets.

### When to use

Use P2ID for standard asset transfers where only the intended recipient should be able to consume the note. This is the most common note type.

:::info
P2ID notes use `P2idNote::create` from the `miden-standards` crate (`miden_standards::note::P2idNote`). The script is pre-compiled MASM — use the builder API to create P2ID notes in client code.
:::

### How it works

1. Creator creates a P2ID note containing the assets and the target account ID as a note storage item
2. Consumer's transaction processes the note — the script verifies the consuming account's ID matches the target
3. If the IDs match, all assets transfer to the consuming account; otherwise proof generation fails

### Note storage

| Item | Type | Description |
|------|------|-------------|
| `target_account_id` | `AccountId` | The account allowed to consume this note |

### Builder API

```rust
use miden_standards::note::P2idNote;

P2idNote::create(
    sender,       // AccountId: who sends the note
    target,       // AccountId: the only account that can consume this note
    assets,       // Vec<Asset>: assets to attach
    note_type,    // NoteType: Public or Private
    attachment,   // NoteAttachment: auxiliary data
    rng,          // &mut impl FeltRng
) -> Result<Note, NoteError>
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sender` | `AccountId` | Account sending the note |
| `target` | `AccountId` | The only account that can consume this note |
| `assets` | `Vec<Asset>` | Assets to attach to the note |
| `note_type` | `NoteType` | `Public` or `Private` |
| `attachment` | `NoteAttachment` | Auxiliary data for the note |
| `rng` | `&mut impl FeltRng` | Random number generator |

## P2IDE (Pay to ID with Expiration)

P2IDE extends P2ID with a timelock and a reclaim window. The note can't be consumed before `timelock_height`, and if the target hasn't consumed it by `reclaim_height`, the creator can reclaim the assets.

### When to use

Use P2IDE when the sender wants the option to reclaim assets if the recipient doesn't consume the note within a time window.

:::info
P2IDE notes use `P2ideNote::create` from the `miden-standards` crate (`miden_standards::note::P2ideNote`). The script is pre-compiled MASM — use the builder API to create P2IDE notes in client code.
:::

### How it works

1. Creator creates a P2IDE note with the target account ID, a timelock height, and a reclaim height as note storage items
2. **Target consumes after `timelock_height`** — assets transfer to the target account
3. **Creator reclaims after `reclaim_height`** — assets return to the creator
4. **Before timelock or between timelock and reclaim by a non-target** — any consumption attempt fails (proof generation fails)

### Note storage

| Item | Type | Description |
|------|------|-------------|
| `target_account_id_prefix` | `Felt` | Target account ID prefix |
| `target_account_id_suffix` | `Felt` | Target account ID suffix |
| `reclaim_height` | `Felt` | Block height after which the creator can reclaim |
| `timelock_height` | `Felt` | Block height before which the note can't be consumed |

### Builder API

```rust
use miden_standards::note::{P2ideNote, P2ideNoteStorage};

P2ideNote::create(
    sender,                                               // AccountId: who sends the note
    P2ideNoteStorage::new(target, reclaim_height, timelock_height),
    assets,                                               // Vec<Asset>: assets to attach
    note_type,                                            // NoteType: Public or Private
    attachment,                                           // NoteAttachment: auxiliary data
    rng,                                                  // &mut impl FeltRng
) -> Result<Note, NoteError>
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sender` | `AccountId` | Account sending the note |
| `target` | `AccountId` | The only account that can consume this note (set on `P2ideNoteStorage`) |
| `reclaim_height` | `Option<BlockNumber>` | Block height after which sender can reclaim; `None` = no reclaim (set on `P2ideNoteStorage`) |
| `timelock_height` | `Option<BlockNumber>` | Block height before which note can't be consumed; `None` = no timelock (set on `P2ideNoteStorage`) |
| `assets` | `Vec<Asset>` | Assets to attach to the note |
| `note_type` | `NoteType` | `Public` or `Private` |
| `attachment` | `NoteAttachment` | Auxiliary data for the note |
| `rng` | `&mut impl FeltRng` | Random number generator |

## SWAP (Atomic Exchange)

SWAP enables atomic asset exchange. The creator offers one asset; any consumer who provides the requested asset in return can consume the note. The swap is atomic — both sides happen in a single transaction or neither does.

### When to use

Use SWAP for trustless atomic exchanges where two parties trade assets without intermediaries.

:::info
SWAP notes use `SwapNote::create` from the `miden-standards` crate (`miden_standards::note::SwapNote`). The script is pre-compiled MASM — use the builder API to create SWAP notes in client code.
:::

### How it works

1. Creator creates a SWAP note containing the offered asset and metadata describing the requested asset + payback recipient
2. Consumer's transaction processes the note — the script creates a P2ID payback note targeted at the original creator containing the requested asset
3. Consumer receives the offered asset into their vault
4. Both transfers happen atomically in one transaction

### Builder API

```rust
use miden_standards::note::SwapNote;

SwapNote::create(
    sender,
    offered_asset,
    requested_asset,
    swap_note_type,
    swap_note_attachment,
    payback_note_type,
    payback_note_attachment,
    rng,
) -> Result<(Note, NoteDetails), NoteError>
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sender` | `AccountId` | Account that receives the payback P2ID note |
| `offered_asset` | `Asset` | Asset the note carries (what the consumer receives) |
| `requested_asset` | `Asset` | Asset the consumer must provide in return |
| `swap_note_type` | `NoteType` | `Public` or `Private` for the SWAP note |
| `swap_note_attachment` | `NoteAttachment` | Auxiliary data for the SWAP note |
| `payback_note_type` | `NoteType` | `Public` or `Private` for the P2ID payback note |
| `payback_note_attachment` | `NoteAttachment` | Auxiliary data for the payback note |
| `rng` | `&mut impl FeltRng` | Random number generator |

Returns a tuple of `(Note, NoteDetails)` — the SWAP note to submit and the expected payback note details (for tracking).

`NoteAttachment` is defined in the `miden-standards` crate (not the core `miden` SDK). It wraps the attachment data that gets set on output notes — see [note attachments](./output-notes#note-attachments) for the underlying SDK API.

## More note types

For writing custom note scripts, see [Note Scripts](./note-scripts). For the transaction context and `#[tx_script]`, see [Transaction Context](../transactions/transaction-context).
