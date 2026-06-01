use super::*;

pub(super) async fn list_accounts(pool: &DbPool) -> Result<Vec<Account>, String> {
    sqlx::query_as::<_, Account>("SELECT * FROM accounts")
        .fetch_all(pool)
        .await
        .map_err(|e| map_db_error(e, "récupération des comptes"))
}

pub(super) async fn insert_account(pool: &DbPool, account: Account) -> Result<(), String> {
    sqlx::query(
        "INSERT OR IGNORE INTO accounts (id, name, \"type\", \"initialBalance\", color, icon)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(account.id)
    .bind(account.name)
    .bind(account.account_type)
    .bind(account.initial_balance)
    .bind(account.color)
    .bind(account.icon)
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "ajout du compte"))?;
    Ok(())
}

pub(super) async fn update_account(pool: &DbPool, account: Account) -> Result<(), String> {
    sqlx::query(
        "UPDATE accounts
         SET name = $1, \"type\" = $2, \"initialBalance\" = $3, color = $4, icon = $5
         WHERE id = $6",
    )
    .bind(account.name)
    .bind(account.account_type)
    .bind(account.initial_balance)
    .bind(account.color)
    .bind(account.icon)
    .bind(account.id)
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "mise à jour du compte"))?;
    Ok(())
}

pub(super) async fn delete_account(pool: &DbPool, id: String) -> Result<(), String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM transactions WHERE \"accountId\" = $1")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| map_db_error(e, "suppression des transactions liées"))?;
    sqlx::query("DELETE FROM scheduled_transactions WHERE \"accountId\" = $1")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| map_db_error(e, "suppression des échéances liées"))?;
    sqlx::query("UPDATE budgets SET \"accountId\" = NULL WHERE \"accountId\" = $1")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| map_db_error(e, "déliaison des budgets liés"))?;
    sqlx::query("DELETE FROM accounts WHERE id = $1")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| map_db_error(e, "suppression du compte"))?;

    tx.commit().await.map_err(|e| e.to_string())
}
