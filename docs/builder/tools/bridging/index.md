---
sidebar_position: 1
title: Bridging
description: "Testnet bridge tooling and interoperability guides for Miden builders."
pagination_prev: null
---

# Bridging

Bridging docs cover testnet bridge tooling and interoperability workflows for
builders integrating Miden with external networks and intent systems.

The first guide in this section is the mock NEAR Intents 1Click-style bridge
sandbox for Sepolia native ETH and public Miden testnet. Future bridge docs can
be added beside it, including AggLayer bridging and Epoch bridging, without
making any single guide the canonical production bridge path.

<Callout variant="warn" title="Testnet only">
The current bridge sandbox is developer testing infrastructure. It is not a
production bridge, not a mainnet integration path, and must not be used with
mainnet funds.
</Callout>

## Start here

<CardGrid cols={3}>
  <Card title="Testnet sandbox" docId="builder/tools/bridging/testnet-sandbox" eyebrow="Sepolia + Miden testnet">
    Run the mock 1Click Bridge API locally and reproduce the Sepolia-to-Miden
    and Miden-to-Sepolia testing flow.
  </Card>
  <Card title="Bridge flows" docId="builder/tools/bridging/flows" eyebrow="Diagrams">
    Understand the actors, solver role, public Miden notes, and inbound/outbound
    lifecycle.
  </Card>
  <Card title="API reference" docId="builder/tools/bridging/api-reference" eyebrow="/v0">
    Integration shape for `/v0/tokens`, `/v0/quote`, `/v0/deposit/submit`, and
    `/v0/status`.
  </Card>
</CardGrid>

## Current scope

| Area | Status | Notes |
| --- | --- | --- |
| Mock NEAR Intents 1Click bridge sandbox | Available | Testnet-only local service for app integration testing. |
| AggLayer bridging | Planned | Add as a sibling guide when the developer-facing flow is stable. |
| Epoch bridging | Planned | Add as a sibling guide when the developer-facing flow is stable. |

## When to use this section

Use these docs when you need to:

- point an app at a local mock Bridge API;
- test bridge-like quote, deposit, status, and claim flows against public
  testnets;
- understand how public Miden notes can represent bridge deposits or payouts;
- collect evidence with Sepolia transaction hashes and Miden transaction IDs.

For core account, note, and transaction concepts, start with the Smart Contracts
section instead. For testnet RPC, explorer, faucet, and remote prover endpoints,
see [Network](../network.md).
