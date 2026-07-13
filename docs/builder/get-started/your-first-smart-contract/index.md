---
sidebar_position: 1
title: Your First Smart Contract
description: Learn to build, test, and deploy smart contracts on Miden using Rust.
---

# Your First Smart Contract

Welcome to the **Your First Smart Contract** guide! This tutorial will walk you through building, testing, and deploying your first Miden smart contract using Rust.

## What You'll Learn

By the end of this tutorial, you will have:

- **Set up a Miden project** with the proper workspace structure
- **Written and understood** a counter smart contract and increment note
- **Deployed your contract** to the Miden testnet using integration scripts
- **Mastered the fundamentals** of Miden's account-based smart contract model

This guide focuses on practical, hands-on learning. You'll work with real code and deploy to a live network, giving you everything needed to start building on Miden.

## What We'll Build

You'll create a **counter contract system** consisting of:

- **Counter Account**: A smart contract that stores and manages a counter value in its storage
- **Increment Note**: A note script that increments the counter when executed
- **Integration Scripts**: Deployment and interaction scripts for managing the contract lifecycle

The counter example is designed to teach core Miden concepts through a simple, understandable use case that you can extend for your own projects.

## Prerequisites

Before starting this guide, ensure you have completed the [Installation](../setup/installation) tutorial and have:

- **Rust toolchain** installed and configured
- **midenup toolchain** installed with Miden CLI tools

:::tip Prerequisites Required
You need those development tools installed for this guide. If you haven't set up your environment yet, please complete the [installation](../setup/installation) guide first.
:::

## No Prior Experience Required

This tutorial is designed for developers new to Miden. You don't need prior experience with:

- Miden's account model or note-based transactions
- Smart contract development on Miden
- The specifics of Rust development for blockchain

We'll explain these concepts as we encounter them in the tutorial.

## Getting Help

If you get stuck during this tutorial:

- Check the rest of the Miden Docs for detailed technical references
- Join the [Build On Miden](https://t.me/BuildOnMiden) Telegram community for support
- Review the code examples in your project's `contracts` and `integration/` folder

## Guide Structure

This tutorial is divided into focused sections:

1. **[Create Your Project](./create)** - Set up your workspace and understand the counter contract code
2. **[Deploy Your Contract](./deploy)** - Learn the integration folder and deploy to testnet
3. **[Test Your Contract](./test)** - Learn how to effectively test your contracts

Each section builds on the previous one, so we recommend following them in order.

Ready to build your first Miden smart contract? Let's get started!
