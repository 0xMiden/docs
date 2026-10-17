---
sidebar_position: 6
title: "Finance apps and utilities"
description: "Build a useful financial flow with explicit assets, approvals, settlement and recovery, then register it in Finance."
---

# Finance apps and utilities

Use `category: "finance"` for a financial app or financial utility, including a faucet or financial helper. The category describes discovery; it grants no funds, Mainnet admission, route activation or transaction authority. Declare `isExchange` accurately because existing wallet/platform exchange gates still apply.

Start with the [shared setup](./setup.md), [execution boundary](./building.md) and [Bread integration](./bread-wallet-integration.md). Choose one useful task and state what completing it means. A preview or explanation can help newcomers understand the task before granting access; an actual financial action still requires its normal wallet review.

## Define the financial operation

| Requirement | What to record |
| --- | --- |
| Network and asset | Supported deployment, issuing faucet/account identity and decimals. A display symbol does not establish asset identity or backing. |
| Route and dependencies | Exact provider/API and supported route, contract versions and operational owner. A healthy endpoint or quote alone does not establish an executable route. |
| User review | Sender/account, destination, asset, amount, fees and expected effects before requesting authorization. |
| Completion | Wallet acceptance, transaction result, chain inclusion and receiving/settlement state as separate stages. |
| Recovery | Request journal, timeout/reload reconciliation, expiry and applicable claim/reclaim/refund paths. |
| Data access | Minimum private-data categories, why they are needed, storage/retention and any separate public disclosure. |

Prefer supported wallet-managed operations when they cover the task. Use compatible custom request envelopes or an app-owned client only when the workflow needs them. Validate exact base units and integer bounds; keep the original account, network and request parameters attached to accepted or uncertain work.

For a send, a sender result is not a spendable recipient balance. The recipient must discover and consume the output note. For other routes, document the actual completion and recovery contract; do not label quote acceptance, request acceptance or provider health as settlement.

## Test the complete result

Verify correct and incorrect network/asset context, fee/funding failures, declined approvals, repeated taps, account changes, timeouts and reloads. Reconcile existing work before another submission. If a route disables new activity, confirm its documented recovery path for existing activity separately.

Use supported disposable development accounts for authorized execution tests and record the exact wallet build, app deployment and network. Mock-provider checks and the catalog browser harness do not establish real asset balances, provider execution or settlement. Keep unavailable routes clearly unavailable.

Financial apps can use [optional native fullscreen](./bread-wallet-integration.md#optional-native-fullscreen), with readable transaction context, accessible Back to Bread and a usable ordinary-browser layout. Avoid unnecessary transactions or balance/volume-based incentives as an onboarding step.

## Register in Finance

Follow [wallet-config registration](./publishing-and-explore.md): update the intended `explore/<network>.json`, use `finance`, supply literal localized text, the reviewed HTTPS URL and accurate exchange classification, then bump and validate the catalog version. Link app-specific route, settlement and recovery evidence in the registration PR.

Merge and a matching reader release make the catalog eligible to appear; verify the actual listing and launch on each claimed build/network. Listing does not approve a financial route or enroll the app in Arcade GC, ranking or reward systems.
