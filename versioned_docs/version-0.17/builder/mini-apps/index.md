---
sidebar_position: 1
title: "Mini-apps"
sidebar_label: "Overview"
description: "Build a web app for Bread, connect the wallet when needed, and register it in Explore."
pagination_prev: null
---

import MiniAppIcon from '@site/src/components/MiniAppIcon';

import MiniAppCard from '@site/src/components/MiniAppCard';

# Mini-apps

Build a game, financial tool or useful everyday app that people can discover in Bread. Start with a web frontend, connect the wallet when the task needs it, then register your hosted app in Explore.

Your app owns its interface and business logic. Bread provides discovery, a supported browser surface and wallet requests with explicit user approval.

## Start building

<CardGrid cols={2}>
  <MiniAppCard title="Set up your project" page="setup" eyebrow="Step 1 · Clone and run" icon={<MiniAppIcon name="setup" />}>
    Clone the agentic workspace, keep its pins and choose the frontend entry for your app.
  </MiniAppCard>
  <MiniAppCard title="Connect to Bread" page="bread-wallet-integration" eyebrow="Step 2 · Wallet integration" icon={<MiniAppIcon name="wallet" />}>
    Detect the provider, connect an account and handle a supported request through its result.
  </MiniAppCard>
</CardGrid>

New to Miden's account and note model? Read [Build a mini-app](./building.md) before choosing who manages client state and transaction submission.

## Choose your app guide

Explore uses **All, Finance, Arcade and Others**. Submit one of the three app categories below; All combines them automatically.

<CardGrid cols={3}>
  <MiniAppCard title="Arcade" page="arcade" eyebrow="Games" icon={<MiniAppIcon name="arcade" />}>
    Create a playable round, support touch controls and give players a clear result and next step.
  </MiniAppCard>
  <MiniAppCard title="Finance" page="finance" eyebrow="Financial tools" icon={<MiniAppIcon name="finance" />}>
    Help someone complete a useful financial task with clear assets, fees, settlement and recovery.
  </MiniAppCard>
  <MiniAppCard title="Others" page="others" eyebrow="Learning and utilities" icon={<MiniAppIcon name="others" />}>
    Create learning, NFT and non-financial utility experiences with only the access they need.
  </MiniAppCard>
</CardGrid>

## Test and ship

<CardGrid cols={2}>
  <MiniAppCard title="Test in Bread" page="testing-and-troubleshooting" eyebrow="Step 3 · Verify the journey" icon={<MiniAppIcon name="test" />}>
    Check the actual wallet build, declined permissions, interrupted requests and mobile presentation.
  </MiniAppCard>
  <MiniAppCard title="Register in Explore" page="publishing-and-explore" eyebrow="Step 4 · Review and publish" icon={<MiniAppIcon name="publish" />}>
    Add your app to wallet-config, validate its metadata and version, then verify the listing after release.
  </MiniAppCard>
</CardGrid>

## Design the first visit

Give a newcomer something useful or enjoyable to do. A practice round, financial preview or short lesson can show the value before a connection request, where the product allows it. Explain any account, asset or payment requirement before entry.

Native mobile apps open in Bread's embedded dApp browser. Extension Explore opens the app in a browser tab. [Optional native fullscreen](./bread-wallet-integration.md#optional-native-fullscreen) gives suitable apps more room while retaining a visible way back.

<Callout variant="info" title="Opening an app does not authorize a payment">
Provider detection, wallet connection, private-data access and transaction approval are separate steps. Ask for the capabilities needed by the current task, and let the user decline.
</Callout>

<details>
<summary>Catalog rollout and implementation references</summary>

The direct-category catalog contract is implemented in [wallet-config #10](https://github.com/0xMiden/wallet-config/pull/10), with the matching native Explore reader and Arcade UI in [wallet #1512](https://github.com/0xMiden/wallet/pull/1512). As of 17 October 2026, these PRs are unmerged. Config publication must precede the reader release; older supported wallets continue using wallet-explore. Follow the [registration rollout checks](./publishing-and-explore.md#verify-publication).

</details>
