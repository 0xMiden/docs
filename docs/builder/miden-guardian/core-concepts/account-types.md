---
sidebar_label: Account Types
sidebar_position: 3
---

# Account Types

Miden supports three types of accounts, each with different visibility
and state-management properties.

## Public Accounts

Public accounts store their code and state **on-chain**. Anyone can
view the account's logic and current state, and anyone can execute
transactions against them — similar to smart contracts on Ethereum.

**Use cases:** Fungible token faucets, shared DeFi contracts, DAOs.

## Private Accounts

Private accounts store only a **commitment** (hash) to their state
on-chain. The actual data lives on the user's device. The Miden
operator never sees the account's internal state — only proof that
a valid transaction occurred.

**Use cases:** User wallets, privacy-preserving applications.

## Network Accounts

Network accounts are executed by the Miden operator rather than the
user. They are used for notes intended for automatic network execution,
where the user's device does not need to be online.

**Use cases:** Notes requiring operator-side execution.

## Comparison

| Property | Public | Private | Network |
|---|---|---|---|
| State stored on-chain | ✅ Full state | 🔒 Commitment only | ✅ Full state |
| Executable by anyone | ✅ Yes | ❌ No | ✅ By operator |
| Privacy | ❌ None | ✅ Full | ❌ None |
| Proved by | User / Anyone | User (local) | Miden operator |
