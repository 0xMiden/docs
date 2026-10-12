---
sidebar_position: 4
title: "Earn in Bread"
description: "Understand wallet lending positions, permissions, delivery and recovery before integrating Earn."
---

# Earn in Bread

Bread's Earn flow coordinates a provider-managed lending position on a configured EVM market. Miden supplies collateral through a recallable P2IDE note; a solver fulfills the market interaction. A quote or submitted collateral note is not a completed position, and an EVM redemption is not yet spendable funds in the Miden wallet.

For the provider-specific deposit, position-unit and return-withdrawal lifecycle, use [Earn in the Epoch guide](../bridging/epoch.md#earn-in-bread). Keep the selected market, chain, EVM position owner, Miden recipient and collateral faucet together when tracking a request. Do not infer production activation, liquidity, fixed yield or fee-free execution from a visible market entry or public code.

## Wallet authorization and spending assessment

Let Bread own its supported signing, Guardian and approval flow. A connected app session is not permission to collect keys or reuse recovery authorization for a different action. A wallet transaction result also does not establish provider completion or destination-note consumption.

The account's local [spending-limit policy](./spending-limits.md) can assess Earn deposits alongside other outgoing wallet actions. That policy is separate from provider route availability, position ownership and bridge capacity. A transaction-specific wallet approval cannot override a partner's capacity rule or turn an unsupported route into a supported one.

## Troubleshooting and recovery

After a timeout, reload or uncertain submission, retain the original identifiers and reconcile the existing collateral or redemption before creating another request. Confirm the original account/network, market, EVM owner, recipient and faucet; do not retarget pending work after an account or network change.

A received destination note still needs discovery, consumption and synchronization before its value is spendable. An imported backup row is not proof of executable withdrawal work. Key restoration, private-state recovery, retained notes and display history have different completeness limits; use the supported wallet/provider recovery flow and the matching release's [migration guidance](../../migration/index.md).

This page describes the integration boundary. Exact candidate-platform behavior, enabled vaults/collateral, quote and net-fee terms, actual deposit/return execution and provider recovery remain separate release and partner checks. Developer endpoint configuration or wallet admission alone does not enable Earn.
