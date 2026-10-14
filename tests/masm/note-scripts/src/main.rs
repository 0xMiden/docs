use miden_protocol::account::component::AccountComponentMetadata;
use miden_protocol::account::{Account, AccountComponent, StorageSlot, StorageSlotName};
use miden_protocol::asset::Asset;
use miden_protocol::note::{
    Note, NoteAssets, NoteRecipient, NoteStorage, NoteTag, NoteType, PartialNoteMetadata,
};
use miden_protocol::transaction::RawOutputNote;
use miden_protocol::{Felt, Word};
use miden_standards::code_builder::CodeBuilder;
use miden_testing::{Auth, MockChain};
use std::collections::BTreeMap;

fn fixture(storage: Vec<Felt>, assets: Vec<Asset>) -> anyhow::Result<(MockChain, Account, Note)> {
    let slot = StorageSlotName::new("demo::settings::value")?;
    let code = CodeBuilder::default().compile_component_code(
        "demo::settings",
        include_str!("../../account-components/masm/settings.masm"),
    )?;
    let component = AccountComponent::new(
        code.clone(),
        vec![StorageSlot::with_value(slot, Word::from([7u32, 0, 0, 0]))],
        AccountComponentMetadata::new("Settings"),
    )?;

    let mut builder = MockChain::builder();
    let consumer =
        builder.add_existing_account_from_components(Auth::basic_ecdsa(), [component])?;
    let sender = builder.add_existing_wallet(Auth::basic_ecdsa())?;
    let script = CodeBuilder::default()
        .with_dynamically_linked_package(&code)?
        .compile_note_script(include_str!("../masm/set-value.masm"))?;
    let recipient = NoteRecipient::new(
        Word::from([1u32, 2, 3, 4]),
        script,
        NoteStorage::new(storage)?,
    );
    let metadata = PartialNoteMetadata::new(sender.id(), NoteType::Public)
        .with_tag(NoteTag::with_account_target(consumer.id()));
    let note = Note::new(NoteAssets::new(assets)?, metadata, recipient);

    // Seed the note into genesis so the consumer can provide its inclusion proof.
    builder.add_output_note(RawOutputNote::Full(note.clone()));
    Ok((builder.build()?, consumer, note))
}

async fn consume_and_commit(note_args: Word) -> anyhow::Result<()> {
    let (mut chain, consumer, note) = fixture(vec![Felt::from(42u32)], vec![])?;
    assert_eq!(note.assets().num_assets(), 0);
    assert!(chain.is_note_committed(&note.id()));
    assert!(chain.is_note_unspent(&note.nullifier()));

    let executed = chain
        .build_transaction(consumer.id())
        .authenticated_input_note(note.id())
        .extend_note_args(BTreeMap::from([(note.id(), note_args)]))
        .build()?
        .execute()
        .await?;
    assert_eq!(executed.input_notes().num_notes(), 1);
    assert_eq!(executed.output_notes().num_notes(), 0);

    chain.add_pending_executed_transaction(&executed)?;
    chain.prove_next_block()?;

    let slot = StorageSlotName::new("demo::settings::value")?;
    let committed = chain.committed_account(consumer.id())?;
    assert_eq!(
        committed.storage().get_item(&slot)?,
        Word::from([42u32, 0, 0, 0])
    );
    assert!(chain.is_note_consumed(&note.nullifier()));
    println!("settings value: 7 -> 42; note consumed");
    Ok(())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    consume_and_commit(Word::empty()).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use miden_protocol::asset::FungibleAsset;
    use miden_protocol::errors::MasmError;
    use miden_tx::TransactionExecutorError;

    #[tokio::test]
    async fn consumes_authenticated_note_and_commits_value() -> anyhow::Result<()> {
        consume_and_commit(Word::empty()).await
    }

    #[tokio::test]
    async fn ignores_consumption_time_arguments() -> anyhow::Result<()> {
        consume_and_commit(Word::from([99u32, 98, 97, 96])).await
    }

    async fn assert_rejected(
        storage: Vec<Felt>,
        assets: Vec<Asset>,
        expected_error: &'static str,
    ) -> anyhow::Result<()> {
        let (chain, consumer, note) = fixture(storage, assets)?;
        let error = chain
            .build_transaction(consumer.id())
            .authenticated_input_note(note.id())
            .build()?
            .execute()
            .await
            .expect_err("invalid note must be rejected");
        let TransactionExecutorError::TransactionProgramExecutionFailed(inner) = &error else {
            panic!("expected a MASM assertion failure: {error}");
        };
        assert!(
            MasmError::from_static_str(expected_error).matches_execution_error(inner),
            "{error}"
        );
        let slot = StorageSlotName::new("demo::settings::value")?;
        assert_eq!(
            chain
                .committed_account(consumer.id())?
                .storage()
                .get_item(&slot)?,
            Word::from([7u32, 0, 0, 0])
        );
        assert!(chain.is_note_unspent(&note.nullifier()));
        Ok(())
    }

    #[tokio::test]
    async fn rejects_missing_storage() -> anyhow::Result<()> {
        assert_rejected(
            vec![],
            vec![],
            "settings note expects exactly one storage item",
        )
        .await
    }

    #[tokio::test]
    async fn rejects_oversized_storage_before_loading_it() -> anyhow::Result<()> {
        assert_rejected(
            vec![Felt::from(42u32), Felt::ONE],
            vec![],
            "the number of note storage items exceeds the maximum accepted by the note script",
        )
        .await
    }

    #[tokio::test]
    async fn rejects_assets() -> anyhow::Result<()> {
        assert_rejected(
            vec![Felt::from(42u32)],
            vec![FungibleAsset::mock(100)],
            "settings note must not carry assets",
        )
        .await
    }

    #[tokio::test]
    async fn requires_consumer_authorization() -> anyhow::Result<()> {
        let (chain, consumer, note) = fixture(vec![Felt::from(42u32)], vec![])?;
        let error = chain
            .build_transaction(consumer.id())
            .authenticated_input_note(note.id())
            .authenticator(None)
            .build()?
            .execute()
            .await
            .expect_err("consumption must require the consumer's signature");
        assert!(
            matches!(error, TransactionExecutorError::MissingAuthenticator),
            "{error}"
        );
        let slot = StorageSlotName::new("demo::settings::value")?;
        assert_eq!(
            chain
                .committed_account(consumer.id())?
                .storage()
                .get_item(&slot)?,
            Word::from([7u32, 0, 0, 0])
        );
        assert!(chain.is_note_unspent(&note.nullifier()));
        Ok(())
    }
}
