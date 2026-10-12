---
title: Testing MASM with MockChain
description: Execute MASM through the transaction kernel, commit local state changes, and test rejection paths with MockChain.
sidebar_position: 5
---

# Testing MASM with MockChain

Use `miden-testing::MockChain` to test transactions against local accounts, notes, and block state. It executes the real transaction kernel and can build subsequent blocks without a node. Test both the intended state transition and the precise failure conditions.

The [transaction-script example](./transaction-scripts) supplies the pinned **0.17.1** project and Rust **1.98.1** prerequisites. From `docs/examples/masm/transaction-lab`, run:

```bash
cargo +1.98.1 test --locked --test mock_chain -- --nocapture
```

The two tests below pass: a P2ID receipt commits 100 units to its target wallet, and an attempt by the wrong account fails.

## Execute and commit a note receipt

Save the following as `tests/mock_chain.rs` in the example project. It uses the standard P2ID MASM note script rather than implementing a second recipient check.

```rust title="tests/mock_chain.rs"
use miden_protocol::{Felt, asset::FungibleAsset, note::NoteType};
use miden_testing::{Auth, MockChain};
use miden_tx::TransactionExecutorError;

#[tokio::test]
async fn consume_note_and_commit_account_state() -> anyhow::Result<()> {
    let mut builder = MockChain::builder();
    let sender = builder.add_existing_wallet(Auth::IncrNonce)?;
    let receiver = builder.add_existing_wallet(Auth::IncrNonce)?;
    let asset = FungibleAsset::mock(100).unwrap_fungible();
    let note = builder.add_p2id_note(
        sender.id(),
        receiver.id(),
        &[asset.into()],
        NoteType::Public,
    )?;
    let mut chain = builder.build()?;
    let original = receiver.nonce();

    let executed = chain
        .build_transaction(receiver.id())
        .authenticated_input_note(note.id())
        .build()?
        .execute()
        .await?;
    assert_eq!(executed.final_account().nonce(), original + Felt::ONE);
    assert_eq!(chain.committed_account(receiver.id())?.nonce(), original);

    chain.add_pending_executed_transaction(&executed)?;
    assert_eq!(chain.committed_account(receiver.id())?.nonce(), original);
    chain.prove_next_block()?;

    let committed = chain.committed_account(receiver.id())?;
    assert_eq!(committed.nonce(), original + Felt::ONE);
    assert_eq!(committed.vault().get_balance(asset.id())?, asset.amount());
    assert!(chain.is_note_consumed(&note.nullifier()));
    Ok(())
}

#[tokio::test]
async fn p2id_rejects_the_wrong_account() -> anyhow::Result<()> {
    let mut builder = MockChain::builder();
    let sender = builder.add_existing_wallet(Auth::IncrNonce)?;
    let receiver = builder.add_existing_wallet(Auth::IncrNonce)?;
    let note = builder.add_p2id_note(
        sender.id(),
        receiver.id(),
        &[FungibleAsset::mock(100)],
        NoteType::Public,
    )?;
    let chain = builder.build()?;
    let result = chain
        .build_transaction(sender.id())
        .authenticated_input_note(note.id())
        .build()?
        .execute()
        .await;
    let error = result.expect_err("P2ID must reject an account other than its target");
    assert!(matches!(
        error,
        TransactionExecutorError::TransactionProgramExecutionFailed(_)
    ));
    let diagnostic = error.to_string();
    assert!(
        diagnostic.contains("the active account is not the target account"),
        "{diagnostic}"
    );
    println!("{diagnostic}");
    assert_eq!(
        chain.committed_account(sender.id())?.nonce(),
        sender.nonce()
    );
    assert!(!chain.is_note_consumed(&note.nullifier()));
    Ok(())
}
```

The successful test separates three steps:

1. `execute().await` returns an `ExecutedTransaction`. Its final account header reflects execution, while `committed_account` still contains the original state.
2. `add_pending_executed_transaction` queues the result. Committed state still does not change.
3. `prove_next_block` includes the transaction and applies its effects. Check the committed vault balance, nonce, and consumed-note nullifier.

`add_existing_wallet` puts an account in genesis, and `add_p2id_note` puts a note there. `create_new_wallet` creates an account without committing it; pass that account into `build_transaction` when its first transaction creates it. In this test, the existing public accounts can be retrieved by ID after commitment.

The negative test executes the same P2ID note against the sender instead of its target. It checks the executor error and its recipient assertion message, then verifies the sender nonce and note nullifier remain unchanged. Merely checking `is_err()` could let an unrelated error hide a broken recipient rule.

## Adapt the fixture to your MASM

For a custom transaction script, add `.tx_script(compiled_script)` and `.tx_script_args(args)` before `.build()`, as shown in [MASM transaction scripts](./transaction-scripts). For an existing input note, use `.authenticated_input_note(note.id())` so the transaction includes its chain inclusion proof. Use `.unauthenticated_input_note(note)` when specifically testing consumption without that proof.

Assert observable effects: named storage values, asset balances, output-note contents, account nonce, and nullifiers. For a rejection path, assert the intended error and ensure it has no committed effects. Use a fresh builder per test to isolate state.

## What this fixture validates

`Auth::IncrNonce` is a **test authentication component** that only increments the nonce. Use `Auth::BasicAuth` with `AuthScheme::Falcon512Poseidon2`, as in the transaction-script example, when signatures are part of what you are testing. MockChain's default verification fee is zero; configure fees explicitly for fee-policy tests.

`add_pending_executed_transaction` creates a dummy transaction proof for local block construction. This workflow validates execution and local state transitions; it does not exercise production transaction proving, RPC submission, network synchronization, or block inclusion by a live node. Keep a client/node integration test for those boundaries.

Use [Debugging MASM](./debugging) to recover assertion messages and inspect a failing stack.
