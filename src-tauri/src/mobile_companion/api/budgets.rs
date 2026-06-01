use super::*;

pub(super) async fn list_budgets(pool: &DbPool) -> Result<Vec<Budget>, String> {
    sqlx::query_as::<_, Budget>("SELECT * FROM budgets ORDER BY rowid DESC")
        .fetch_all(pool)
        .await
        .map_err(|e| map_db_error(e, "récupération des budgets"))
}

pub(super) async fn insert_budget(pool: &DbPool, budget: Budget) -> Result<(), String> {
    sqlx::query(
        "INSERT OR IGNORE INTO budgets (id, name, amount, category, \"accountId\")
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(budget.id)
    .bind(budget.name)
    .bind(budget.amount)
    .bind(budget.category)
    .bind(budget.account_id)
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "ajout de budget"))?;
    Ok(())
}

pub(super) async fn update_budget(pool: &DbPool, budget: Budget) -> Result<(), String> {
    sqlx::query(
        "UPDATE budgets SET name = $1, amount = $2, category = $3, \"accountId\" = $4 WHERE id = $5",
    )
    .bind(budget.name)
    .bind(budget.amount)
    .bind(budget.category)
    .bind(budget.account_id)
    .bind(budget.id)
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "mise à jour de budget"))?;
    Ok(())
}

pub(super) async fn delete_budget(pool: &DbPool, id: String) -> Result<(), String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query("UPDATE scheduled_transactions SET \"budgetId\" = NULL, \"includeInForecast\" = 0 WHERE \"budgetId\" = $1")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| map_db_error(e, "déliaison des échéances du budget"))?;
    sqlx::query("DELETE FROM budgets WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| map_db_error(e, "suppression de budget"))?;

    tx.commit().await.map_err(|e| e.to_string())
}
