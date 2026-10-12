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
