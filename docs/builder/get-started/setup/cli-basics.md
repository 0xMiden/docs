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
miden client sync
miden client new-wallet
```

<details>
<summary>Expected output</summary>

```text
State synced to block <BLOCK_NUMBER>
...
Generated and stored Falcon512 authentication key in keystore.
Successfully created new wallet.
To view account details execute miden client account -s 0x05bd1f642cd368800cc95956b2696a
Setting account 0x05bd1f642cd368800cc95956b2696a as the default account ID.
You can unset it with `miden client account --default none`.
```

</details>

The first command synchronizes the client with the latest network state. The second creates a basic wallet account with **private** storage locally. Its first successful transaction publishes the account onchain.

### View Your Account

List all your accounts:

```bash title=">_ Terminal"
miden client account
```

<details>
<summary>Expected output</summary>

```text
| Account ID | Kind | Type | Nonce | Status |
|------------|------|------|-------|--------|
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
| Kind              | Regular                                                                   |
| Type              | private                                                                   |
| Code Commitment   | 0x6a11161925930dae89cc24cbddf0d161cead39b0fe88c262d4e790cff35be01d      |
| Vault Root        | 0x3e128c57f6cfa0d44ab1308994171af13cb513422add28d1916b3ff254fef82d      |
| Storage Root      | 0x5f95d38174f10c8ce91a0202763b0813fdcbb2714704cda411af6483ebc8d012      |
| Nonce             | 0                                                                         |

Assets:

| Asset Type | Faucet | Amount |
|------------|---------|---------|
| | | |

Storage:

| Slot Name                                                | Slot Type | Value/Commitment                                                   |
|----------------------------------------------------------|-----------|--------------------------------------------------------------------|
| miden::standards::auth::singlesig::scheme                | Value     | 0x0200000000000000000000000000000000000000000000000000000000000000 |
| miden::standards::auth::singlesig::pub_key               | Value     | 0x113697002c3061328fce8c1e26dc433c536e967c8b91f30d81517e47f5980b3c |
| miden::standards::inspection::storage_schema::commitment | Value     | 0xb5724e35b8267d3be6bfc7d0ce50bfd6cce52de6da9f9e847ab24ac1bf7770f1 |
```

</details>

**Key Account Components:**

- **Account ID**: Unique 120-bit identifier encoding the account visibility and version
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

## Mint Your First Tokens

Request test tokens for the wallet you just created. Replace `<ACCOUNT_ID>` with its account ID:

```bash title=">_ Terminal"
miden mint --target-account <ACCOUNT_ID> --amount 1000 --no-consume
```

The [testnet faucet](https://faucet.testnet.miden.io/) sends the tokens in a public note. The amount is in base units. `--no-consume` leaves the note for you to consume with `miden client` in the next step.

After the faucet transaction is confirmed, sync and consume the note:

```bash title=">_ Terminal"
miden client sync
miden client consume-notes --account <ACCOUNT_ID>
```

With no note IDs specified, `consume-notes` consumes the notes available to that account. Public funding notes are discovered by syncing; you do not need to import a file. If the note is not available yet, wait a few seconds and sync again.

This first transaction publishes your wallet onchain and adds the tokens to its vault. Its protocol fee is paid from the native test tokens in the funding note, so the remaining balance is less than the requested amount.

Once the transaction is confirmed, check your account and balance:

```bash title=">_ Terminal"
miden client sync
miden client account -s <ACCOUNT_ID>
```

The account now has a nonzero nonce and a funded vault.

<details>
<summary>Using a downloaded funding note</summary>

If you request tokens through the web faucet and download a note file, import it before running the sync and consume commands above:

```bash title=">_ Terminal"
miden client import <FUNDING_NOTE_FILE>
```

</details>

## Create a New Project

If you already created a project during [installation](./installation.md) (e.g., `my-test-project`), you can continue using it. Otherwise, create a new one:

**Rust Workspace:**

```bash title=">_ Terminal"
miden new my-project
```

Creates a **Rust workspace** for developing, testing, and deploying Miden smart contracts using Rust.

**Vite Frontend Project:**

```bash title=">_ Terminal"
# Using Yarn
yarn create miden-app
# Using NPM
npx create-miden-app
```

Creates a minimal **Vite example project with Miden integration**, built on the standard Vite React TypeScript template.

## Custom client configuration

Initialize the client in your working directory when you want to test against a custom network endpoint or use different keys without touching your global config:

```bash title=">_ Terminal"
miden client init --local --network devnet
```

Available networks:

- `testnet` - Miden's public test network
- `devnet` - Development network
- `localhost` - Local node for testing

### Important Files Created

When you initialize the Miden client with `--local`, a `.miden/` directory is created in your working directory with the following files:

- **`.miden/miden-client.toml`**: Configuration file with network settings
- **`.miden/store.sqlite3`**: Database storing your account data and transaction history
- **`.miden/keystore/`**: Directory containing your private keys (keep secure!)
- **`.miden/packages/`**: Pre-built account component packages

:::danger
Private keys in the `.miden/keystore/` directory are **not encrypted**. Keep these files secure and never share them.
:::

To remove the local configuration and return to your global client configuration, run this command from the same working directory:

```bash title=">_ Terminal"
miden client clear-config
```

---
