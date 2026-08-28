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
P2ID notes use the typed `P2idNote` builder from `miden_standards::note`. The script is pre-compiled MASM; build the typed note and convert it into a protocol `Note` with `.into()`.
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
use miden_protocol::note::Note;
use miden_standards::note::P2idNote;

let note: Note = P2idNote::builder()
    .sender(sender)
    .target(target)
    .assets(assets)
    .note_type(note_type)
    .generate_serial_number(rng)
    .build()?
    .into();
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sender` | `AccountId` | Account sending the note |
| `target` | `AccountId` | The only account that can consume this note |
| `assets` | `Vec<Asset>` | Assets to attach to the note |
| `note_type` | `NoteType` | `Public` or `Private` |
| `attachment` / `attachments` | `NoteAttachment` / iterator | Optional auxiliary data |
| `generate_serial_number` | `&mut impl FeltRng` | Generates the required serial number |

## P2IDE (Pay to ID with Expiration)

P2IDE extends P2ID with optional timelock and reclaim conditions. A configured timelock prevents any account from consuming the note before the specified height. If reclaim is enabled, the configured reclaimer can also consume the note once `reclaim_height` has been reached and any configured timelock has expired; the target remains authorized.

### When to use

Use P2IDE when the sender wants the option to reclaim assets if the recipient doesn't consume the note within a time window.

:::info
P2IDE notes use the typed `P2ideNote` builder from `miden_standards::note`. Its reclaimer and block-height constraints are optional builder fields.
:::

### How it works

1. The sender creates a P2IDE note with the target account ID and optional timelock, reclaim height, and reclaimer
2. If a timelock is configured, no account can consume the note before it expires
3. The target can consume the note once the timelock condition is satisfied
4. If reclaim is enabled, the reclaimer can also consume the note once `reclaim_height` has been reached and any configured timelock has expired; the sender is the default reclaimer
5. All other consumption attempts fail (proof generation fails)

### Note storage

| Item | Type | Description |
|------|------|-------------|
| `reclaimer` | `AccountId` | Account allowed to reclaim; defaults to the sender |
| `target` | `AccountId` | Account allowed to receive the note |
| `reclaim_height` | `Option<BlockNumber>` | Block height after which the reclaimer can consume the note, subject to the timelock |
| `timelock_height` | `Option<BlockNumber>` | Block height before which no account can consume the note |

### Builder API

```rust
use miden_protocol::note::Note;
use miden_standards::note::P2ideNote;

let note: Note = P2ideNote::builder()
    .sender(sender)
    .target(target)
    .reclaimer(reclaimer)
    .reclaim_height(reclaim_height)
    .timelock_height(timelock_height)
    .assets(assets)
    .note_type(note_type)
    .generate_serial_number(rng)
    .build()?
    .into();
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sender` | `AccountId` | Account sending the note |
| `target` | `AccountId` | The account that can receive the note |
| `reclaimer` | `AccountId` | Optional reclaiming account; defaults to `sender` |
| `reclaim_height` | `BlockNumber` | Optional block height after which the reclaimer can consume the note, subject to the timelock |
| `timelock_height` | `BlockNumber` | Optional block height before which no account can consume the note |
| `assets` | `Vec<Asset>` | Assets to attach to the note |
| `note_type` | `NoteType` | `Public` or `Private` |
| `attachment` / `attachments` | `NoteAttachment` / iterator | Optional auxiliary data |
| `generate_serial_number` | `&mut impl FeltRng` | Generates the required serial number |

## SWAP (Atomic Exchange)

SWAP enables atomic asset exchange. The creator offers one asset; any consumer who provides the requested asset in return can consume the note. The swap is atomic — both sides happen in a single transaction or neither does.

### When to use

Use SWAP for trustless atomic exchanges where two parties trade assets without intermediaries.

:::info
SWAP notes use the typed `SwapNote` builder from `miden_standards::note`. Read the expected payback details from the typed value before converting it into a protocol `Note`.
:::

### How it works

1. The creator creates a SWAP note containing the offered asset and storage describing the requested asset and payback configuration
2. The consumer's transaction moves the requested asset from their vault into a P2ID payback note targeted at the creator
3. The transaction moves the offered asset from the SWAP note into the consumer's vault
4. The payback note creation and offered asset transfer happen atomically in the same transaction

### Builder API

```rust
use miden_protocol::note::Note;
use miden_standards::note::SwapNote;

let swap = SwapNote::builder()
    .sender(sender)
    .offered_asset(offered_asset)
    .requested_asset(requested_asset)
    .note_type(swap_note_type)
    .payback_note_type(payback_note_type)
    .generate_serial_number(rng)
    .build()?;

let payback_note_details = swap.payback_note_details();
let note: Note = swap.into();
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `sender` | `AccountId` | Account that receives the payback P2ID note |
| `offered_asset` | `Asset` | Asset the note carries (what the consumer receives) |
| `requested_asset` | `Asset` | Asset the consumer must provide in return |
| `swap_note_type` | `NoteType` | `Public` or `Private` for the SWAP note |
| `attachment` / `attachments` | `NoteAttachment` / iterator | Optional auxiliary data for the SWAP note |
| `payback_note_type` | `NoteType` | `Public` or `Private` for the P2ID payback note |
| `generate_serial_number` | `&mut impl FeltRng` | Generates the required serial number |

The builder returns a typed `SwapNote`. Call `payback_note_details()` before converting it into the `Note` to submit.

Attachments are optional. Use `.attachment(value)` or `.attachments(values)` only when needed; see [note attachments](./output-notes#note-attachments) for the underlying SDK API.

## More note types

For PSWAP, MINT, BURN, and other standard notes, see [Standard Notes](../standards/standard-notes). For writing custom note scripts, see [Note Scripts](./note-scripts). For the transaction context and `#[tx_script]`, see [Transaction Context](../transactions/transaction-context).
