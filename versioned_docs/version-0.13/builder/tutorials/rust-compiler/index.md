---
title: "Rust Compiler"
sidebar_position: 1
description: "Learn to build Miden smart contracts using Rust with the Miden Rust compiler."
---

# Rust Compiler

The Miden Rust compiler allows you to write smart contracts in Rust and compile them to Miden Assembly (MASM). This section provides tutorials and reference documentation for developing with the Rust compiler.

## Getting Started

If you're new to the Miden Rust compiler, start with the **Miden Bank Tutorial** - a comprehensive, step-by-step guide that teaches all the core concepts through building a complete banking application.

<div className="row margin-bottom--lg">
  <div className="col col--6">
    <div className="card">
      <div className="card__header">
        <h3>Miden Bank Tutorial</h3>
      </div>
      <div className="card__body">
        <p>Build a complete banking application while learning:</p>
        <ul>
          <li>Account components and storage</li>
          <li>Note scripts and transaction scripts</li>
          <li>Asset management</li>
          <li>Cross-component calls</li>
          <li>Output note creation</li>
        </ul>
      </div>
      <div className="card__footer">
        <a className="button button--primary button--block" href="./miden-bank/">Start Tutorial</a>
      </div>
    </div>
  </div>
</div>

## Reference Documentation

These guides provide detailed reference information for Rust compiler development:

| Guide | Description |
|-------|-------------|
| [Testing with MockChain](./testing) | Learn to test your contracts using MockChain for local blockchain simulation |
| [Debugging Guide](./debugging) | Interpret errors and debug common issues |
| [Common Pitfalls](./pitfalls) | Avoid known issues and limitations |

## Source Code

The complete source code for the Miden Bank example is available at:

**[github.com/keinberger/miden-bank](https://github.com/keinberger/miden-bank)**

## Prerequisites

Before starting, ensure you have:

- Completed the [Get Started guide](../../get-started/)
- Basic familiarity with Rust programming
- Understanding of Miden concepts (accounts, notes, transactions)
