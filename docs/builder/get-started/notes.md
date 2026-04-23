---
sidebar_position: 3
title: Notes & Transactions
description: Learn Miden's unique note-based transaction model for asset transfers between accounts.
---

# Notes & Transactions

Miden's transaction model is uniquely powerful, combining private asset transfers through notes with zero-knowledge proofs. Let's explore how to mint, consume, and send tokens using this innovative approach.

## Understanding Miden's Transaction Model

Traditional blockchains move tokens directly between account balances. Miden uses a more sophisticated **note-based system** that provides enhanced privacy and flexibility.

**Think of Notes Like Sealed Envelopes:**

- Alice puts 100 tokens in a sealed envelope (note) addressed to Bob
- She posts the envelope to the public board (network)
- Only Bob can open envelopes addressed to him
- When Bob opens it, the 100 tokens move to his vault

**Key Components:**

- **Notes**: Sealed containers that carry data and assets between accounts
- **P2ID (Pay-To-ID) Notes**: Notes addressed to a specific account ID (like Bob's address)
- **Nullifiers**: Prevent someone from opening the same envelope twice
- **Zero-Knowledge Proofs**: Prove transactions are valid without revealing private details

## The Two-Transaction Model

A core principle of Miden is that **a transaction is the state transition of a single account**. This means each transaction only modifies one account's state, which enables parallel execution and strong privacy guarantees.

Miden uses a **two-transaction model** for asset transfers that provides enhanced privacy and scalability:

### Transaction 1: Sender Creates Note

- **Alice's account** creates a P2ID (Pay-To-ID) note containing 100 tokens
- The note specifies **Bob** as the only valid consumer
- Alice's balance decreases, note is available for consumption
- Alice's transaction is complete and final

### Transaction 2: Recipient Consumes Note

- **Bob's client** discovers the note (addressed to his ID)
- Bob creates a transaction to consume the note
- Tokens move from the note into Bob's vault
- Bob's balance increases, note is nullified

### Benefits

This approach provides several advantages over direct transfers:

1. **Privacy**: Alice and Bob's transactions are unlinkable
2. **Parallelization**: Multiple transactions can be processed concurrently, enabling simultaneous creation of notes.
3. **Flexibility**: Notes can include complex conditions (time locks, multi-sig, etc.)
4. **Scalability**: No global state synchronization required

## Set Up Development Environment

To run the code examples in this guide, you'll need to set up a development environment. If you haven't already, follow the setup instructions in the [Accounts](./accounts#set-up-development-environment) guide.

## Minting Tokens

**What is Minting?**
Minting in Miden creates new tokens and packages them into a **P2ID note** (Pay-to-ID note) addressed to a specific account. Unlike traditional blockchains where tokens appear directly in your balance, Miden uses a two-step process:

1. **Faucet mints tokens** → Creates a P2ID note containing the tokens
2. **Recipient consumes the note** → Tokens move into their account vault

**Key Concepts:**

- **P2ID Note**: A note that can only be consumed by the account it's addressed to
- **NoteType**: Determines visibility - `Public` notes are visible onchain and are stored by the Miden network, while `Private` notes are not stored by the network and must be exchanged directly between parties via other channels.
- **FungibleAsset**: Represents tokens that can be divided and exchanged (like currencies)

Let's see this in action:

```rust title="integration/src/bin/mint.rs"
use miden_client::{
    account::{
        component::{AuthScheme, AuthSingleSig, BasicFungibleFaucet, BasicWallet},
        AccountBuilder, AccountStorageMode, AccountType,
    },
    asset::{FungibleAsset, TokenSymbol},
    auth::AuthSecretKey,
    builder::ClientBuilder,
    keystore::{FilesystemKeyStore, Keystore},
    note::NoteType,
    rpc::{Endpoint, GrpcClient},
    transaction::TransactionRequestBuilder,
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

    //------------------------------------------------------------
    // CREATING A FAUCET AND MINTING TOKENS
    //------------------------------------------------------------

    // Faucet seed
    let mut init_seed = [0u8; 32];
    client.rng().fill_bytes(&mut init_seed);

    // Faucet parameters
    let symbol = TokenSymbol::new("TEST")?;
    let decimals = 8;
    let max_supply = Felt::new(1_000_000);

    // Generate key pair
    let alice_key_pair = AuthSecretKey::new_falcon512_poseidon2();
    let faucet_key_pair = AuthSecretKey::new_falcon512_poseidon2();

    // Build the account
    let account_builder = AccountBuilder::new(init_seed)
        .account_type(AccountType::RegularAccountUpdatableCode)
        .storage_mode(AccountStorageMode::Public)
        .with_auth_component(AuthSingleSig::new(
            alice_key_pair.public_key().to_commitment(),
            AuthScheme::Falcon512Poseidon2,
        ))
        .with_component(BasicWallet);

    // Build the faucet
    let faucet_builder = AccountBuilder::new(init_seed)
        .account_type(AccountType::FungibleFaucet)
        .storage_mode(AccountStorageMode::Public)
        .with_auth_component(AuthSingleSig::new(
            faucet_key_pair.public_key().to_commitment(),
            AuthScheme::Falcon512Poseidon2,
        ))
        .with_component(BasicFungibleFaucet::new(symbol, decimals, max_supply)?);

    let alice_account = account_builder.build()?;
    let faucet_account = faucet_builder.build()?;

    println!("Alice's account ID: {:?}", alice_account.id().to_hex());
    println!("Faucet account ID: {:?}", faucet_account.id().to_hex());

    // Add accounts to client
    client.add_account(&alice_account, false).await?;
    client.add_account(&faucet_account, false).await?;

    // Add keys to keystore
    keystore.add_key(&alice_key_pair, alice_account.id()).await?;
    keystore.add_key(&faucet_key_pair, faucet_account.id()).await?;

    let amount: u64 = 1000;
    let fungible_asset = FungibleAsset::new(faucet_account.id(), amount)?;

    // Build transaction request to mint fungible asset to Alice's account
    // NOTE: This transaction will create a P2ID note (a Miden note containing the minted asset)
    // for Alice's account. Alice will be able to consume these notes to get the fungible asset in her vault
    let transaction_request = TransactionRequestBuilder::new().build_mint_fungible_asset(
        fungible_asset,
        alice_account.id(),
        NoteType::Public,
        client.rng(),
    )?;

    // Create transaction and submit it to create P2ID notes for Alice's account
    let tx_id = client
        .submit_new_transaction(faucet_account.id(), transaction_request)
        .await?;
    client.sync_state().await?;

    println!(
        "Mint transaction submitted successfully, ID: {:?}",
        tx_id.to_hex()
    );

    Ok(())
}
```

```typescript title="src/demo.ts"
import { MidenClient, AccountType } from "@miden-sdk/miden-sdk";

export async function demo() {
    // Initialize client to connect with the Miden Testnet.
    const client = await MidenClient.createTestnet();

    // Creating Alice's account
    const alice = await client.accounts.create({
        type: AccountType.MutableWallet,
        storage: "public", // Public: account state is visible on-chain
    });
    console.log("Alice's account ID:", alice.id().toString());

    // Creating a faucet account
    const decimals = 8;
    const maxSupply = 10_000_000n * 10n ** BigInt(decimals);
    const faucet = await client.accounts.create({
        type: AccountType.FungibleFaucet,
        symbol: "TEST",
        decimals,
        maxSupply,
        storage: "public",
    });
    console.log("Faucet account ID:", faucet.id().toString());

    // Mint 1000 tokens to Alice.
    // This creates a P2ID note containing the asset; Alice consumes it
    // to actually receive the tokens in her vault (see the next section).
    console.log("Minting 1000 tokens to Alice...");
    const { txId } = await client.transactions.mint({
        account: faucet, // faucet is the executing account
        to: alice,
        amount: 1000n,
        type: "public",  // note visibility
    });
    console.log("Mint transaction submitted successfully, ID:", txId.toString());
}
```

<details>
<summary>Expected output</summary>

```text
Alice's account ID: 0x5b2840a923dedc102ea67e0c1eba3c
Faucet account ID: 0x29dd1dc628d2842032e751ed1b5da7
Minting 1000 tokens to Alice...
Mint transaction submitted successfully, ID: 0x7a2dbde87ea2f4d41b396d6d3f6bdb9a8d7e2a51555fa57064a1657ad70fca06
```

</details>

## Consuming Notes

**Why Consume Notes?**
After minting creates a P2ID note containing tokens, the recipient must **consume** the note to actually receive the tokens in their account vault. This two-step process provides several benefits:

- **Privacy**: The mint transaction and consume transaction are unlinkable
- **Flexibility**: Recipients can consume notes when they choose
- **Atomic Operations**: Each step either succeeds completely or fails safely

**The Process:**

1. **Find consumable notes** addressed to your account
2. **Create a consume transaction** referencing the note IDs
3. **Submit the transaction** to move tokens into your vault

Here's how to consume notes programmatically:

:::tip
This is a complete, self-contained example that includes the setup and minting steps from the previous section. **The new consume logic starts at the `CONSUMING P2ID NOTES` comment.**
:::

```rust title="integration/src/bin/consume.rs"
use miden_client::{
    account::{
        component::{AuthScheme, AuthSingleSig, BasicFungibleFaucet, BasicWallet},
        Account, AccountBuilder, AccountStorageMode, AccountType,
    },
    asset::{FungibleAsset, TokenSymbol},
    auth::AuthSecretKey,
    builder::ClientBuilder,
    keystore::{FilesystemKeyStore, Keystore},
    note::NoteType,
    rpc::{Endpoint, GrpcClient},
    transaction::TransactionRequestBuilder,
    Felt,
};
use miden_client_sqlite_store::ClientBuilderSqliteExt;
use rand::RngCore;
use std::sync::Arc;
use tokio::time::Duration;

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

    //------------------------------------------------------------
    // CREATING A FAUCET AND MINTING TOKENS
    //------------------------------------------------------------

    // Faucet seed
    let mut init_seed = [0u8; 32];
    client.rng().fill_bytes(&mut init_seed);

    // Faucet parameters
    let symbol = TokenSymbol::new("TEST")?;
    let decimals = 8;
    let max_supply = Felt::new(1_000_000);

    // Generate key pair
    let alice_key_pair = AuthSecretKey::new_falcon512_poseidon2();
    let faucet_key_pair = AuthSecretKey::new_falcon512_poseidon2();

    // Build the account
    let account_builder = AccountBuilder::new(init_seed)
        .account_type(AccountType::RegularAccountUpdatableCode)
        .storage_mode(AccountStorageMode::Public)
        .with_auth_component(AuthSingleSig::new(
            alice_key_pair.public_key().to_commitment(),
            AuthScheme::Falcon512Poseidon2,
        ))
        .with_component(BasicWallet);

    // Build the faucet
    let faucet_builder = AccountBuilder::new(init_seed)
        .account_type(AccountType::FungibleFaucet)
        .storage_mode(AccountStorageMode::Public)
        .with_auth_component(AuthSingleSig::new(
            faucet_key_pair.public_key().to_commitment(),
            AuthScheme::Falcon512Poseidon2,
        ))
        .with_component(BasicFungibleFaucet::new(symbol, decimals, max_supply)?);

    let alice_account = account_builder.build()?;
    let faucet_account = faucet_builder.build()?;

    println!("Alice's account ID: {:?}", alice_account.id().to_hex());
    println!("Faucet account ID: {:?}", faucet_account.id().to_hex());

    // Add accounts to client
    client.add_account(&alice_account, false).await?;
    client.add_account(&faucet_account, false).await?;

    // Add keys to keystore
    keystore.add_key(&alice_key_pair, alice_account.id()).await?;
    keystore.add_key(&faucet_key_pair, faucet_account.id()).await?;

    let amount: u64 = 1000;
    let fungible_asset = FungibleAsset::new(faucet_account.id(), amount)?;

    // Build transaction request to mint fungible asset to Alice's account
    // NOTE: This transaction will create a P2ID note (a Miden note containing the minted asset)
    // for Alice's account. Alice will be able to consume these notes to get the fungible asset in her vault
    let transaction_request = TransactionRequestBuilder::new().build_mint_fungible_asset(
        fungible_asset,
        alice_account.id(),
        NoteType::Public,
        client.rng(),
    )?;

    // Create transaction and submit it to create P2ID notes for Alice's account
    let tx_id = client
        .submit_new_transaction(faucet_account.id(), transaction_request)
        .await?;
    client.sync_state().await?;

    println!(
        "Mint transaction submitted successfully, ID: {:?}",
        tx_id.to_hex()
    );

    //------------------------------------------------------------
    // CONSUMING P2ID NOTES
    //------------------------------------------------------------

    // Public notes must be committed to a block before they can be consumed.
    // Poll until the network includes our mint note in a block.
    loop {
        // Sync state to get the latest block
        client.sync_state().await?;

        let consumable_notes = client
            .get_consumable_notes(Some(alice_account.id()))
            .await?;

        if consumable_notes.is_empty() {
            println!("Waiting for P2ID note to be committed...");
            tokio::time::sleep(Duration::from_secs(2)).await;
            continue;
        }

        let notes: Vec<miden_client::note::Note> = consumable_notes
            .into_iter()
            .map(|(record, _)| record.try_into().expect("Failed to convert to Note"))
            .collect();

        let consume_tx_request = TransactionRequestBuilder::new().build_consume_notes(notes)?;

        // Create transaction and submit it to consume notes
        let consume_tx_id = client
            .submit_new_transaction(alice_account.id(), consume_tx_request)
            .await?;

        println!(
            "Consume transaction submitted successfully, ID: {:?}",
            consume_tx_id.to_hex()
        );

        client.sync_state().await?;

        let alice_account: Account = client
            .get_account(alice_account.id())
            .await?
            .ok_or_else(|| anyhow::anyhow!("Account not found"))?
            .try_into()?;
        let vault = alice_account.vault();
        println!(
            "Alice's TEST token balance: {:?}",
            vault.get_balance(faucet_account.id())
        );

        break; // Exit the loop after consuming the note
    }

    Ok(())
}
```

```typescript title="src/demo.ts"
import { MidenClient, AccountType } from "@miden-sdk/miden-sdk";

export async function demo() {
    // Initialize client to connect with the Miden Testnet.
    const client = await MidenClient.createTestnet();

    // Creating Alice's account
    const alice = await client.accounts.create({
        type: AccountType.MutableWallet,
        storage: "public",
    });
    console.log("Alice's account ID:", alice.id().toString());

    // Creating a faucet account
    const decimals = 8;
    const maxSupply = 10_000_000n * 10n ** BigInt(decimals);
    const faucet = await client.accounts.create({
        type: AccountType.FungibleFaucet,
        symbol: "TEST",
        decimals,
        maxSupply,
        storage: "public",
    });
    console.log("Faucet account ID:", faucet.id().toString());

    // Mint 1000 tokens to Alice. Creates a P2ID note that she'll consume.
    console.log("Minting 1000 tokens to Alice...");
    const mintResult = await client.transactions.mint({
        account: faucet,
        to: alice,
        amount: 1000n,
        type: "public",
        waitForConfirmation: true,
    });
    console.log(
        "Mint transaction submitted successfully, ID:",
        mintResult.txId.toString(),
    );

    // List notes available to Alice and consume them — tokens move into her vault.
    const notes = await client.notes.listAvailable({ account: alice });
    const consumeResult = await client.transactions.consume({
        account: alice,
        notes: [notes[0]],
        waitForConfirmation: true,
    });
    console.log(
        "Consume transaction submitted successfully, ID:",
        consumeResult.txId.toString(),
    );

    // Read Alice's TEST token balance directly via the accounts resource.
    const balance = await client.accounts.getBalance(alice, faucet);
    console.log("Alice's TEST token balance:", Number(balance));
}
```

<details>
<summary>Expected output</summary>

```text
Alice's account ID: "0x5b2840a923dedc102ea67e0c1eba3c"
Faucet account ID: "0x29dd1dc628d2842032e751ed1b5da7"
Minting 1000 tokens to Alice...
Mint transaction submitted successfully, ID: "0x7a2dbde87ea2f4d41b396d6d3f6bdb9a8d7e2a51555fa57064a1657ad70fca06"
Waiting for note to be consumable...
Consume transaction submitted successfully, ID: "0xa75872c498ee71cd6725aef9411d2559094cec1e1e89670dbf99c60bb8843481"
Alice's TEST token balance: Ok(1000)
```

</details>

## Sending Tokens Between Accounts

**How Sending Works in Miden**
Sending tokens between accounts follows the same note-based pattern. The sender creates a new P2ID note containing tokens from their vault and addresses it to the recipient:

**The Flow:**

1. **Sender creates P2ID note** containing tokens and recipient's account ID
2. **Sender submits transaction** - their balance decreases, note is published
3. **Recipient discovers note** addressed to their account ID
4. **Recipient consumes note** - tokens move into their vault

This approach means Alice and Bob's transactions are completely separate and unlinkable, providing strong privacy guarantees.

Let's implement the complete flow - mint, consume, then send:

:::tip
This is a complete, self-contained example that includes all previous steps. **The new send logic starts at the `SENDING TOKENS TO BOB` comment.**
:::

```rust title="integration/src/bin/send.rs"
use miden_client::{
    account::{
        component::{AuthScheme, AuthSingleSig, BasicFungibleFaucet, BasicWallet},
        Account, AccountBuilder, AccountId, AccountStorageMode, AccountType,
    },
    asset::{FungibleAsset, TokenSymbol},
    auth::AuthSecretKey,
    builder::ClientBuilder,
    keystore::{FilesystemKeyStore, Keystore},
    note::{NoteAttachment, NoteType, P2idNote},
    rpc::{Endpoint, GrpcClient},
    transaction::TransactionRequestBuilder,
    Felt,
};
use miden_client_sqlite_store::ClientBuilderSqliteExt;
use rand::RngCore;
use std::sync::Arc;
use tokio::time::Duration;

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

    //------------------------------------------------------------
    // CREATING A FAUCET AND MINTING TOKENS
    //------------------------------------------------------------

    // Faucet seed
    let mut init_seed = [0u8; 32];
    client.rng().fill_bytes(&mut init_seed);

    // Faucet parameters
    let symbol = TokenSymbol::new("TEST")?;
    let decimals = 8;
    let max_supply = Felt::new(1_000_000);

    // Generate key pair
    let alice_key_pair = AuthSecretKey::new_falcon512_poseidon2();
    let faucet_key_pair = AuthSecretKey::new_falcon512_poseidon2();

    // Build the account
    let account_builder = AccountBuilder::new(init_seed)
        .account_type(AccountType::RegularAccountUpdatableCode)
        .storage_mode(AccountStorageMode::Public)
        .with_auth_component(AuthSingleSig::new(
            alice_key_pair.public_key().to_commitment(),
            AuthScheme::Falcon512Poseidon2,
        ))
        .with_component(BasicWallet);

    // Build the faucet
    let faucet_builder = AccountBuilder::new(init_seed)
        .account_type(AccountType::FungibleFaucet)
        .storage_mode(AccountStorageMode::Public)
        .with_auth_component(AuthSingleSig::new(
            faucet_key_pair.public_key().to_commitment(),
            AuthScheme::Falcon512Poseidon2,
        ))
        .with_component(BasicFungibleFaucet::new(symbol, decimals, max_supply)?);

    let alice_account = account_builder.build()?;
    let faucet_account = faucet_builder.build()?;

    println!("Alice's account ID: {:?}", alice_account.id().to_hex());
    println!("Faucet account ID: {:?}", faucet_account.id().to_hex());

    // Add accounts to client
    client.add_account(&alice_account, false).await?;
    client.add_account(&faucet_account, false).await?;

    // Add keys to keystore
    keystore.add_key(&alice_key_pair, alice_account.id()).await?;
    keystore.add_key(&faucet_key_pair, faucet_account.id()).await?;

    let amount: u64 = 1000;
    let fungible_asset = FungibleAsset::new(faucet_account.id(), amount)?;

    // Build transaction request to mint fungible asset to Alice's account
    // NOTE: This transaction will create a P2ID note (a Miden note containing the minted asset)
    // for Alice's account. Alice will be able to consume these notes to get the fungible asset in her vault
    let transaction_request = TransactionRequestBuilder::new().build_mint_fungible_asset(
        fungible_asset,
        alice_account.id(),
        NoteType::Public,
        client.rng(),
    )?;

    // Create transaction and submit it to create P2ID notes for Alice's account
    let tx_id = client
        .submit_new_transaction(faucet_account.id(), transaction_request)
        .await?;
    client.sync_state().await?;

    println!(
        "Mint transaction submitted successfully, ID: {:?}",
        tx_id.to_hex()
    );

    //------------------------------------------------------------
    // CONSUMING P2ID NOTES
    //------------------------------------------------------------

    // Public notes must be committed to a block before they can be consumed.
    // Poll until the network includes our mint note in a block.
    loop {
        // Sync state to get the latest block
        client.sync_state().await?;

        let consumable_notes = client
            .get_consumable_notes(Some(alice_account.id()))
            .await?;

        if consumable_notes.is_empty() {
            println!("Waiting for P2ID note to be committed...");
            tokio::time::sleep(Duration::from_secs(2)).await;
            continue;
        }

        let notes: Vec<miden_client::note::Note> = consumable_notes
            .into_iter()
            .map(|(record, _)| record.try_into().expect("Failed to convert to Note"))
            .collect();

        let consume_tx_request = TransactionRequestBuilder::new().build_consume_notes(notes)?;

        // Create transaction and submit it to consume notes
        let consume_tx_id = client
            .submit_new_transaction(alice_account.id(), consume_tx_request)
            .await?;

        println!(
            "Consume transaction submitted successfully, ID: {:?}",
            consume_tx_id.to_hex()
        );

        client.sync_state().await?;

        let alice_account: Account = client
            .get_account(alice_account.id())
            .await?
            .ok_or_else(|| anyhow::anyhow!("Account not found"))?
            .try_into()?;
        let vault = alice_account.vault();
        println!(
            "Alice's TEST token balance: {:?}",
            vault.get_balance(faucet_account.id())
        );

        break; // Exit the loop after consuming the note
    }

    //------------------------------------------------------------
    // SENDING TOKENS TO BOB
    //------------------------------------------------------------

    let bob_account_id = AccountId::from_hex("0x103f8a1ad4b983104aec0412ab0b0d")?;
    let send_amount = 100;
    let fungible_asset_to_send = FungibleAsset::new(faucet_account.id(), send_amount)?;

    let p2id_note = P2idNote::create(
        alice_account.id(),
        bob_account_id,
        vec![fungible_asset_to_send.into()],
        NoteType::Public,
        NoteAttachment::default(),
        client.rng(),
    )?;

    // Create transaction request to send P2ID note to Bob
    let send_p2id_note_transaction_request = TransactionRequestBuilder::new()
        .own_output_notes(vec![p2id_note])
        .build()?;

    // Create transaction and submit it to send P2ID note to Bob
    let send_p2id_note_tx_id = client
        .submit_new_transaction(alice_account.id(), send_p2id_note_transaction_request)
        .await?;
    client.sync_state().await?;

    println!(
        "Send 100 tokens to Bob note transaction ID: {:?}",
        send_p2id_note_tx_id.to_hex()
    );

    Ok(())
}
```

```typescript title="src/demo.ts"
import { MidenClient, AccountType } from "@miden-sdk/miden-sdk";

export async function demo() {
    // Initialize client to connect with the Miden Testnet.
    const client = await MidenClient.createTestnet();

    // Create Alice's account and a faucet.
    const alice = await client.accounts.create({
        type: AccountType.MutableWallet,
        storage: "public",
    });
    console.log("Alice's account ID:", alice.id().toString());

    const decimals = 8;
    const maxSupply = 10_000_000n * 10n ** BigInt(decimals);
    const faucet = await client.accounts.create({
        type: AccountType.FungibleFaucet,
        symbol: "TEST",
        decimals,
        maxSupply,
        storage: "public",
    });
    console.log("Faucet account ID:", faucet.id().toString());

    // Mint 1000 tokens to Alice and consume the resulting P2ID note.
    console.log("Minting 1000 tokens to Alice...");
    const mintResult = await client.transactions.mint({
        account: faucet,
        to: alice,
        amount: 1000n,
        type: "public",
        waitForConfirmation: true,
    });
    console.log(
        "Mint transaction submitted successfully, ID:",
        mintResult.txId.toString(),
    );

    const notes = await client.notes.listAvailable({ account: alice });
    const consumeResult = await client.transactions.consume({
        account: alice,
        notes: [notes[0]],
        waitForConfirmation: true,
    });
    console.log(
        "Consume transaction submitted successfully, ID:",
        consumeResult.txId.toString(),
    );

    const balance = await client.accounts.getBalance(alice, faucet);
    console.log("Alice's TEST token balance:", Number(balance));

    // Send 100 tokens from Alice to Bob.
    const bobAccountId = "0x103f8a1ad4b983104aec0412ab0b0d";
    console.log("Sending 100 tokens to Bob...");
    const { txId } = await client.transactions.send({
        account: alice,
        to: bobAccountId,
        token: faucet,
        amount: 100n,
        type: "public",
        waitForConfirmation: true,
    });
    console.log("Send transaction submitted successfully, ID:", txId.toString());
}
```

<details>
<summary>Expected output</summary>

```text
Alice's account ID: 0xd6b8bb0ed10b1610282c513501778a
Faucet account ID: 0xe48c43d6ad6496201bcfa585a5a4b6
Minting 1000 tokens to Alice...
Mint transaction submitted successfully, ID: 0x948a0eef754068b3126dd3261b6b54214fa5608fb13c5e5953faf59bad79c75f
Consume transaction submitted successfully, ID: 0xc69ab84b784120abe858bb536aebda90bd2067695f11d5da93ab0b704f39ad78
Alice's TEST token balance: 100
Send 100 tokens to Bob note transaction ID: "0x51ac27474ade3a54adadd50db6c2b9a2ede254c5f9137f93d7a970f0bc7d66d5"
```

</details>

## Key Takeaways

**Miden's Note-Based Transaction Model:**

- **Notes** enable asset transfers between accounts (both public and private)
- **Two-transaction model** provides privacy and parallelization benefits
- **Zero-knowledge proofs** validate transaction execution without revealing details
- **P2ID notes** target specific recipients using their account IDs

**Transaction Flow:**

1. **Mint** tokens to create notes containing assets
2. **Consume** notes to add assets to account vaults
3. **Send** tokens using P2ID notes targeted to recipients
4. **Nullify** consumed notes to prevent double-spending

This innovative approach provides unprecedented privacy and flexibility while maintaining the security guarantees of blockchain technology. The note-based model enables scalable, private transactions that can be processed in parallel without global state synchronization.

---
