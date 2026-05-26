---
title: "Standard Notes"
description: "Use standard Miden note scripts for transfers, expiring transfers, swaps, minting, and burning."
---

# Standard Notes

Standard notes are prebuilt note scripts from `miden-standards`. They cover the common asset flows builders need before writing custom note scripts.

Use the Rust APIs to construct standard notes in client or transaction-building code. The scripts themselves are MASM modules, so direct MASM authors can inspect or import the same standard scripts when they need exact procedure behavior.

## Which note should I use?

| Note | Use it when | Rust type | MASM module |
|------|-------------|-----------|-------------|
| P2ID | You are sending assets to a specific account ID. | `P2idNote` | `miden::standards::notes::p2id` |
| P2IDE | You are sending to a specific account ID with a timelock and/or reclaim path. | `P2ideNote` | `miden::standards::notes::p2ide` |
| SWAP | You are offering one asset and requiring a specific asset in return. | `SwapNote` | `miden::standards::notes::swap` |
| PSWAP | You need a partially fillable swap note. | `PswapNote` | `miden::standards::notes::pswap` |
| MINT | A faucet is minting fungible tokens into a note. | `MintNote` | `miden::standards::notes::mint` |
| BURN | A faucet is burning fungible tokens returned through a note. | `BurnNote` | `miden::standards::notes::burn` |

For the note model itself, start with [What are Notes?](../notes/introduction). This page focuses on how the standards fit into builder workflows.

```rust title="Create a public P2ID note"
use miden_protocol::Word;
use miden_protocol::account::{AccountId, AccountIdVersion, AccountStorageMode, AccountType};
use miden_protocol::asset::{Asset, FungibleAsset};
use miden_protocol::crypto::rand::RandomCoin;
use miden_protocol::note::{NoteAttachments, NoteType};
use miden_standards::note::P2idNote;

fn dummy_account(byte: u8, account_type: AccountType) -> AccountId {
    let mut bytes = [0; 15];
    bytes[0] = byte;
    AccountId::dummy(
        bytes,
        AccountIdVersion::Version1,
        account_type,
        AccountStorageMode::Public,
    )
}

fn create_p2id_note() -> Result<(), Box<dyn std::error::Error>> {
    let sender = dummy_account(1, AccountType::RegularAccountImmutableCode);
    let target = dummy_account(2, AccountType::RegularAccountImmutableCode);
    let faucet_id = dummy_account(3, AccountType::FungibleFaucet);
    let asset: Asset = FungibleAsset::new(faucet_id, 100)?.into();
    let mut rng = RandomCoin::new(Word::from([1, 2, 3, 4u32]));

    let note = P2idNote::create(
        sender,
        target,
        vec![asset],
        NoteType::Public,
        NoteAttachments::default(),
        &mut rng,
    )?;

    assert_eq!(note.metadata().sender(), sender);
    Ok(())
}
```

:::info v0.14 differences
PSWAP is part of the current unstable standards surface, but it is not available in the v0.14 standards snapshot. Use the v0.14 versioned docs if you are building against the v0.14 crates.
:::

## Account requirements

Standard notes assume the consuming account exposes the procedures the note script calls.

| Note | Consuming account needs |
|------|-------------------------|
| P2ID / P2IDE | A wallet-compatible receive procedure, usually from `BasicWallet`. |
| SWAP / PSWAP | Wallet-compatible receive and asset-to-note procedures. |
| MINT | A compatible faucet/account flow for mint authorization and recipient delivery. |
| BURN | A compatible faucet burn procedure. |

If you write a custom wallet or faucet component, test it against the standard notes you expect it to consume.

## Attachments and execution hints

Standard notes can use attachments and execution hints to help clients and indexers route notes and decide when a note might be consumable.

| Helper | Use it for |
|--------|------------|
| `StandardNoteAttachment` | Standard attachment schemes for note metadata. |
| `NetworkAccountTarget` | Attaching network-account targeting data to notes. |
| `AccountTargetNetworkNote` | Wrapping notes known to target network accounts. |
| `NetworkNoteExt` | Convenience helpers for network-targeted notes. |
| `NoteExecutionHint` | Encoding when clients should attempt note execution. |

Execution hints do not replace note-script checks. The note script still enforces consumption rules during transaction execution.

## Rust and MASM entry points

Rust constructors are the usual way to create standard notes in client-side code. Direct MASM authors should use the standard note modules as the source of truth for stack effects and script behavior.

The Rust types live under `miden_standards::note`. The MASM scripts live under `miden::standards::notes::*`.

## Related pages

- [Standard Note Types](../notes/note-types) - more detail on P2ID, P2IDE, and SWAP
- [Output Notes](../notes/output-notes) - creating output notes from transactions
- [Note Scripts](../notes/note-scripts) - writing custom note scripts
- [`miden-standards` note source](https://github.com/0xMiden/protocol/tree/next/crates/miden-standards/src/note) - current implementation
