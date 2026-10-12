---
title: "Bread spending limits"
description: "Understand Bread's local rolling USD policy and transaction-specific authorization boundary."
---

# Bread spending limits

Bread's spending-limit policy checks outgoing wallet transactions against an account-scoped USD limit over a rolling 24-hour window. It is a local wallet policy, not a protocol rule that every client must enforce or an onchain session-key contract.

For protocol-level application patterns, see [Smart-contract patterns](../../smart-contracts/patterns.md). For the existing wallet-as-signer setup, see [External signers](../clients/react-sdk/signers.md). This page covers the reviewed Bread policy rather than defining another wallet authorization API.

## Keep bridge capacity separate

A bridge's configured frontend admission/capacity rule and this account's local rolling spending policy answer different questions. Passing one does not establish that the other allows the route. Balance valuation, transfers already pending and enforcement across other devices or clients must be checked against the bridge's actual deployed configuration. A transaction-specific wallet approval does not override a bridge or partner's capacity rule.

## What the policy counts

The policy includes wallet send, swap, bridged-send, Earn-deposit and custom-execution rows that carry recorded USD spend. It counts matching account identities using canonicalized IDs and compares the proposed transaction with the remaining rolling-window allowance.

Queued, generating, completed, failed and unconfirmed rows can remain reserved. A local failure may occur after submission; automatically removing its reservation would assume the chain did not execute it. Reconciliation, rather than the application's optimistic error message, determines what happened.

Rows restored from a backup and historical rows without a USD spend stamp are excluded by the reviewed policy. That history behavior is one reason not to present the local limit as a universal cap on all spending by the account across devices and clients.

The limit also stops a proposed transaction that is too large by itself. This is the same rolling-window policy, not evidence of a separately configurable per-transaction cap. When earlier reservations expire, an estimated capacity time can change; an individually oversized proposal has no automatic wait-until time that makes it fit the unchanged limit.

## USD valuation has an identity boundary

Bread values eligible assets using their canonical faucet identity, known decimals and allowed price source. A symbol or logo alone does not authorize valuation. The native USDCx pricing path additionally checks the SDK-synchronized native faucet identity rather than accepting a provisional display label.

The policy is not complete mark-to-market coverage of every custom token. The reviewed valuation code can exclude an asset with no allowed price symbol, while unresolved identity, scale or required price data can produce a valuation-unavailable error. Do not translate every unpriced condition into “zero dollars”, or claim every token is covered.

For an application submitting a custom request, the wallet derives transaction effects for approval and spending assessment. A dApp's declared token/amount summary is not authority to replace the request's actual effects. Corrupt configuration or unreadable policy/history data can fail closed separately from a normal limit breach.

## User authorization is specific to the transaction

The wallet can obtain transaction-specific authorization for a breached USD assessment or a spend whose value cannot be established. The internal authorization binds account identity, exact faucet/amount spends, policy revision, expiry and a one-use identifier. The recorded dollar value is for display/audit; it is not the matching key when prices change.

That internal record is not a cryptographic authorization and is not a public capability token for a mini-app. Its purpose is to prevent stale, reused or mismatched approval at the trusted wallet boundary. Your app should use the wallet's normal confirmation flow rather than constructing or persisting these records itself.

A changed amount, account context or policy can require fresh assessment and wallet approval. A previous connection permission or opaque signature does not mean the spending policy has been satisfied for a new transaction.

## Handle outcomes in an application

- Keep “request rejected”, “valuation unavailable”, “limit authorization needed”, and “transaction submitted but unresolved” distinguishable.
- Let the wallet present and process its supported approval flow; do not relabel a one-time approval as disabling the account's limit permanently.
- Retain accepted request IDs and reconcile them after timeouts before creating another spend.
- Clear account-specific cached policy assumptions on account/network changes.
- Explain local coverage limitations if displaying the wallet's limit to users; other clients and incomplete/restored local history are outside this enforcement guarantee.

## Implementation references

- [Rolling policy](https://github.com/0xMiden/wallet/blob/main/src/lib/miden/spending-limits/policy.ts).
- [Valuation](https://github.com/0xMiden/wallet/blob/main/src/lib/miden/spending-limits/valuation.ts).
- [Queue enforcement](https://github.com/0xMiden/wallet/blob/main/src/lib/miden/spending-limits/queue.ts).
- [Authorization binding](https://github.com/0xMiden/wallet/blob/main/src/lib/miden/spending-limits/types.ts).
