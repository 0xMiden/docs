---
title: "Partial-swap lifecycle"
description: "Track PSWAP creation, partial fills, payback notes, remainders, and wallet-driven reclaim."
---

# Partial-swap lifecycle

Miden's standard PSWAP note offers a fungible asset in exchange for another and permits partial fills. The exchange conditions are enforced by the note script. A solver or other eligible consumer fills the note; a fill produces a payback note for the creator and, when necessary, a remainder PSWAP for the unfilled offer.

Start with [Standard notes](./standard-notes.md) for the standard scripts and account-component requirements, and [Notes](../notes/introduction.md) for the note model. This page explains how an application tracks the lifecycle. It does not define an external quoting or matching API.

## Track the order separately from its transactions

| Stage | Protocol event | Application responsibility |
| --- | --- | --- |
| Prepare | A request constructs the original PSWAP. | Validate the offered/requested faucets and amounts, and use compatible SDK request encodings. |
| Place | The creator moves the offered asset into the output note. | Track submission and inclusion. A queued request is not yet an available order. |
| Fill | A consumer executes the PSWAP script and supplies the requested asset under its conditions. | Track the original order's lineage, not only its first note ID. |
| Partial fill | A payback and a remainder note are created. | Associate both outputs with the order and continue observing the remainder. |
| Receive | The creator consumes its payback note. | Distinguish delivered notes from spendable vault balances. |
| Reclaim | The creator consumes a still-available original or remainder note through the script's creator path. | Confirm which note remains available and reconcile a concurrent fill. |

The protocol implementation carries an order identifier and depth in PSWAP lineage attachments. Each fill advances the lineage. A new remainder's serial number and note ID differ from the original, so stopping observation at the original note's nullifier can miss later fills or the remaining offer.

The note's script controls valid fill amounts and pricing. Its implementation supports a minimum fill step, with a floor adjusted so a small remainder can still be filled in full. Use the current SDK/protocol implementation for exact amount and rounding rules; do not substitute floating-point display prices for note conditions.

## Settlement is another note-consumption step

A solver creating a payback note does not put the asset directly into the creator's vault. The creator must discover and consume that note. Show at least three separate concepts in your application: placed offer, filled amount, and received spendable balance.

Partial fills can leave both received paybacks and an open remainder. Do not label the whole order “refunded” because the remaining offer was reclaimed, or “received” because a solver's fill transaction exists. Preserve the amounts already exchanged and the amounts still open separately.

Every executing account needs the network's fee asset for its own transactions. Payback consumption and reclaim may incur additional Miden fees. See [Transaction fees](../transactions/fees.md).

## Bread expiry and cancellation

Bread's duration picker is a wallet policy. Its `expirySeconds` value does not become a protocol wall-clock deadline. On completion, the wallet records an expiry in local order metadata; settlement uses that metadata to decide when to attempt reclaim.

In the reviewed wallet implementation, “cancel” brings that local expiry forward to the current time. The settlement loop then attempts to consume the available offer or remainder. This is not an immediate onchain cancellation RPC, and a solver can fill the note before reclaim succeeds.

Bread refuses this automatic cancellation path for a restored backup row, an order configured for manual settlement, or a placement that has not completed and has no order ID. Those conditions are wallet behavior, not restrictions on every possible PSWAP client.

When an expired order has both paybacks and a reclaimable offer, Bread queues payback consumption separately from reclaim. A fill/reclaim race can invalidate the remaining offer note; combining it with paybacks in one atomic transaction would also fail the payback claim. Applications implementing settlement should preserve the same distinction.

Automatic settlement is paused for accounts with a pending Guardian rotation. A missing local settlement stamp alone is not proof that a transaction did not happen; reconcile notes and existing consume transactions before creating another request.

## Asset identity and execution venue

PSWAP executes within Miden transactions using the standard note script. The script enforces the exchange; external solvers can discover and fill offers. This does not establish a centralized orderbook, a particular solver's availability, or a guaranteed completion time.

Identify both assets by network and issuing faucet. Bread's test swap registry includes assets displayed with ETH/BTC-related names or prices; that presentation alone does not prove canonical backing, a bridge route, or redeemability for the corresponding external asset.

For the existing wallet-as-signer setup, see [External signers](../../tools/clients/react-sdk/signers.md). A new wallet Quote API requires its own public contract; this page supplies no speculative quote endpoint, payload, fee schedule, or solver SLA.

## Confirm solver readiness separately

Before advertising a route, confirm the solver owner, supported faucet pair, available liquidity and actual fill/claim evidence on the intended network. App registration and protocol support alone do not establish an activated Pioneer route. Keep route readiness separate from the protocol lifecycle documented here.

## Integration checks

- Observe one full fill and multiple partial fills, including a final small remainder.
- Verify that each payback belongs to the original order and intended creator.
- Show the remainder and received amount independently until note consumption confirms the vault result.
- Exercise the race between solver fill and creator reclaim without automatically placing another order.
- Preserve order identity across an interrupted placement; serialized retries must not create a second offer unintentionally.
- Treat backup restoration and absent local expiry metadata explicitly rather than fabricating cancellation history.

See [the 0.17 migration guide](../../migration/index.md) before reusing serialized requests, note artifacts, or PSWAP outputs across releases.

## Implementation references

- [Protocol PSWAP type and helpers](https://github.com/0xMiden/protocol/blob/next/crates/miden-standards/src/note/pswap.rs).
- [Protocol PSWAP script](https://github.com/0xMiden/protocol/blob/next/crates/miden-standards/asm/standards/notes/pswap.masm).
- [Bread settlement](https://github.com/0xMiden/wallet/blob/main/src/lib/miden/swap/settlement.ts) and [wallet cancellation](https://github.com/0xMiden/wallet/blob/main/src/lib/miden/swap/cancel-order.ts).
