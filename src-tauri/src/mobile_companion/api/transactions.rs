use super::*;

pub(super) async fn list_transactions(pool: &DbPool) -> Result<Vec<Transaction>, String> {
    sqlx::query_as::<_, Transaction>("SELECT * FROM transactions ORDER BY date DESC, rowid DESC")
        .fetch_all(pool)
        .await
        .map_err(|e| map_db_error(e, "récupération des transactions"))
}

pub(super) async fn insert_transaction(
    pool: &DbPool,
    transaction: Transaction,
) -> Result<(), String> {
    sqlx::query(
        "INSERT OR IGNORE INTO transactions
        (id, date, \"accountId\", \"type\", amount, category, description, checked, \"isTransfer\", \"linkedTransactionId\")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
    )
    .bind(transaction.id)
    .bind(transaction.date)
    .bind(transaction.account_id)
    .bind(transaction.transaction_type)
    .bind(transaction.amount)
    .bind(transaction.category)
    .bind(transaction.description)
    .bind(transaction.checked)
    .bind(transaction.is_transfer)
    .bind(transaction.linked_transaction_id)
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "ajout de transaction"))?;
    Ok(())
}

pub(super) async fn update_transaction(
    pool: &DbPool,
    transaction: Transaction,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE transactions
         SET date = $1, \"accountId\" = $2, \"type\" = $3, amount = $4, category = $5,
             description = $6, checked = $7, \"isTransfer\" = $8, \"linkedTransactionId\" = $9
         WHERE id = $10",
    )
    .bind(transaction.date)
    .bind(transaction.account_id)
    .bind(transaction.transaction_type)
    .bind(transaction.amount)
    .bind(transaction.category)
    .bind(transaction.description)
    .bind(transaction.checked)
    .bind(transaction.is_transfer)
    .bind(transaction.linked_transaction_id)
    .bind(transaction.id)
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "mise à jour de transaction"))?;
    Ok(())
}

pub(super) async fn delete_transaction(pool: &DbPool, id: String) -> Result<(), String> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| map_db_error(e, "début de suppression de transaction"))?;

    let linked_transaction_id: Option<String> =
        sqlx::query_scalar("SELECT \"linkedTransactionId\" FROM transactions WHERE id = $1")
            .bind(&id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| map_db_error(e, "récupération du virement lié"))?
            .flatten();

    if let Some(linked_id) = linked_transaction_id {
        sqlx::query("DELETE FROM transactions WHERE id = $1 OR id = $2")
            .bind(&id)
            .bind(linked_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| map_db_error(e, "suppression du virement lié"))?;
    } else {
        sqlx::query("DELETE FROM transactions WHERE id = $1")
            .bind(&id)
            .execute(&mut *tx)
            .await
            .map_err(|e| map_db_error(e, "suppression de transaction"))?;
    }

    tx.commit()
        .await
        .map_err(|e| map_db_error(e, "suppression de transaction"))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct TransferPayload {
    pub(super) from_transaction: Transaction,
    pub(super) to_transaction: Transaction,
}

pub(super) async fn insert_transfer(pool: &DbPool, payload: TransferPayload) -> Result<(), String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    insert_transaction_in_tx(&mut tx, payload.from_transaction).await?;
    insert_transaction_in_tx(&mut tx, payload.to_transaction).await?;
    tx.commit().await.map_err(|e| e.to_string())
}

pub(super) async fn insert_transaction_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    transaction: Transaction,
) -> Result<(), String> {
    sqlx::query(
        "INSERT OR IGNORE INTO transactions
        (id, date, \"accountId\", \"type\", amount, category, description, checked, \"isTransfer\", \"linkedTransactionId\")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
    )
    .bind(transaction.id)
    .bind(transaction.date)
    .bind(transaction.account_id)
    .bind(transaction.transaction_type)
    .bind(transaction.amount)
    .bind(transaction.category)
    .bind(transaction.description)
    .bind(transaction.checked)
    .bind(transaction.is_transfer)
    .bind(transaction.linked_transaction_id)
    .execute(&mut **tx)
    .await
    .map_err(|e| map_db_error(e, "ajout de transaction"))?;
    Ok(())
}
