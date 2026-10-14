use miden_processor::{ExecutionError, operation::OperationError};
use miden_protocol::{
    Felt, Word,
    account::{
        Account, AccountBuilder, AccountComponent, AccountType, StorageSlot, StorageSlotName,
        component::AccountComponentMetadata,
    },
    asset::FungibleAsset,
    errors::MasmError,
    note::{Note, NoteType},
};
use miden_standards::{code_builder::CodeBuilder, note::P2idNote};
use miden_testing::{AccountState, Auth, MockChain, assert_transaction_executor_error};
use miden_tx::{TransactionExecutorError, auth::BasicAuthenticator};

const REMAINING_SLOT: &str = "demo::spending_policy::remaining";

struct Fixture {
    chain: MockChain,
    account: Account,
    code: miden_protocol::account::AccountComponentCode,
    asset: FungibleAsset,
    recipient: miden_protocol::account::AccountId,
    deposit: Note,
}

fn fixture(allowance: u32, balance: u64) -> anyhow::Result<Fixture> {
    let asset = FungibleAsset::mock(balance).unwrap_fungible();
    let code = CodeBuilder::default()
        .compile_component_code("demo::spending_policy", include_str!("../masm/policy.masm"))?;
    let component = AccountComponent::new(
        code.clone(),
        vec![
            StorageSlot::with_value(
                StorageSlotName::new("demo::spending_policy::asset")?,
                asset.to_id_word(),
            ),
            StorageSlot::with_value(
                StorageSlotName::new(REMAINING_SLOT)?,
                Word::from([allowance, 0, 0, 0]),
            ),
        ],
        AccountComponentMetadata::new("SpendingPolicy"),
    )?;
    let mut builder = MockChain::builder().verification_base_fee(0);
    let account = builder.add_account_from_builder(
        Auth::basic_falcon(),
        AccountBuilder::new([42; 32])
            .account_type(AccountType::Public)
            .with_component(component)
            .with_assets([asset.into()]),
        AccountState::Exists,
    )?;
    let recipient = builder.add_existing_wallet(Auth::IncrNonce)?.id();
    let deposit = builder.add_p2id_note(
        recipient,
        account.id(),
        &[FungibleAsset::new(asset.faucet_id(), 50)?.into()],
        NoteType::Public,
    )?;
    let chain = builder.build()?;
    assert_eq!(
        chain
            .latest_block_header()
            .fee_parameters()
            .verification_base_fee(),
        0
    );
    Ok(Fixture {
        chain,
        account,
        code,
        asset,
        recipient,
        deposit,
    })
}

fn send_script(
    f: &Fixture,
    amounts: &[u64],
) -> anyhow::Result<miden_protocol::transaction::TransactionScript> {
    let mut body = String::new();
    for (index, amount) in amounts.iter().enumerate() {
        let note: Note = P2idNote::builder()
            .sender(f.account.id())
            .target(f.recipient)
            .asset(FungibleAsset::new(f.asset.faucet_id(), *amount)?)
            .note_type(NoteType::Private)
            .serial_number(Word::from([index as u32 + 1, 0, 0, 0]))
            .build()?
            .into();
        body.push_str(&format!(
            r#"
            push.{recipient}
            push.{note_type}.{tag}
            call.::miden::standards::note::note_creator::create_note
            movdn.15 dropw dropw dropw drop drop drop
            push.{amount}
            call.policy::send
            dropw dropw dropw dropw
        "#,
            recipient = note.recipient().digest(),
            note_type = NoteType::Private as u8,
            tag = u32::from(note.metadata().tag())
        ));
    }
    Ok(CodeBuilder::default()
        .with_dynamically_linked_package(&f.code)?
        .compile_tx_script(format!(
            "use demo::spending_policy as policy\n@transaction_script\npub proc main\n{body}\nend"
        ))?)
}

#[tokio::test]
async fn rejects_one_unit_above_allowance() -> anyhow::Result<()> {
    let f = fixture(100, 1_000)?;
    let result = f
        .chain
        .build_transaction(f.account.id())
        .tx_script(send_script(&f, &[101])?)
        .build()?
        .execute()
        .await;
    assert_transaction_executor_error!(
        result,
        MasmError::from_static_str("spending allowance exceeded")
    );
    assert_unchanged(&f)?;
    Ok(())
}

fn remaining(account: &Account) -> anyhow::Result<u64> {
    Ok(account
        .storage()
        .get_item(&StorageSlotName::new(REMAINING_SLOT)?)?[0]
        .as_canonical_u64())
}

fn assert_unchanged(f: &Fixture) -> anyhow::Result<()> {
    let committed = f.chain.committed_account(f.account.id())?;
    assert_eq!(committed, &f.account);
    Ok(())
}

#[tokio::test]
async fn sends_below_and_exactly_at_allowance() -> anyhow::Result<()> {
    for amount in [1u64, 40, 100] {
        let mut f = fixture(100, 1_000)?;
        let executed = f
            .chain
            .build_transaction(f.account.id())
            .tx_script(send_script(&f, &[amount])?)
            .build()?
            .execute()
            .await?;
        let mut updated = f.account.clone();
        updated.apply_patch(executed.account_patch())?;
        assert_eq!(remaining(&updated)?, 100 - amount);
        assert_eq!(
            updated.vault().get_balance(f.asset.id())?.as_u64(),
            1_000 - amount
        );
        assert_eq!(updated.nonce(), f.account.nonce() + Felt::ONE);
        let output = executed.output_notes().iter().next().unwrap();
        assert_eq!(
            output.assets().as_slice(),
            &[FungibleAsset::new(f.asset.faucet_id(), amount)?.into()]
        );
        assert_unchanged(&f)?;
        f.chain.add_pending_executed_transaction(&executed)?;
        f.chain.prove_next_block()?;
        assert_eq!(
            remaining(f.chain.committed_account(f.account.id())?)?,
            100 - amount
        );
    }
    Ok(())
}

#[tokio::test]
async fn cumulative_sends_in_one_transaction_cannot_exceed_allowance() -> anyhow::Result<()> {
    let f = fixture(100, 1_000)?;
    let result = f
        .chain
        .build_transaction(f.account.id())
        .tx_script(send_script(&f, &[60, 41])?)
        .build()?
        .execute()
        .await;
    assert_transaction_executor_error!(
        result,
        MasmError::from_static_str("spending allowance exceeded")
    );
    assert_unchanged(&f)?;
    Ok(())
}

#[tokio::test]
async fn allowance_persists_across_committed_transactions() -> anyhow::Result<()> {
    let mut f = fixture(100, 1_000)?;
    for amount in [60u64, 40] {
        let executed = f
            .chain
            .build_transaction(f.account.id())
            .tx_script(send_script(&f, &[amount])?)
            .build()?
            .execute()
            .await?;
        f.chain.add_pending_executed_transaction(&executed)?;
        f.chain.prove_next_block()?;
    }
    let committed = f.chain.committed_account(f.account.id())?;
    assert_eq!(remaining(&committed)?, 0);
    assert_eq!(committed.vault().get_balance(f.asset.id())?.as_u64(), 900);
    assert_eq!(committed.nonce(), f.account.nonce() + Felt::from(2u32));
    let result = f
        .chain
        .build_transaction(f.account.id())
        .tx_script(send_script(&f, &[1])?)
        .build()?
        .execute()
        .await;
    assert_transaction_executor_error!(
        result,
        MasmError::from_static_str("spending allowance exceeded")
    );
    assert_eq!(f.chain.committed_account(f.account.id())?, committed);
    Ok(())
}

#[tokio::test]
async fn u32_maximum_is_supported_and_larger_amount_is_rejected() -> anyhow::Result<()> {
    let f = fixture(u32::MAX, u64::from(u32::MAX) + 1)?;
    let executed = f
        .chain
        .build_transaction(f.account.id())
        .tx_script(send_script(&f, &[u64::from(u32::MAX)])?)
        .build()?
        .execute()
        .await?;
    let mut updated = f.account.clone();
    updated.apply_patch(executed.account_patch())?;
    assert_eq!(remaining(&updated)?, 0);
    assert_eq!(updated.vault().get_balance(f.asset.id())?.as_u64(), 1);
    let result = f
        .chain
        .build_transaction(f.account.id())
        .tx_script(send_script(&f, &[u64::from(u32::MAX) + 1])?)
        .build()?
        .execute()
        .await;
    let error = result.expect_err("amount greater than u32 must be rejected");
    match error {
        TransactionExecutorError::TransactionProgramExecutionFailed(
            ExecutionError::OperationError {
                err:
                    OperationError::U32AssertionFailed {
                        err_code,
                        invalid_values,
                        ..
                    },
                ..
            },
        ) => {
            assert_eq!(
                err_code,
                MasmError::from_static_str("spending amount must fit u32").code()
            );
            assert_eq!(
                invalid_values.as_slice(),
                &[Felt::new(u64::from(u32::MAX) + 1)?]
            );
        }
        other => panic!("expected the policy's u32 assertion, got: {other}"),
    }
    assert_unchanged(&f)?;
    Ok(())
}

#[tokio::test]
async fn zero_amount_and_zero_allowance_are_rejected() -> anyhow::Result<()> {
    // Build the zero-amount script directly: a P2ID asset itself cannot have zero amount.
    let f = fixture(100, 1_000)?;
    let script = CodeBuilder::default().with_dynamically_linked_package(&f.code)?
        .compile_tx_script("use demo::spending_policy as policy\n@transaction_script\npub proc main\npush.0.0\ncall.policy::send\ndropw dropw dropw dropw\nend")?;
    let result = f
        .chain
        .build_transaction(f.account.id())
        .tx_script(script)
        .build()?
        .execute()
        .await;
    assert_transaction_executor_error!(
        result,
        MasmError::from_static_str("spending amount must be positive")
    );
    assert_unchanged(&f)?;
    let f = fixture(0, 1_000)?;
    let result = f
        .chain
        .build_transaction(f.account.id())
        .tx_script(send_script(&f, &[1])?)
        .build()?
        .execute()
        .await;
    assert_transaction_executor_error!(
        result,
        MasmError::from_static_str("spending allowance exceeded")
    );
    assert_unchanged(&f)?;
    Ok(())
}

#[tokio::test]
async fn send_requires_an_authenticator() -> anyhow::Result<()> {
    let f = fixture(100, 1_000)?;
    let result = f
        .chain
        .build_transaction(f.account.id())
        .tx_script(send_script(&f, &[40])?)
        .authenticator(None)
        .build()?
        .execute()
        .await;
    assert!(matches!(
        result,
        Err(TransactionExecutorError::MissingAuthenticator)
    ));
    assert_unchanged(&f)?;
    Ok(())
}

#[tokio::test]
async fn wrong_falcon_signature_is_rejected() -> anyhow::Result<()> {
    let f = fixture(100, 1_000)?;
    let (_, authenticator) = Auth::basic_falcon().build_components();
    let owner_public_key = authenticator
        .unwrap()
        .keys()
        .values()
        .next()
        .unwrap()
        .1
        .as_ref()
        .clone();
    let wrong_key = miden_protocol::account::auth::AuthSecretKey::new_falcon512_poseidon2();
    let wrong_signer = BasicAuthenticator::from_key_pairs(&[(wrong_key, owner_public_key)]);
    let error = f
        .chain
        .build_transaction(f.account.id())
        .tx_script(send_script(&f, &[40])?)
        .authenticator(Some(wrong_signer))
        .build()?
        .execute()
        .await
        .expect_err("wrong Falcon key must fail verification");
    assert!(
        matches!(error, TransactionExecutorError::TransactionProgramExecutionFailed(
        ExecutionError::OperationError { err: OperationError::FailedAssertion { err_code, .. }, .. }
    ) if err_code == Felt::ZERO),
        "{error}"
    );
    assert_unchanged(&f)?;
    Ok(())
}

#[tokio::test]
async fn unrestricted_basic_wallet_send_is_not_in_the_account() -> anyhow::Result<()> {
    let f = fixture(100, 1_000)?;
    let source = format!(
        r#"
        @transaction_script
        pub proc main
            push.0
            push.{value}
            push.{id}
            call.::miden::standards::wallets::basic::move_asset_to_note
            dropw dropw dropw dropw
        end
    "#,
        value = FungibleAsset::new(f.asset.faucet_id(), 101)?.to_value_word(),
        id = f.asset.to_id_word()
    );
    let script = CodeBuilder::default().compile_tx_script(source)?;
    let error = f
        .chain
        .build_transaction(f.account.id())
        .tx_script(script)
        .build()?
        .execute()
        .await
        .expect_err("unexported send must be rejected");
    assert!(
        matches!(
            error,
            TransactionExecutorError::TransactionProgramExecutionFailed(_)
        ),
        "{error}"
    );
    assert!(
        error
            .to_string()
            .contains("is not in the account procedure index map"),
        "{error}"
    );
    assert_unchanged(&f)?;
    Ok(())
}

#[tokio::test]
async fn receiving_assets_does_not_reset_allowance() -> anyhow::Result<()> {
    let mut f = fixture(100, 1_000)?;
    let spent = f
        .chain
        .build_transaction(f.account.id())
        .tx_script(send_script(&f, &[100])?)
        .build()?
        .execute()
        .await?;
    f.chain.add_pending_executed_transaction(&spent)?;
    f.chain.prove_next_block()?;
    let received = f
        .chain
        .build_transaction(f.account.id())
        .authenticated_input_note(f.deposit.id())
        .build()?
        .execute()
        .await?;
    f.chain.add_pending_executed_transaction(&received)?;
    f.chain.prove_next_block()?;
    let committed = f.chain.committed_account(f.account.id())?;
    assert_eq!(remaining(committed)?, 0);
    assert_eq!(committed.vault().get_balance(f.asset.id())?.as_u64(), 950);
    assert!(f.chain.is_note_consumed(&f.deposit.nullifier()));
    let result = f
        .chain
        .build_transaction(f.account.id())
        .tx_script(send_script(&f, &[1])?)
        .build()?
        .execute()
        .await;
    assert_transaction_executor_error!(
        result,
        MasmError::from_static_str("spending allowance exceeded")
    );
    Ok(())
}

#[tokio::test]
async fn transaction_script_cannot_remove_assets_directly() -> anyhow::Result<()> {
    let f = fixture(100, 1_000)?;
    let source = format!(
        r#"
        use miden::protocol::native_account
        @transaction_script
        pub proc main
            push.{value}
            push.{id}
            exec.native_account::remove_asset
            dropw
        end
    "#,
        value = FungibleAsset::new(f.asset.faucet_id(), 101)?.to_value_word(),
        id = f.asset.to_id_word()
    );
    let script = CodeBuilder::default().compile_tx_script(source)?;
    let error = f
        .chain
        .build_transaction(f.account.id())
        .tx_script(script)
        .build()?
        .execute()
        .await
        .expect_err("transaction context must not mutate the vault");
    assert!(
        matches!(
            error,
            TransactionExecutorError::TransactionProgramExecutionFailed(_)
        ),
        "{error}"
    );
    assert!(
        error
            .to_string()
            .contains("is not in the account procedure index map"),
        "{error}"
    );
    assert_unchanged(&f)?;
    Ok(())
}
