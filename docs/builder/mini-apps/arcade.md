---
sidebar_position: 5
title: "Build an Arcade game"
sidebar_label: "Arcade games"
description: "Create a playable game for Bread, handle mobile presentation and register it in Arcade."
---

import MiniAppIcon from '@site/src/components/MiniAppIcon';

import MiniAppCard from '@site/src/components/MiniAppCard';

# Build an Arcade game

Give someone a game worth trying and a clear result worth sharing. Bread's native Arcade view handles discovery and game details; your hosted app owns the round, controls, session state and scores.

<Badge tone="brand">category: arcade</Badge>

## Build a complete first round

<Steps>

<div>

### Explain the game before asking for access

Show the objective, controls and any account, NFT or payment requirement. A practice round can help newcomers try the game before connecting, where the product supports it. Keep an existing pilot's requirements explicit.

</div>
<div>

### Make play work on a phone

Support touch input, pause/resume and a restart. Size the renderer to its actual container. Use [native fullscreen](./bread-wallet-integration.md#optional-native-fullscreen) when useful, while preserving ordinary browser layout, safe areas and Back to Bread.

</div>
<div>

### Show a result the player can understand

Distinguish a local score, personal best and verified game result. Explain where each persists and what becomes public. If a wallet action is needed, show its effect and let Bread handle approval.

</div>
<div>

### Offer a deliberate next step

Let the player replay, return to Bread or share an implemented result link with a disclosure preview. Test the destination and install/open fallback before advertising a branded challenge link.

</div>
</Steps>

## Keep the integration small

| Feature | Who implements it |
| --- | --- |
| Round, controls and session state | Your game |
| Scores, personal bests and game ranking | Your game, with rules appropriate to the claim |
| Explore discovery and Open action | Bread, using your validated catalog URL |
| Optional record/shot challenges | Your reviewed game contracts and claim/expiry handling |
| Shared native Game Coin (GC) ranking | A separate wallet/service integration described below |

Catalog registration does not require a new Arcade SDK, common challenge contract or reward system. Native My activity classifies recorded transactions by current-network game origins; it is not a complete play history or proof of a score.

<Callout variant="info" title="Shared GC ranking is a separate integration">
The current native direction uses GC balance snapshots that players voluntarily submit. Games keep their own scores. Live GC reading/submission is unavailable and real Submit stays disabled. Asset/network/decimals, balance authenticity and ownership, freshness, service/API and consent/retention rules must be defined before activation. A signature over a declared number does not prove a private balance.
</Callout>

## Test the game

- Complete a round, view the result, restart and return after backgrounding on every claimed platform.
- Check touch targets, both orientations, safe areas, wallet overlays and fullscreen refusal/return.
- For deterministic scoring, test known input/result vectors and malformed, duplicate or out-of-order attempts.
- For reviewed challenges, test every claim, expiry, refund and recall path. A valid replay does not prove honest human input or prize eligibility.
- Label fictional rankings and local previews clearly. Keep them unavailable in production.

## Register in Arcade

Set `category` to `arcade`, provide the reviewed live HTTPS launch URL, add the icon and section placement, then bump and validate the catalog version. Bread launches the exact configured URL through its existing dApp-browser path; opening the game does not connect an account or approve a transaction.

<CardGrid cols={2}>
  <MiniAppCard title="Test in Bread" page="testing-and-troubleshooting" eyebrow="Platform and recovery" icon={<MiniAppIcon name="test" />}>
    Verify gameplay alongside the wallet and presentation lifecycle.
  </MiniAppCard>
  <MiniAppCard title="Register your game" page="publishing-and-explore" eyebrow="wallet-config review" icon={<MiniAppIcon name="publish" />}>
    Prepare a reviewable catalog change and confirm activation.
  </MiniAppCard>
</CardGrid>
