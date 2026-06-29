---
sidebar_position: 2
title: Accounts
description: Learn how to create and manage Miden accounts programmatically using Rust and TypeScript.
---

# Accounts

Miden's account model is fundamentally different from traditional blockchains. Let's explore how to create and manage accounts programmatically.

## Understanding Miden Accounts

Before diving into account creation, it's essential to understand what makes Miden accounts unique compared to traditional blockchain addresses.

**What Makes Miden Accounts Special:**

- **Smart Contract Wallets**: Every account is a programmable smart contract that can hold assets and execute custom logic
- **Modular Design**: Accounts are composed of reusable components (authentication, wallet functionality, etc.)
- **Privacy Levels**: Choose between public or private storage modes

Miden accounts differ from traditional blockchain addresses in fundamental ways.

**Account Architecture:**

- Every account is a **smart contract** with programmable logic
- Accounts can store **assets** (fungible and non-fungible tokens) in their vault
- Each account has **storage slots** for custom data
- Accounts are composed of **modular components** for different functionalities

**Storage Modes:**

- **Public**: All state visible onchain (transparent operations)
- **Private**: Only commitments onchain, full state held privately

### Account Structure

Every Miden account contains these core components:

- **Vault**: Secure asset storage
- **Storage**: Key-value data store (up to 255 slots)
- **Code**: Smart contract logic
- **Nonce**: Anti-replay counter
- **Components**: Modular functionality (authentication, wallet, etc.)

<details>
<summary>Account Struct</summary>

```rust
pub struct MidenAccount {
    /// Immutable, 120-bit ID encoding type, storage mode and version.
    pub id: [u8; 15],

    /// Determines mutability of the account (immutable, mutable).
    pub account_type: AccountType,

    /// Storage placement preference (public/private).
    pub storage_mode: StorageMode,

    /// Root commitment of the account CODE (MAST root).
    pub code_commitment: [u8; 32],

    /// Root commitment of the account STORAGE (slots / maps).
    /// Think of this as the "root hash" of the Account's storage merkle tree.
    pub storage_commitment: [u8; 32],

    /// Vault commitment. For compact headers we keep only an optional aggregate commitment.
    /// Indexers can materialize a richer view (e.g., list of assets) offchain.
    pub vault_commitment: Option<[u8; 32]>,

    /// Monotonically increasing counter; must increment exactly once when state changes.
    pub nonce: u64,

    /// Merged set of account components that defined this account's interface and storage.
    /// Accounts are composed by merging components (e.g. wallet component + an auth component).
    pub components: Vec<ComponentDescriptor>,

    /// Authentication procedure metadata (e.g. "RpoFalcon512").
    pub authentication: AuthenticationDescriptor,
}
```

**Account Types:**

```rust
pub enum AccountType {
    // Faucet that can issue fungible assets
    FungibleFaucet = 2,
    // Faucet that can issue non-fungible assets
    NonFungibleFaucet = 3,
    // Regular account with immutable code
    RegularAccountImmutableCode = 0,
    /// Regular account with updateable code
    RegularAccountUpdatableCode = 1,
}
```

**Storage Modes:**

```rust
pub enum StorageMode {
    /// State stored onchain and publicly readable.
    Public,
    /// Only a commitment is onchain; full state is held privately by the owner.
    Private,
}
```

</details>

## Set Up Development Environment

To run the code examples in this guide, you'll need to set up a development environment for either Rust or TypeScript.

### Rust Environment

If you already created `my-test-project` during [installation](./setup/installation.md#rust-project), you can reuse it. Otherwise, create a new project:

```bash title=">_ Terminal"
miden new my-project
cd my-project/integration/
```

For each code example, create a new binary file:

```bash title=">_ Terminal"
touch src/bin/demo.rs
```

Copy the Rust code example into the file, then run:

```bash title=">_ Terminal"
cargo run --bin demo --release
```

### TypeScript Environment

If you already created `miden-app` during [installation](./setup/installation.md#typescript-project), you can reuse it. Otherwise, scaffold a new Vite vanilla-ts project:

```bash title=">_ Terminal"
npm create vite@latest miden-app -- --template vanilla-ts
cd miden-app
npm install @miden-sdk/miden-sdk
```

For each code example, save the TypeScript snippet as `src/demo.ts` (overwriting the previous one as you progress):

```bash title=">_ Terminal"
touch src/demo.ts
```

Wire it into the entry point once (`src/main.ts`):

```ts title="src/main.ts"
import { demo } from "./demo";

demo().catch(console.error);
```

Run the dev server:

```bash title=">_ Terminal"
npm run dev
```

Open the dev-server URL in the browser and watch the devtools console for output.

:::tip
For detailed frontend setup guidance (React, wallets, UI), see the [Tutorials section](../tutorials/index.md).
:::

## Creating Accounts Programmatically

Let's start by creating accounts using the Miden client libraries:

```rust title="integration/src/bin/account.rs"
use miden_client::{
    account::{
        component::{AuthScheme, AuthSingleSig, BasicWallet},
        AccountBuilder, AccountStorageMode, AccountType,
    },
    auth::AuthSecretKey,
    builder::ClientBuilder,
    keystore::{FilesystemKeyStore, Keystore},
    rpc::{Endpoint, GrpcClient},
};
use miden_client_sqlite_store::ClientBuilderSqliteExt;
use rand::RngCore;
use std::sync::Arc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize RPC connection
    let endpoint = Endpoint::testnet();
    let timeout_ms = 10_000;
    let rpc_client = Arc::new(GrpcClient::new(&endpoint, timeout_ms));

    // Initialize keystore
    let keystore_path = std::path::PathBuf::from("./keystore");
    let keystore =
        Arc::new(FilesystemKeyStore::new(keystore_path).unwrap());

    let store_path = std::path::PathBuf::from("./store.sqlite3");

    // Initialize client to connect with the Miden Testnet.
    // NOTE: The client is our entry point to the Miden network.
    // All interactions with the network go through the client.
    let mut client = ClientBuilder::new()
        .rpc(rpc_client)
        .sqlite_store(store_path)
        .authenticator(keystore.clone())
        .in_debug_mode(true.into())
        .build()
        .await?;

    client.sync_state().await?;

    let mut init_seed = [0_u8; 32];
    client.rng().fill_bytes(&mut init_seed);

    let key_pair = AuthSecretKey::new_falcon512_poseidon2();

    let builder = AccountBuilder::new(init_seed)
        .account_type(AccountType::RegularAccountUpdatableCode)
        .storage_mode(AccountStorageMode::Public)
        .with_auth_component(AuthSingleSig::new(
            key_pair.public_key().to_commitment(),
            AuthScheme::Falcon512Poseidon2,
        ))
        .with_component(BasicWallet);

    let account = builder.build()?;

    client.add_account(&account, false).await?;

    keystore.add_key(&key_pair, account.id()).await?;

    println!("Account ID: {}", account.id());
    println!("No assets in Vault: {:?}", account.vault().is_empty());

    Ok(())
}
```

```typescript title="src/demo.ts"
import { MidenClient, AccountType } from "@miden-sdk/miden-sdk";

export async function demo() {
    // Initialize client to connect with the Miden Testnet.
    // NOTE: The client is our entry point to the Miden network.
    // All interactions with the network go through the client.
    const client = await MidenClient.createTestnet();

    // Create a new wallet account.
    const wallet = await client.accounts.create({
        type: AccountType.MutableWallet, // Standard wallet with upgradeable code
        storage: "public",               // Public: account state is visible onchain
    });

    console.log("Account ID:", wallet.id().toString());
    console.log(
        "No Assets in Vault:",
        wallet.vault().fungibleAssets().length === 0,
    );
}
```

<details>
<summary>Expected output</summary>

```text
Account ID: 0x94733054a40d1610178320cc0c8060
No Assets in Vault: true
```

</details>

## Creating a Token Faucet

Before we can work with tokens, we need a source of tokens. Let's create a fungible token faucet:

```rust title="integration/src/bin/faucet.rs"
use miden_client::{
    account::{
        component::{AuthScheme, AuthSingleSig, BasicFungibleFaucet},
        AccountBuilder, AccountStorageMode, AccountType,
    },
    asset::TokenSymbol,
    auth::AuthSecretKey,
    builder::ClientBuilder,
    keystore::{FilesystemKeyStore, Keystore},
    rpc::{Endpoint, GrpcClient},
    Felt,
};
use miden_client_sqlite_store::ClientBuilderSqliteExt;
use rand::RngCore;
use std::sync::Arc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize RPC connection
    let endpoint = Endpoint::testnet();
    let timeout_ms = 10_000;
    let rpc_client = Arc::new(GrpcClient::new(&endpoint, timeout_ms));

    // Initialize keystore
    let keystore_path = std::path::PathBuf::from("./keystore");
    let keystore =
        Arc::new(FilesystemKeyStore::new(keystore_path).unwrap());

    let store_path = std::path::PathBuf::from("./store.sqlite3");

    // Initialize client to connect with the Miden Testnet.
    // NOTE: The client is our entry point to the Miden network.
    // All interactions with the network go through the client.
    let mut client = ClientBuilder::new()
        .rpc(rpc_client)
        .sqlite_store(store_path)
        .authenticator(keystore.clone())
        .in_debug_mode(true.into())
        .build()
        .await?;

    client.sync_state().await?;

    // Faucet seed
    let mut init_seed = [0u8; 32];
    client.rng().fill_bytes(&mut init_seed);

    // Faucet parameters
    let symbol = TokenSymbol::new("TEST")?;
    let decimals = 8;
    let max_supply = Felt::new(1_000_000);

    // Generate key pair
    let key_pair = AuthSecretKey::new_falcon512_poseidon2();

    // Build the account
    let builder = AccountBuilder::new(init_seed)
        .account_type(AccountType::FungibleFaucet)
        .storage_mode(AccountStorageMode::Public)
        .with_auth_component(AuthSingleSig::new(
            key_pair.public_key().to_commitment(),
            AuthScheme::Falcon512Poseidon2,
        ))
        .with_component(BasicFungibleFaucet::new(symbol, decimals, max_supply)?);

    let faucet_account = builder.build()?;

    client.add_account(&faucet_account, false).await?;
    keystore.add_key(&key_pair, faucet_account.id()).await?;

    println!("Faucet account ID: {}", faucet_account.id());

    Ok(())
}
```

```typescript title="src/demo.ts"
import { MidenClient, AccountType } from "@miden-sdk/miden-sdk";

export async function demo() {
    // Initialize client to connect with the Miden Testnet.
    const client = await MidenClient.createTestnet();

    // Faucet parameters
    const decimals = 8;
    const maxSupply = 10_000_000n * 10n ** BigInt(decimals);

    // Create a fungible token faucet.
    const faucet = await client.accounts.create({
        type: AccountType.FungibleFaucet,
        symbol: "TEST",
        decimals,
        maxSupply,
        storage: "public",
    });

    console.log("Faucet account ID:", faucet.id().toString());
}
```

<details>
<summary>Expected output</summary>

```text
Faucet account ID: 0xde0ba31282f7522046d3d4af40722b
```

</details>

## Key Takeaways

**Account Types:**

- **Regular Accounts**: Standard smart contract wallets that can hold assets and execute custom logic
- **Faucet Accounts**: Specialized accounts with minting permissions for tokens

**Storage Modes:**

- **Public**: Account state is fully transparent and visible onchain
- **Private**: Only cryptographic commitments are stored onchain, with full state maintained privately

**Modular Components:**

- **BasicWallet**: Provides asset management functionality
- **BasicFungibleFaucet**: Enables token minting capabilities
- **AuthSingleSig**: Handles cryptographic authentication (Falcon512 or ECDSA via the `AuthScheme` enum)

Now that you understand how to create accounts and faucets, you're ready to learn about Miden's unique transaction model. Continue to [Notes & Transactions](./notes.md) to explore how assets move between accounts using notes.

---
