---
sidebar_position: 2
title: "Set up your project"
sidebar_label: "Set up your project"
description: "Clone the agentic workspace, install compatible dependencies and run the right frontend entry."
---

import MiniAppIcon from '@site/src/components/MiniAppIcon';

import MiniAppCard from '@site/src/components/MiniAppCard';

# Set up your project

Start with [agentic-template](https://github.com/0xMiden/agentic-template) for a workspace containing Rust contracts, a React frontend and agent instructions. Keep its submodule pins and lockfiles so the tools and examples agree.

## Prepare your tools

You need Git, Bash, curl, Node.js/npm and Yarn Classic. The pinned agentic frontend uses Node 20.19.0+ within the 20.x line; the current standalone wallet-managed starter documents Node 24. Follow the requirements of the checkout you choose. Custom contracts also need the matching Rust/midenup toolchain; the real local-node stage uses Docker with Compose.

Use the [Agentic setup guide](../agentic/setup.md) for the full prerequisite list and installer behavior.

## Create the workspace

<Steps>

<div>

### Clone with submodules

```bash
git clone --recurse-submodules https://github.com/0xMiden/agentic-template.git my-mini-app
cd my-mini-app
```

For the remaining root commands, stay in `my-mini-app`. The clone records specific `project-template` and `frontend-template` revisions.

</div>
<div>

### Read the project instructions

Read the root `AGENTS.md` or `CLAUDE.md`, `docs/agent-first-v017.md` and the frontend's README. Ask your agent to name the instructions and package versions it will use.

```bash
git submodule status --recursive
```

Inspect `setup.sh` before running it. It can install missing Rust, midenup and Yarn, install dependencies, sync SDK context and pre-build contracts. Node and Python must be prepared separately.

</div>
<div>

### Install and check the workspace

```bash
bash setup.sh
# After setup.sh reports completion:
bash scripts/journey.sh doctor
```

Continue with [Check your setup](../agentic/templates.md) to verify installed package guidance and source pins. Setup does not start a wallet session or submit a transaction.

</div>
<div>

### Run the frontend

```bash
(cd frontend-template && yarn dev)
```

Open the local URL printed by Vite. The default counter is an **app-owned client** example. Connecting its wallet button does not make counter transactions wallet-managed. Choose the entry below before implementing your app's request flow.

</div>
</Steps>

## Use the wallet-managed entry

The [frontend mini-app starter](https://github.com/0xMiden/frontend-template/blob/main/docs/mini-app-starter.md) provides `/mini-app.html` and reusable `src/mini-app/` code. It uses Bread for requests and keeps a journal for interrupted sends. It needs no counter address, contract deployment or app-owned client database.

The agentic workspace currently pins an earlier frontend revision. Check whether that revision contains `mini-app.html`; adopt the starter deliberately with compatible dependencies, rather than advancing every submodule. For a frontend-only project, use the standalone path:

```bash
git clone https://github.com/0xMiden/frontend-template.git my-wallet-app
cd my-wallet-app
# With Node 24 and Yarn Classic, as the starter documents:
corepack yarn install --frozen-lockfile
corepack yarn dev
```

Open `http://localhost:5173/mini-app.html`. Without an injected provider, expect connection guidance. To test a wallet session, open the same build in a supported Bread environment.

<Callout variant="tip" title="Localhost belongs to the device opening it">
For a physical phone, serve the development build on a reachable HTTPS origin with the required headers. Opening your laptop's localhost address on the phone will not reach that laptop, and an ordinary mobile browser does not gain Bread's provider.
</Callout>

## When you need custom contracts

Follow the [Agentic build journey](../agentic/first-app.md): compile contracts, test their state transitions, validate on a disposable local node, then connect the frontend. Rebuild compatible artifacts before copying them into `public/packages/`. Use the [migration guide](../migration/index.md) when changing release lines.

Use disposable development state. Preserve keys and private state before any existing-wallet upgrade; deleting a client store is not a general recovery procedure.

<CardGrid cols={2}>
  <MiniAppCard title="Choose the execution model" page="building" eyebrow="Next · Application design" icon={<MiniAppIcon name="apps" />}>
    Decide what the app owns and what Bread should execute.
  </MiniAppCard>
  <MiniAppCard title="Connect to Bread" page="bread-wallet-integration" eyebrow="Next · Wallet-managed apps" icon={<MiniAppIcon name="wallet" />}>
    Configure the provider and request one supported operation.
  </MiniAppCard>
</CardGrid>
