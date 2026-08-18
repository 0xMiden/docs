---
sidebar_position: 4
title: Read Storage Values
description: Learn how to query account storage data and interact with deployed smart contracts.
---

# Read Storage Values

Let's explore how to interact with public accounts and retrieve their storage data.

## Understanding Account Storage

Miden accounts contain several types of data you can read.

**Account Components:**

- **Vault**: Contains the account's assets (tokens)
- **Storage**: Key-value data store with up to 255 slots
- **Code**: The account's smart contract logic (MAST root)
- **Nonce**: Nonce that increments with each state change to prevent double spend

**Storage Visibility:**

- **Public accounts**: All data is publicly accessible and can be read by anyone
- **Private accounts**: Only commitments are public; full data is held privately

## Set Up Development Environment

To run the code examples in this guide, you'll need to set up a development environment. If you haven't already, follow the setup instructions in the [Accounts](./accounts#set-up-development-environment) guide.

## Reading from a Public Smart Contract

Let's interact with a counter contract deployed on the Miden testnet. This contract maintains a simple counter value in a named storage map slot.

### Reading the Count of a Counter contract

```rust title="integration/src/bin/read-count.rs"
use integration::helpers::{counter_storage_slot, COUNTER_STORAGE_KEY};
use miden_client::{
    account::{Account, AccountId},
    builder::ClientBuilder,
    keystore::FilesystemKeyStore,
    rpc::{Endpoint, GrpcClient},
};
use miden_client_sqlite_store::ClientBuilderSqliteExt;
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
    // READ PUBLIC STATE OF THE COUNTER ACCOUNT
    //------------------------------------------------------------

    // A counter contract deployed on the Miden testnet. It is a public fixture and
    // may need updating after a new release.
    let counter_account_id = AccountId::from_hex("0x6a1b2d59a9ebd3f1534cfb2fcf4d7e")?;

    client.import_account_by_id(counter_account_id).await?;

    let counter_account: Account = client
        .get_account(counter_account_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Account not found"))?
        .try_into()?;

    // Read the count from the counter account's named storage map slot. Both the slot
    // name and the map key come from the project's `integration/src/helpers.rs`.
    let count = counter_account
        .storage()
        .get_map_item(&counter_storage_slot()?, COUNTER_STORAGE_KEY)?;

    println!("Count: {:?}", count);

    Ok(())
}
```

```typescript title="src/demo.ts"
import { MidenClient, Word } from "@miden-sdk/miden-sdk";

export async function demo() {
    // Initialize client to connect with the Miden Testnet.
    const client = await MidenClient.createTestnet();

    // A counter contract deployed on the Miden testnet. It is a public fixture and
    // may need updating after a new release.
    const counterAccountId = "0x6a1b2d59a9ebd3f1534cfb2fcf4d7e";

    // Fetch the counter account (imports it into the local store if needed).
    const counter = await client.accounts.getOrImport(counterAccountId);

    // Get the count from the counter account by querying its storage map
    // using the named storage slot and counter key.
    const slotName = "counter_account::counter_contract::count_map";
    const counterKey = new Word(BigUint64Array.from([0n, 0n, 0n, 1n]));
    const count = counter.storage().getMapItem(slotName, counterKey);

    // The count value is a WORD (array of 4 u64 values).
    // The counter number is the first element.
    console.log("Count:", Number(count?.toU64s()[0]));
}
```

<details>
<summary>Expected output</summary>

```text
Count: Word([1, 0, 0, 0])
```

</details>

## Reading Account Token Balances

You can also query the assets (tokens) held by an account:

```rust title="integration/src/bin/token-balance.rs"
use miden_client::{
    account::{
        component::{
            AccessControl, AuthScheme, AuthSingleSig, BasicWallet, BurnPolicyConfig,
            FungibleFaucet, MintPolicyConfig, PolicyRegistration, TokenName, TokenPolicyManager,
            TransferPolicy, create_fungible_faucet,
        },
        Account, AccountBuilder, AccountType,
    },
    asset::{AssetAmount, AssetCallbackFlag, AssetVaultKey, FungibleAsset, TokenSymbol},
    auth::AuthSecretKey,
    builder::ClientBuilder,
    keystore::{FilesystemKeyStore, Keystore},
    note::NoteType,
    rpc::{Endpoint, GrpcClient},
    transaction::TransactionRequestBuilder,
};
use miden_client_sqlite_store::ClientBuilderSqliteExt;
use miden_standards::AuthMethod;
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
    // CREATING A FAUCET, MINTING AND CONSUMING TOKENS
    //------------------------------------------------------------

    // Account seeds
    let mut alice_seed = [0u8; 32];
    client.rng().fill_bytes(&mut alice_seed);
    let mut faucet_seed = [0u8; 32];
    client.rng().fill_bytes(&mut faucet_seed);

    // Faucet parameters
    let symbol = TokenSymbol::new("TEST")?;
    let decimals = 8;
    let max_supply = AssetAmount::from(1_000_000u32);

    // Generate key pair
    let alice_key_pair = AuthSecretKey::new_falcon512_poseidon2();
    let faucet_key_pair = AuthSecretKey::new_falcon512_poseidon2();

    // Build the account
    let account_builder = AccountBuilder::new(alice_seed)
        .account_type(AccountType::Public)
        .with_auth_component(AuthSingleSig::new(
            alice_key_pair.public_key().to_commitment(),
            AuthScheme::Falcon512Poseidon2,
        ))
        .with_component(BasicWallet);

    // Build the faucet
    let faucet = FungibleFaucet::builder()
        .name(TokenName::new("Test Token")?)
        .symbol(symbol)
        .decimals(decimals)
        .max_supply(max_supply)
        .build()?;
    let policies = TokenPolicyManager::new()
        .with_mint_policy(MintPolicyConfig::AllowAll, PolicyRegistration::Active)?
        .with_burn_policy(BurnPolicyConfig::AllowAll, PolicyRegistration::Active)?
        .with_send_policy(TransferPolicy::AllowAll, PolicyRegistration::Active)?
        .with_receive_policy(TransferPolicy::AllowAll, PolicyRegistration::Active)?;

    let alice_account = account_builder.build()?;
    let faucet_account = create_fungible_faucet(
        faucet_seed,
        faucet,
        AccountType::Public,
        AuthMethod::SingleSig {
            approver: (
                faucet_key_pair.public_key().to_commitment(),
                AuthScheme::Falcon512Poseidon2,
            ),
        },
        AccessControl::AuthControlled,
        policies,
    )?;

    println!("Alice's account ID: {:?}", alice_account.id().to_hex());
    println!("Faucet account ID: {:?}", faucet_account.id().to_hex());

    // Add accounts to client
    client.add_account(&alice_account, false).await?;
    client.add_account(&faucet_account, false).await?;

    // Add keys to keystore
    keystore.add_key(&alice_key_pair, alice_account.id()).await?;
    keystore.add_key(&faucet_key_pair, faucet_account.id()).await?;

    let amount: u64 = 1000;
    // Enable asset callbacks so the faucet's send/receive transfer policies run
    // when this asset moves between accounts.
    let fungible_asset = FungibleAsset::new(faucet_account.id(), amount)?
        .with_callbacks(AssetCallbackFlag::Enabled);

    // Mint the asset to Alice — this creates a P2ID note she can consume.
    let transaction_request = TransactionRequestBuilder::new().build_mint_fungible_asset(
        fungible_asset,
        alice_account.id(),
        NoteType::Public,
        client.rng(),
    )?;
    client
        .submit_new_transaction(faucet_account.id(), transaction_request)
        .await?;
    client.sync_state().await?;

    // Public notes must be committed to a block before they can be consumed.
    // Poll until the network includes our mint note in a block.
    loop {
        client.sync_state().await?;

        let consumable_notes = client
            .get_consumable_notes(Some(alice_account.id()))
            .await?;

        if consumable_notes.is_empty() {
            println!("Waiting for P2ID note to be comitted...");
            tokio::time::sleep(Duration::from_secs(2)).await;
            continue;
        }

        let notes: Vec<miden_client::note::Note> = consumable_notes
            .into_iter()
            .map(|(record, _)| record.try_into().expect("Failed to convert to Note"))
            .collect();

        let consume_tx_request = TransactionRequestBuilder::new().build_consume_notes(notes)?;
        client
            .submit_new_transaction(alice_account.id(), consume_tx_request)
            .await?;
        client.sync_state().await?;

        break;
    }

    //------------------------------------------------------------
    // READ TOKEN BALANCE OF AN ACCOUNT
    //------------------------------------------------------------

    // Fetch the account again so the vault reflects the consumed note.
    let alice_account: Account = client
        .get_account(alice_account.id())
        .await?
        .ok_or_else(|| anyhow::anyhow!("Account not found"))?
        .try_into()?;

    // The callback flag is part of the vault key, so it must match the flag the asset
    // was minted with — otherwise the lookup misses and the balance reads 0.
    let balance_key = AssetVaultKey::new_fungible(
        faucet_account.id(),
        AssetCallbackFlag::Enabled,
    );
    let balance = alice_account.vault().get_balance(balance_key)?;

    println!("Alice's TEST token balance: {:?}", balance);

    Ok(())
}
```

```typescript title="src/demo.ts"
import { MidenClient } from "@miden-sdk/miden-sdk";

export async function demo() {
    // Initialize client to connect with the Miden Testnet.
    const client = await MidenClient.createTestnet();

    // Create Alice's account and a faucet.
    const alice = await client.accounts.create({
        storage: "public",
    });
    console.log("Alice's account ID:", alice.id().toString());

    const decimals = 8;
    const maxSupply = 10_000_000n * 10n ** BigInt(decimals);
    const faucet = await client.accounts.create({
        type: 0, // Fungible faucet
        symbol: "TEST",
        decimals,
        maxSupply,
        storage: "public",
    });
    console.log("Faucet account ID:", faucet.id().toString());

    // Mint 1000 tokens to Alice and consume the resulting P2ID note.
    await client.transactions.mint({
        account: faucet,
        to: alice,
        amount: 1000n,
        type: "public",
        waitForConfirmation: true,
    });

    const notes = await client.notes.listAvailable({ account: alice });
    await client.transactions.consume({
        account: alice,
        notes: [notes[0]],
        waitForConfirmation: true,
    });

    // Fetch Alice again so the vault reflects the consumed note.
    const updatedAlice = await client.accounts.get(alice);
    if (!updatedAlice) {
        throw new Error("Alice's account was not found");
    }

    const balance = updatedAlice.vault().getBalance(faucet.id());
    console.log("Alice's TEST token balance:", Number(balance));
}
```

<details>
<summary>Expected output</summary>

```text
Alice's account ID: "0x5b2840a923dedc102ea67e0c1eba3c"
Faucet account ID: "0x29dd1dc628d2842032e751ed1b5da7"
Waiting for P2ID note to be comitted...
Alice's TEST token balance: AssetAmount(1000)
```

</details>

---
