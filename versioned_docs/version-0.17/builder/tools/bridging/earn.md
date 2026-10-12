---
title: "Earn integration boundaries"
description: "Understand Bread's Epoch lending flow, position ownership, and withdrawal delivery."
---

# Earn integration boundaries

Bread's Earn flow uses Epoch intents to coordinate a lending interaction on an EVM-side configured market. Miden supplies collateral through a recallable P2IDE note; a solver fulfills the market interaction. This is not evidence of a lending contract executing natively on Miden or of a guaranteed return.

Start with [Epoch on Miden](./epoch.md) for the existing bridge, quote/solve, P2IDE collateral and note-recovery integration. This page describes the additional position and lifecycle boundaries visible in the public wallet implementation; it supplies no new provider API contract.

:::warning Configured integration
Use the market and asset configuration supported by the current provider deployment. Public wallet code and test markets do not establish production market availability, a particular lending protocol, a fixed yield, or a zero-fee route.
:::

## Confirm the route before exposing Earn

Treat each market as a specific source network, collateral faucet, destination chain, market and EVM owner combination. Confirm the provider-supported vault roster and accepted Miden collateral with the route owner, then verify a deposit and return withdrawal on the intended deployment. An Ethereum route's readiness does not establish support on another chain, and a partner coordination group or visible market entry does not establish activation, liquidity or capacity.

## Deposit into a market

The wallet's Earn code constructs `TaskType.ProtocolInteraction` data with the market UID, a deposit action, the market's underlying asset, and a nonzero protocol hash identifier. The Miden source account supplies the configured collateral faucet and an amount in that faucet's base units.

The workflow has distinct completion boundaries:

1. Obtain a provider quote for the actual market, source collateral and intended owner.
2. Authorize and submit the Miden P2IDE collateral note through the supported wallet flow.
3. Track provider acceptance and the solver's destination-market interaction.
4. Read the resulting position for its actual EVM owner, market and chain.

A quote, collateral-note submission, or provider acceptance alone is not proof of a completed position. When a collateral note is recallable, reclaim timing derives from the actual note/request parameters. A precomputed witness estimate is not permission to replace the note's enforced conditions with a wall-clock timer.

The deposit implementation can use a read-only provider SDK with a typed EVM owner address; it does not require a connected external EVM wallet for that deposit construction. The address nevertheless identifies who owns the resulting EVM position. It is not interchangeable with the Miden account ID.

## Read positions with the correct units

Bread collects EVM owner addresses from its Earn deposit rows and queries the configured positions service for those owners. An account may have used more than one owner address; the wallet does not assume a single universal “my EVM address”.

The reviewed positions reader treats `deposits` and `withdrawable` as human-decimal strings returned by that service. It does not multiply them by token decimals again. This differs from Miden collateral amounts, which are expressed in faucet base units.

Position data belongs to the configured chain, market and owner. A visible position or APR value is not proof that a particular withdrawal route is currently supported or that the rate will remain fixed.

## Withdraw and return funds to Miden

Bread's supported gasless-withdrawal implementation prepares an EVM-side redemption and tracks delivery back to a specific Miden recipient and faucet. “Gasless” describes the route's transaction-submission arrangement; it does not establish the absence of provider, route, or protocol fees.

| Boundary | What it establishes |
| --- | --- |
| Prepared withdrawal | A particular execution identity and payload are ready. Nothing has necessarily been submitted. |
| Redemption/acceptance | The EVM-side withdrawal is being executed or accepted under that identity. |
| Delivery | The provider is fulfilling the Miden destination leg. |
| Received note | The destination note has been located; consumption and wallet sync are still separate steps. |
| Spendable balance | The destination account has consumed the correct note and reconciled its vault. |

The wallet binds prepared recovery/retry work to the source chain, EVM owner, market, recipient, destination faucet and request identity. It refuses to treat a restored backup withdrawal row as verified executable work merely because that row exists. A timeout or reload should resume/reconcile the existing operation before creating another redemption.

## Fees, privacy and failure boundaries

Keep the market collateral asset separate from the network's fee asset. Creating or consuming Miden notes requires the applicable Miden fee balance; provider route terms and EVM-side charges require separate inspection.

Review the current quote and expected net amounts. Do not hard-code a fee percentage from a wallet issue, or label Earn fee-free because the UI does not itemize a charge.

The destination chain and lending provider receive the data needed for their leg, including position-owner and market information. Miden private collateral does not make the complete cross-chain interaction invisible to every provider.

If market configuration is unavailable, the position owner is wrong, or the provider cannot fulfill the route, stop before creating new collateral or redemption work. Use the provider's supported status/recovery operations and the existing Epoch note-recovery guide. Neither solver availability nor recovery after collateral consumption should be inferred from the presence of a P2IDE note alone.

## Implementation references

- [Bread Earn deposit](https://github.com/0xMiden/wallet/blob/main/src/lib/epoch/earn.ts).
- [Position reader and unit conventions](https://github.com/0xMiden/wallet/blob/main/src/lib/epoch/positions.ts).
- [Withdrawal tracking](https://github.com/0xMiden/wallet/blob/main/src/lib/epoch/earn-withdraw.ts) and [prepared-work verification](https://github.com/0xMiden/wallet/blob/main/src/lib/epoch/earn-withdraw-policy.ts).
