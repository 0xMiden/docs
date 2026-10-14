use miden_protocol::Word;
use miden_protocol::account::component::AccountComponentMetadata;
use miden_protocol::account::{AccountComponent, StorageSlot, StorageSlotName};
use miden_standards::code_builder::CodeBuilder;
use miden_testing::{Auth, MockChain};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let slot = StorageSlotName::new("demo::settings::value")?;
    let code = CodeBuilder::default()
        .compile_component_code("demo::settings", include_str!("../masm/settings.masm"))?;
    let component = AccountComponent::new(
        code.clone(),
        vec![StorageSlot::with_value(
            slot.clone(),
            Word::from([7u32, 0, 0, 0]),
        )],
        AccountComponentMetadata::new("Settings"),
    )?;
    assert_eq!(component.procedures().count(), 2);

    let mut builder = MockChain::builder();
    let account =
        builder.add_existing_account_from_components(Auth::basic_falcon(), [component])?;
    let chain = builder.build()?;
    assert_eq!(
        account.storage().get_item(&slot)?,
        Word::from([7u32, 0, 0, 0])
    );

    let script = CodeBuilder::default()
        .with_dynamically_linked_package(&code)?
        .compile_tx_script(include_str!("../masm/update.masm"))?;
    let executed = chain
        .build_transaction(account.id())
        .tx_script(script)
        .build()?
        .execute()
        .await?;
    let mut updated = account;
    updated.apply_patch(executed.account_patch())?;
    assert_eq!(
        updated.storage().get_item(&slot)?,
        Word::from([42u32, 0, 0, 0])
    );
    println!("settings value: 7 -> 42");
    Ok(())
}
