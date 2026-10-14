use miden_protocol::{Felt, Word, account::auth::AuthScheme};
use miden_standards::code_builder::CodeBuilder;
use miden_testing::{Auth, MockChain};
use miden_tx::TransactionExecutorError;

#[tokio::test]
async fn expiry_script_accepts_valid_arguments() -> anyhow::Result<()> {
    let mut builder = MockChain::builder();
    let wallet = builder.add_existing_wallet(Auth::BasicAuth {
        auth_scheme: AuthScheme::Falcon512Poseidon2,
    })?;
    let chain = builder.build()?;
    let script = CodeBuilder::default().compile_tx_script(include_str!("../expiry.masm"))?;
    let reference = chain.latest_block_header().block_num().as_u32();

    let executed = chain
        .build_transaction(wallet.id())
        .tx_script(script)
        .tx_script_args(Word::from([10u32, 0, 0, 0]))
        .build()?
        .execute()
        .await?;

    assert_eq!(executed.expiration_block_num().as_u32(), reference + 10);
    assert_eq!(executed.final_account().nonce(), wallet.nonce() + Felt::ONE);
    assert!(executed.output_notes().is_empty());
    Ok(())
}

#[tokio::test]
async fn expiry_script_rejects_invalid_arguments() -> anyhow::Result<()> {
    for (delta, message) in [
        (0u32, "expiry delta must be positive"),
        (65u32, "expiry delta exceeds 64 blocks"),
    ] {
        let mut builder = MockChain::builder();
        let wallet = builder.add_existing_wallet(Auth::BasicAuth {
            auth_scheme: AuthScheme::Falcon512Poseidon2,
        })?;
        let chain = builder.build()?;
        let script = CodeBuilder::default().compile_tx_script(include_str!("../expiry.masm"))?;
        let error = chain
            .build_transaction(wallet.id())
            .tx_script(script)
            .tx_script_args(Word::from([delta, 0, 0, 0]))
            .build()?
            .execute()
            .await
            .expect_err("invalid expiry delta must fail");
        assert!(matches!(
            error,
            TransactionExecutorError::TransactionProgramExecutionFailed(_)
        ));
        let diagnostic = error.to_string();
        assert!(diagnostic.contains(message), "{diagnostic}");
        println!("{diagnostic}");
        assert_eq!(
            chain.committed_account(wallet.id())?.nonce(),
            wallet.nonce()
        );
    }
    Ok(())
}
