---
sidebar_position: 3
title: "Build a mini-app"
description: "Define a small transaction flow with explicit ownership, validated units and resumable outcomes."
---

# Build a mini-app

Start with one operation whose state you can explain from beginning to end. A wallet-managed public send is a useful first integration because Bread owns the account, signing and submission while the app owns request parameters and result presentation. Use the checked [Bread integration recipe](./bread-wallet-integration.md) before adding custom serialization or a second client.

## Keep responsibilities visible

| Layer | Responsibilities |
| --- | --- |
| Application | Hosted UI, input validation, request context, permission intent and persisted request journal. |
| Wallet adapter | Typed connection and supported requests to the injected provider; no private keys or chain database. |
| Bread | Unlock/confirmation, supported account authorization, wallet policy, transaction execution and wallet results. |
| Network/provider | Inclusion, note availability, recipient consumption and any separately supported cross-chain/market route. |

A mini-app's declared token summary cannot replace the effects of the actual transaction request. Validate the network and issuing faucet, use its decimals for display conversion and keep adapter amounts as positive safe-integer base units. A display symbol alone does not identify an asset or prove its backing.

## Model the request lifecycle

Represent at least connection, wallet approval, request acceptance, wallet result, chain confirmation and recipient-note state where relevant. Preserve the accepted request ID separately from the later transaction result's `txHash`. For a send, the recipient must discover and consume the output note before its value is spendable in that account's vault.

Record the sender, network, request parameters and identifiers before allowing retries after a timeout or reload. If submission is uncertain, reconcile the existing operation first. Changing accounts or networks must not retarget pending work; keep its original context even when clearing account-specific read caches.

A wallet refusal, missing capability, valuation failure and an accepted-but-unresolved request require different messages. Let the wallet own its approval and spending-policy flows; a prior connection or signature is not approval for a new transaction.

## Add custom contracts only when needed

Use [standard notes](../smart-contracts/standards/standard-notes.md) for existing transfers and swaps before inventing another note interface. Custom accounts and notes need the matching SDK/compiler, authenticated state and fee behavior. Rebuild serialized artifacts for the intended release and check the [migration guide](../migration/index.md).

The existing frontend counter is an app-owned-client example. Its public `NoAuth` counter does not establish a general permission model for another application, and its demo funding code is not a production funding contract. Keep client creation and private state out of a wallet-managed send app unless your chosen execution boundary requires them.

## Extend through supported surfaces

For custom wallet execution, the guide shows a `Transaction` envelope that serializes a compatible `TransactionRequest`; do not send a bare payload or reuse incompatible request bytes. For app-owned SDK workflows with wallet signing, use [external signers](../tools/clients/react-sdk/signers.md) and account for your client's required state/notes.

Probe the deployed provider's optional methods. A declared `createAccount` interface is not evidence that Bread implements it. There is no mini-app-specific listing or Quote API established by the wallet connection surface. Choose public documented contracts for each additional service and test their complete flow before exposing it.
