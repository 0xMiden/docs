---
sidebar_position: 5
title: "Arcade games"
description: "Build a playable Bread game, keep its scores separate from shared ranking, and register it in Arcade."
---

# Arcade games

Use `category: "arcade"` for a game. Bread's native Arcade view supplies discovery, featured games and details; opening a game uses the catalog item's validated `url` through the existing dApp-browser path. Your hosted application owns gameplay, controls, session state and scores. It does not need a separate Arcade website or a new launcher SDK.

Start with the [shared setup](./setup.md) and [Bread integration](./bread-wallet-integration.md). The catalog and native UI are implemented in [wallet-config PR10](https://github.com/0xMiden/wallet-config/pull/10) and [wallet PR1512](https://github.com/0xMiden/wallet/pull/1512); follow their release gates before claiming availability.

## Make the first round clear

Choose one complete mobile-friendly round with an understandable goal, result and restart. A practice mode can give a newcomer something enjoyable before asking for a connection. If the game requires an account, NFT, asset or payment, disclose that requirement before entry; adding a practice mode does not remove an existing pilot's requirements.

Separate local scores, personal bests and server-validated results in the UI. State where each result persists and whether it becomes public. Use deliberate sharing with a preview of the disclosed data. A branded challenge link, install fallback or return route needs an implemented, tested owner and destination; catalog registration does not supply it.

## Keep scores, GC and challenges separate

| Feature | Integration boundary |
| --- | --- |
| Gameplay and game rankings | Owned by the game, with its own rules, verification and recovery. Raw scores across different games are not comparable. |
| Shared native ranking | Intended to use GC balance snapshots players voluntarily submit. Live balance reading and submission are unavailable in the current UI; real Submit stays disabled. |
| Record/shot challenges | Optional, separately reviewed game contracts. Declare network, assets, note versions, scoring inputs, claim/expiry rules and public disclosures. |
| Badges and rewards | Require defined completion/eligibility rules and their own implementation. A listing or valid replay does not establish eligibility or honest human play. |

The GC issuer/network/decimals, narrowly scoped private-balance reader, ownership/authenticity verification, freshness/replay rules and leaderboard service are unresolved. A signature over a declared number alone does not prove a private balance. Do not invent a submission endpoint or make a private-data grant imply publication consent. Identity, rank/tie rules, retries, retention and unpublish behavior also need a service contract before activation.

Native My activity classifies existing transactions by recorded origins of current-network catalog games. It is not a complete gameplay history or score proof; untracked rounds, missing origins and delisted games can be absent. Label fictional/local preview data explicitly and keep it out of production behavior.

## Test and register

- Test touch input, pause/resume, result/restart, background return and both orientations on each claimed platform. For fullscreen, follow the [initial-head metadata and lifecycle checks](./bread-wallet-integration.md#optional-native-fullscreen).
- Where scoring is deterministic, keep known input/result vectors and reject malformed, duplicate or out-of-order submissions. For a reviewed challenge contract, test every claim, expiry, refund and recall path; a verified replay alone does not prove human input.
- Exercise missing provider, connection/private-read refusal, wallet overlays, account/network changes and interrupted requests. Opening the game never authorizes a transaction.
- Register the reviewed HTTPS deployment in wallet-config's `explore/<network>.json`, use `arcade`, add its section references and bump the document version. Follow [registration](./publishing-and-explore.md) and save app-specific evidence separately from the catalog harness.

The first useful milestone is a playable, recoverable game that a newcomer can understand. Live GC, challenges and rewards can be separate milestones without being presented as available.
