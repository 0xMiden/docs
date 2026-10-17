---
sidebar_position: 7
title: "Learning, NFTs and other utilities"
description: "Build a focused learning, NFT or non-financial utility experience and register it in Others."
---

# Learning, NFTs and other utilities

Use `category: "others"` for learning content, NFTs and non-financial utilities. Financial helpers belong in [Finance](./finance.md), and games belong in [Arcade](./arcade.md). Choose the app's actual purpose; All is an aggregate view, never a category to publish.

Use the [same project setup](./setup.md), [provider integration](./bread-wallet-integration.md), [testing](./testing-and-troubleshooting.md) and [registration workflow](./publishing-and-explore.md). Others does not have a separate SDK or submission API.

## Give a newcomer a complete task

A short learning exercise or useful public-data tool can show its value before asking for wallet access. Explain any required account, network or asset early. Let a visitor finish the useful task without unrelated connection, private-data or payment requests.

| App behavior | Evidence to provide |
| --- | --- |
| Learning | A clear learning outcome, understandable completion and refusal/restart paths. Completing a tutorial does not prove a wallet is backed up or secured. |
| Public-data utility | Data source, network, freshness and understandable unavailable/stale states. Public data access does not imply wallet connection. |
| Private-data utility | Minimum supported read capability, permission refusal, account-switch clearing and storage/deletion behavior. A prior connection does not grant every private category. |
| NFT action | Collection/issuer and network, ownership assumptions, supported mint/transfer/consume operation, fees, finality and recovery. A catalog category does not supply an NFT contract or name service. |

Any operation that signs or transacts follows the [shared request lifecycle](./building.md#model-the-request-lifecycle), including reconciliation after interruption. Do not ask for recovery words or private keys to complete a lesson, verify ownership or debug an app.

Share only deliberately selected results, with a disclosure preview. Private balances, notes, account identifiers and wallet activity need their own access/publication decisions. A locally completed lesson or exported card is not automatically an issued badge, referral credit or public post.

## Test and register

Test the core task, missing provider, declined access, unsupported methods, account/network changes, stale data and interrupted work on each advertised build. Use [fullscreen](./bread-wallet-integration.md#optional-native-fullscreen) only where it helps the task, and retain a responsive layout without the native API.

Register the reviewed deployment in wallet-config's `explore/<network>.json` using `others`, add its section placement and bump the document version. Follow the shared validator and review process. Catalog validation does not verify the lesson, data source, ownership claim or contract; keep that evidence in the candidate record and registration PR.
