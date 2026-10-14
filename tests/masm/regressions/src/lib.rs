#[cfg(test)]
mod tests {
    use miden_assembly::Assembler;
    use miden_processor::{DefaultHost, ExecutionError, FastProcessor, StackInputs};
    use miden_protocol::account::{
        Account, AccountComponent, AccountComponentCode, AccountComponentMetadata,
        AccountProcedureRoot, StorageSlot, StorageSlotName,
    };
    use miden_protocol::errors::ProposedBlockError;
    use miden_protocol::note::{
        Note, NoteAssets, NoteRecipient, NoteStorage, NoteTag, NoteType, PartialNoteMetadata,
    };
    use miden_protocol::transaction::{RawOutputNote, TransactionScript};
    use miden_protocol::{Felt, Word};
    use miden_standards::code_builder::CodeBuilder;
    use miden_testing::{Auth, MockChain};
    use miden_tx::TransactionExecutorError;

    fn value_word(value: Felt) -> Word {
        Word::from([value, Felt::ZERO, Felt::ZERO, Felt::ZERO])
    }

    fn slot() -> StorageSlotName {
        StorageSlotName::new("demo::settings::value").unwrap()
    }

    fn settings() -> anyhow::Result<(AccountComponentCode, AccountComponent)> {
        let code = CodeBuilder::default().compile_component_code(
            "demo::settings",
            include_str!("../../account-components/masm/settings.masm"),
        )?;
        let component = AccountComponent::new(
            code.clone(),
            vec![StorageSlot::with_value(
                slot(),
                value_word(Felt::from(7u32)),
            )],
            AccountComponentMetadata::new("Settings"),
        )?;
        Ok((code, component))
    }

    fn account_fixture(
        installed: bool,
        value: Felt,
    ) -> anyhow::Result<(MockChain, Account, TransactionScript, AccountProcedureRoot)> {
        let (code, component) = settings()?;
        let set_root = code
            .get_procedure_root_by_path("demo::settings::set_value")
            .unwrap();
        let mut builder = MockChain::builder();
        let account = if installed {
            builder.add_existing_account_from_components(Auth::basic_falcon(), [component])?
        } else {
            builder.add_existing_wallet(Auth::basic_falcon())?
        };
        let source = include_str!("../../account-components/masm/update.masm")
            .replace(
                "push.0.0.0.42",
                &format!("push.0.0.0.{}", value.as_canonical_u64()),
            )
            .replace(
                "push.42 assert_eq",
                &format!("push.{} assert_eq", value.as_canonical_u64()),
            );
        let script = CodeBuilder::default()
            .with_dynamically_linked_package(&code)?
            .compile_tx_script(source)?;
        Ok((builder.build()?, account, script, set_root))
    }

    fn assert_missing_procedure(error: &TransactionExecutorError, expected: AccountProcedureRoot) {
        let TransactionExecutorError::TransactionProgramExecutionFailed(
            ExecutionError::ProcedureNotFound { root_digest, .. },
        ) = error
        else {
            panic!(
                "expected the dynamically linked Settings procedure to be unavailable: {error:?}"
            );
        };
        assert_eq!(AccountProcedureRoot::from_raw(*root_digest), expected);
    }

    #[test]
    fn standalone_vm_handles_zero_and_field_wraparound() -> anyhow::Result<()> {
        let program = Assembler::default()
            .assemble_program(
                "rectangle-area",
                include_str!("../../first-project/src/area.masm"),
            )
            .map_err(|error| anyhow::anyhow!("{error}"))?
            .unwrap_program();
        for (width, height, expected) in [
            (Felt::ZERO, Felt::from(6u32), Felt::ZERO),
            (Felt::MAX, Felt::from(2u32), Felt::MAX - Felt::ONE),
        ] {
            let output = FastProcessor::new(StackInputs::new(&[width, height])?)
                .execute_sync(&program, &mut DefaultHost::default())?;
            assert_eq!(output.stack[0], expected);
            assert!(output.stack[1..].iter().all(|felt| *felt == Felt::ZERO));
        }
        Ok(())
    }

    #[tokio::test]
    async fn account_values_cover_field_boundaries_without_committing_execution()
    -> anyhow::Result<()> {
        for value in [Felt::ZERO, Felt::MAX] {
            let (chain, account, script, _) = account_fixture(true, value)?;
            let before = chain.committed_account(account.id())?.clone();
            let executed = chain
                .build_transaction(account.id())
                .tx_script(script)
                .build()?
                .execute()
                .await?;
            let mut updated = account.clone();
            updated.apply_patch(executed.account_patch())?;
            assert_eq!(updated.storage().get_item(&slot())?, value_word(value));
            assert_eq!(chain.committed_account(account.id())?, &before);
        }
        Ok(())
    }

    #[tokio::test]
    async fn account_requires_its_authenticator_and_preserves_committed_state() -> anyhow::Result<()>
    {
        let (chain, account, script, _) = account_fixture(true, Felt::from(42u32))?;
        let before = chain.committed_account(account.id())?.clone();
        let header = chain.latest_block_header();
        let error = chain
            .build_transaction(account.id())
            .tx_script(script)
            .authenticator(None)
            .build()?
            .execute()
            .await
            .expect_err("account updates must require authentication");
        assert!(
            matches!(error, TransactionExecutorError::MissingAuthenticator),
            "{error:?}"
        );
        assert_eq!(chain.committed_account(account.id())?, &before);
        assert_eq!(chain.latest_block_header(), header);
        Ok(())
    }

    #[tokio::test]
    async fn linking_settings_does_not_install_it_on_the_account() -> anyhow::Result<()> {
        let (chain, account, script, set_root) = account_fixture(false, Felt::from(42u32))?;
        let before = chain.committed_account(account.id())?.clone();
        let header = chain.latest_block_header();
        let error = chain
            .build_transaction(account.id())
            .tx_script(script)
            .build()?
            .execute()
            .await
            .expect_err("linking a package must not add callable account code");
        assert_missing_procedure(&error, set_root);
        assert_eq!(chain.committed_account(account.id())?, &before);
        assert_eq!(chain.latest_block_header(), header);
        Ok(())
    }

    struct NoteFixture {
        chain: MockChain,
        intended: Account,
        alternate: Option<Account>,
        note: Note,
        set_root: AccountProcedureRoot,
    }

    fn note_fixture(value: Felt, alternate: Option<bool>) -> anyhow::Result<NoteFixture> {
        let (code, component) = settings()?;
        let set_root = code
            .get_procedure_root_by_path("demo::settings::set_value")
            .unwrap();
        let mut builder = MockChain::builder();
        let intended = builder
            .add_existing_account_from_components(Auth::basic_ecdsa(), [component.clone()])?;
        let alternate = match alternate {
            Some(true) => Some(
                builder.add_existing_account_from_components(Auth::basic_falcon(), [component])?,
            ),
            Some(false) => Some(builder.add_existing_wallet(Auth::basic_falcon())?),
            None => None,
        };
        let sender = builder.add_existing_wallet(Auth::basic_ecdsa())?;
        let script = CodeBuilder::default()
            .with_dynamically_linked_package(&code)?
            .compile_note_script(include_str!("../../note-scripts/masm/set-value.masm"))?;
        let recipient = NoteRecipient::new(
            Word::from([1u32, 2, 3, 4]),
            script,
            NoteStorage::new(vec![value])?,
        );
        let metadata = PartialNoteMetadata::new(sender.id(), NoteType::Public)
            .with_tag(NoteTag::with_account_target(intended.id()));
        let note = Note::new(NoteAssets::new(vec![])?, metadata, recipient);
        builder.add_output_note(RawOutputNote::Full(note.clone()));
        Ok(NoteFixture {
            chain: builder.build()?,
            intended,
            alternate,
            note,
            set_root,
        })
    }

    #[tokio::test]
    async fn note_storage_accepts_zero_and_maximum_field_values() -> anyhow::Result<()> {
        for value in [Felt::ZERO, Felt::MAX] {
            let NoteFixture {
                mut chain,
                intended,
                note,
                ..
            } = note_fixture(value, None)?;
            let executed = chain
                .build_transaction(intended.id())
                .authenticated_input_note(note.id())
                .build()?
                .execute()
                .await?;
            chain.add_pending_executed_transaction(&executed)?;
            chain.prove_next_block()?;
            assert_eq!(
                chain
                    .committed_account(intended.id())?
                    .storage()
                    .get_item(&slot())?,
                value_word(value)
            );
            assert!(chain.is_note_consumed(&note.nullifier()));
        }
        Ok(())
    }

    #[tokio::test]
    async fn target_tag_allows_a_different_authorized_compatible_account() -> anyhow::Result<()> {
        let NoteFixture {
            mut chain,
            intended,
            alternate,
            note,
            ..
        } = note_fixture(Felt::from(42u32), Some(true))?;
        let alternate = alternate.unwrap();
        assert_ne!(intended.id(), alternate.id());
        let before = chain.committed_account(intended.id())?.clone();
        let executed = chain
            .build_transaction(alternate.id())
            .authenticated_input_note(note.id())
            .build()?
            .execute()
            .await?;
        chain.add_pending_executed_transaction(&executed)?;
        chain.prove_next_block()?;
        assert_eq!(
            chain
                .committed_account(alternate.id())?
                .storage()
                .get_item(&slot())?,
            value_word(Felt::from(42u32))
        );
        assert_eq!(chain.committed_account(intended.id())?, &before);
        assert!(chain.is_note_consumed(&note.nullifier()));
        Ok(())
    }

    #[tokio::test]
    async fn note_rejects_a_consumer_without_settings_and_preserves_state() -> anyhow::Result<()> {
        let NoteFixture {
            chain,
            alternate,
            note,
            set_root,
            ..
        } = note_fixture(Felt::from(42u32), Some(false))?;
        let alternate = alternate.unwrap();
        let before = chain.committed_account(alternate.id())?.clone();
        let header = chain.latest_block_header();
        let error = chain
            .build_transaction(alternate.id())
            .authenticated_input_note(note.id())
            .build()?
            .execute()
            .await
            .expect_err("the consumer must expose the linked Settings interface");
        assert_missing_procedure(&error, set_root);
        assert_eq!(chain.committed_account(alternate.id())?, &before);
        assert_eq!(chain.latest_block_header(), header);
        assert!(chain.is_note_unspent(&note.nullifier()));
        Ok(())
    }

    #[tokio::test]
    async fn replay_cannot_commit_a_spent_note_twice() -> anyhow::Result<()> {
        let NoteFixture {
            mut chain,
            intended,
            note,
            ..
        } = note_fixture(Felt::from(42u32), None)?;
        let first = chain
            .build_transaction(intended.id())
            .authenticated_input_note(note.id())
            .build()?
            .execute()
            .await?;
        chain.add_pending_executed_transaction(&first)?;
        chain.prove_next_block()?;
        let before = chain.committed_account(intended.id())?.clone();
        let header = chain.latest_block_header();
        assert!(chain.is_note_consumed(&note.nullifier()));
        // MockChain retains old note records; execution alone does not check spent nullifiers.
        let replay = chain
            .build_transaction(intended.id())
            .authenticated_input_note(note.id())
            .build()?
            .execute()
            .await?;
        chain.add_pending_executed_transaction(&replay)?;
        let error = chain
            .prove_next_block()
            .expect_err("a spent nullifier must reject the second block");
        assert!(
            matches!(error.downcast_ref::<ProposedBlockError>(), Some(ProposedBlockError::NullifierSpent(nullifier)) if *nullifier == note.nullifier()),
            "{error:?}"
        );
        assert_eq!(chain.committed_account(intended.id())?, &before);
        assert_eq!(chain.latest_block_header(), header);
        assert!(chain.is_note_consumed(&note.nullifier()));
        Ok(())
    }
}
