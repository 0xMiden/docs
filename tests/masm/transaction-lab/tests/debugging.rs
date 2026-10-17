use std::sync::Arc;

use miden_protocol::assembly::DefaultSourceManager;
use miden_standards::code_builder::CodeBuilder;
use miden_testing::{Auth, MockChain};

#[test]
fn assembly_error_reports_invalid_instruction() {
    let error = CodeBuilder::default()
        .compile_tx_script("@transaction_script pub proc main pus.10 end")
        .expect_err("misspelled push must fail to compile");
    let diagnostic = error.to_string();
    println!("{diagnostic}");
    assert!(diagnostic.contains("pus"), "{diagnostic}");
    CodeBuilder::default()
        .compile_tx_script("@transaction_script pub proc main push.10 drop end")
        .expect("corrected instruction must compile");
}

#[tokio::test]
async fn assertion_reports_message_and_stack_output() -> anyhow::Result<()> {
    let source_manager = Arc::new(DefaultSourceManager::default());
    let source = r#"
use miden::core::debug
@transaction_script
pub proc main
    dropw
    push.10
    exec.debug::print_stack
    eq.11 assert.err="expected expiry delta 11"
end
"#;
    let script =
        CodeBuilder::with_source_manager(source_manager.clone()).compile_tx_script(source)?;
    let mut builder = MockChain::builder();
    let wallet = builder.add_existing_wallet(Auth::IncrNonce)?;
    let chain = builder.build()?;
    let error = chain
        .build_transaction(wallet.id())
        .tx_script(script)
        .with_source_manager(source_manager.clone())
        .build()?
        .execute()
        .await
        .expect_err("10 does not equal 11");
    let diagnostic = error.to_string();
    println!("{diagnostic}");
    assert!(
        diagnostic.contains("expected expiry delta 11"),
        "{diagnostic}"
    );
    let repaired = CodeBuilder::with_source_manager(source_manager.clone())
        .compile_tx_script(source.replace("eq.11", "eq.10"))?;
    chain
        .build_transaction(wallet.id())
        .tx_script(repaired)
        .with_source_manager(source_manager)
        .build()?
        .execute()
        .await?;
    Ok(())
}
