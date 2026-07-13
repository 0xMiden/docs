---
sidebar_position: 2
title: CLI Basics
description: Learn essential Miden CLI commands to create your wallet and mint your first tokens.
---

This guide covers essential Miden CLI commands for creating accounts, minting and managing tokens. Make sure to have [installed Miden development tools](./installation.md) using the `midenup` toolchain.

## Create Your First Account

### Generate a New Wallet

Create a new Miden wallet account:

```bash title=">_ Terminal"
miden client new-wallet
```

<details>
<summary>Expected output</summary>

```text
Successfully created new wallet.
To view account details execute miden-client account --show 0x05bd1f642cd368800cc95956b2696a
Config updated successfully
Setting account 0x05bd1f642cd368800cc95956b2696a as the default account ID.
You can unset it with `miden-client account --default none`.
```

</details>

This command creates a **BasicMutable** account with **private** storage mode, giving you full control while keeping your data confidential.

### View Your Account

List all your accounts:

```bash title=">_ Terminal"
miden client account
```

<details>
<summary>Expected output</summary>

```text
| Account ID | Type | Storage Mode | Nonce | Status |
|------------|------|--------------|-------|--------|
| 0x970e3e4dbcd09b8035532edaa87bc9 | Regular | private | 0 | New |
```

</details>

View detailed information about your account:

```bash title=">_ Terminal"
miden client account -s <ACCOUNT_ID>
```

<details>
<summary>Expected output</summary>

```text
Account Information
==================

| Field              | Value                                                                    |
|-------------------|--------------------------------------------------------------------------|
| Address           | mtst1qztsu0jdhngfhqp42vhd42rme9cqzkzy89e                                |
| Account ID (hex)  | 0x970e3e4dbcd09b8035532edaa87bc9                                        |
| Account Commitment| 0x404a762b9a19e70bc8752381b17f909bc0bbab02c0b4636d8923d088ac8ebc04      |
| Type              | Regular                                                                   |
| Storage mode      | private                                                                   |
| Code Commitment   | 0x6a11161925930dae89cc24cbddf0d161cead39b0fe88c262d4e790cff35be01d      |
| Vault Root        | 0x3e128c57f6cfa0d44ab1308994171af13cb513422add28d1916b3ff254fef82d      |
| Storage Root      | 0x5f95d38174f10c8ce91a0202763b0813fdcbb2714704cda411af6483ebc8d012      |
| Nonce             | 0                                                                         |

Assets:

| Asset Type | Faucet | Amount |
|------------|---------|---------|
| | | |

Storage:

| Item Slot Index | Item Slot Type | Value/Commitment |
|-----------------|----------------|------------------|
| 0 | Value | 0xa52ef6357625c54a2eaefd11b8cfc2ee3429c37d9f8a827e23886857ea284834 |
```

</details>

**Key Account Components:**

- **Account ID**: Unique 120-bit identifier encoding the account type and storage mode
- **Vault**: Secure storage for your assets
- **Storage**: Key-value store for account data (255 slots available)
- **Code Commitment**: Hash of the account's smart contract logic
- **Nonce**: Counter that increments with each state change

## Account Management

### Switch Between Accounts

If you have multiple accounts, set which one to use as default:

```bash title=">_ Terminal"
miden client account --default <ACCOUNT_ID>
```

### Deploy Your Account

To make your account visible on-chain, deploy it using:

```bash title=">_ Terminal"
miden client new-wallet
```

## Mint Your First Tokens

Request tokens from the public testnet faucet:

```bash title=">_ Terminal"
miden mint --target-account <ACCOUNT_ID> --amount 1000
```

This sends a mint request to the [public testnet faucet](https://faucet-api.testnet.miden.io) and automatically consumes the resulting note, depositing the tokens into your account.

Display your balance:

```bash title=">_ Terminal"
miden client sync
miden client account -s <ACCOUNT_ID>
```

## Create a New Project

**Rust workspace template**: Designed for developing, testing, and deploying Miden smart contracts using Rust

**Frontend project template**: Provides a simple starting point for building web applications that interact with deployed contracts on the Miden Testnet, including publishing and consuming notes.

**Rust Workspace:**

```bash title=">_ Terminal"
miden new my-project
```

Creates a **Rust workspace** for writing, testing and deploying Miden smart contracts.

**Vite Frontend Project:**

```bash title=">_ Terminal"
# Using Yarn
yarn create-miden-app
# Using NPM
npx create-miden-app
```

Creates a minimal **Vite example project with Miden integration**, built on the standard Vite React TypeScript template.

## Custom client configuration

Initialize the client in your working directory when you want to test against a custom network endpoint or use different keys without touching your global config:

```bash title=">_ Terminal"
miden client init --network devnet
```

Available networks:

- `testnet` - Miden's public test network
- `devnet` - Development network
- `localhost` - Local node for testing

### Important Files Created

When you manually initialize the Miden client in your working directory, several local files are created:

- **`miden-client.toml`**: Configuration file with network settings
- **`store.sqlite3`**: Database storing your account data and transaction history
- **`keystore/`**: Directory containing your private keys (keep secure!)
- **`templates/`**: Pre-built smart contract components

:::danger
Private keys in the `keystore/` directory are **not encrypted**. Keep these files secure and never share them.
:::

To return to your global client configuration, remove the local `miden-client.toml` (and any local store/keystore files you no longer need).

---
