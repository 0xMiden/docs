---
title: "Miden Smart Contracts"
sidebar_position: 0
description: "Reference documentation for building Miden smart contracts in Rust using the Miden SDK."
---

# Miden Smart Contracts

This section is the complete reference for building smart contracts on Miden using Rust and the Miden SDK (v0.10). If you're new to Miden, follow the hands-on [Miden Bank Tutorial](../tutorials/rust-compiler/miden-bank/).

All Miden Rust contracts compile under these constraints: `#![no_std]`, Rust 2024 edition.

import DocCard from '@theme/DocCard';

## Overview

<div className="row">
  <div className="col col--6">
  </div>
</div>

## Core Concepts

<div className="row">
  <div className="col col--4">
    <DocCard
      item={{
        type: 'link',
        href: './accounts/',
        label: 'Accounts',
        description: 'Components, storage, custom types, operations, cryptography, and authentication.',
      }}
    />
  </div>
  <div className="col col--4">
    <DocCard
      item={{
        type: 'link',
        href: './notes/',
        label: 'Notes',
        description: 'Programmable UTXOs for asset transfers.',
      }}
    />
  </div>
  <div className="col col--4">
    <DocCard
      item={{
        type: 'link',
        href: './transactions/',
        label: 'Transactions',
        description: 'Transaction context, scripts, and the advice provider.',
      }}
    />
  </div>
</div>

<div className="row">
  <div className="col col--4">
    <DocCard
      item={{
        type: 'link',
        href: './cross-component-calls',
        label: 'Cross-Component Calls',
        description: 'Calling methods across account components and from note scripts.',
      }}
    />
  </div>
</div>

## Reference

<div className="row">
  <div className="col col--4">
    <DocCard
      item={{
        type: 'link',
        href: './types',
        label: 'Types',
        description: 'Core types: Felt, Word, AccountId, NoteId, and more.',
      }}
    />
  </div>
  <div className="col col--4">
    <DocCard
      item={{
        type: 'link',
        href: './patterns',
        label: 'Patterns',
        description: 'Access control, rate limiting, spending limits, and anti-patterns.',
      }}
    />
  </div>
  <div className="col col--4">
    <DocCard
      item={{
        type: 'link',
        href: 'https://docs.rs/miden/latest/miden/',
        label: 'API Reference (docs.rs)',
        description: 'Complete API documentation for the miden crate.',
      }}
    />
  </div>
</div>
