use super::*;

pub(super) async fn list_scheduled(pool: &DbPool) -> Result<Vec<ScheduledTransaction>, String> {
    sqlx::query_as::<_, ScheduledTransaction>("SELECT * FROM scheduled_transactions")
        .fetch_all(pool)
        .await
        .map_err(|e| map_db_error(e, "récupération des échéances"))
}

pub(super) async fn insert_scheduled(
    pool: &DbPool,
    scheduled: ScheduledTransaction,
) -> Result<(), String> {
    sqlx::query(
        "INSERT OR IGNORE INTO scheduled_transactions
        (id, description, amount, \"type\", frequency, \"accountId\", \"nextDate\", category,
         \"toAccountId\", \"includeInForecast\", \"budgetId\", \"endDate\")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
    )
    .bind(scheduled.id)
    .bind(scheduled.description)
    .bind(scheduled.amount)
    .bind(scheduled.transaction_type)
    .bind(scheduled.frequency)
    .bind(scheduled.account_id)
    .bind(scheduled.next_date)
    .bind(scheduled.category)
    .bind(scheduled.to_account_id)
    .bind(scheduled.include_in_forecast)
    .bind(scheduled.budget_id)
    .bind(scheduled.end_date)
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "ajout d'échéance"))?;
    Ok(())
}

pub(super) async fn update_scheduled(
    pool: &DbPool,
    scheduled: ScheduledTransaction,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE scheduled_transactions
         SET description = $1, amount = $2, \"type\" = $3, frequency = $4, \"accountId\" = $5,
             \"nextDate\" = $6, category = $7, \"toAccountId\" = $8, \"includeInForecast\" = $9,
             \"budgetId\" = $10, \"endDate\" = $11
         WHERE id = $12",
    )
    .bind(scheduled.description)
    .bind(scheduled.amount)
    .bind(scheduled.transaction_type)
    .bind(scheduled.frequency)
    .bind(scheduled.account_id)
    .bind(scheduled.next_date)
    .bind(scheduled.category)
    .bind(scheduled.to_account_id)
    .bind(scheduled.include_in_forecast)
    .bind(scheduled.budget_id)
    .bind(scheduled.end_date)
    .bind(scheduled.id)
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "mise à jour d'échéance"))?;
    Ok(())
}

pub(super) async fn delete_scheduled(pool: &DbPool, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM scheduled_transactions WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| map_db_error(e, "suppression d'échéance"))?;
    Ok(())
}

pub(super) async fn process_due_scheduled(pool: &DbPool) -> Result<usize, String> {
    let mut scheduled_items = list_scheduled(pool).await?;
    let today = Local::now().date_naive();
    let mut processed = 0usize;

    for item in scheduled_items.iter_mut() {
        let mut next_date = parse_date(&item.next_date)?;
        let mut changed = false;

        while next_date <= today {
            changed = true;
            let occurrence_date = item.next_date.clone();

            if let Some(end_date) = &item.end_date {
                if next_date > parse_date(end_date)? {
                    break;
                }
            }

            if item.transaction_type == "transfer" {
                if let Some(to_account_id) = item.to_account_id.clone() {
                    let from_id = scheduled_transaction_id(&item.id, &occurrence_date, "from");
                    let to_id = scheduled_transaction_id(&item.id, &occurrence_date, "to");
                    insert_transfer(
                        pool,
                        TransferPayload {
                            from_transaction: Transaction {
                                id: from_id.clone(),
                                date: occurrence_date.clone(),
                                account_id: item.account_id.clone(),
                                transaction_type: "expense".to_string(),
                                amount: item.amount,
                                category: "transfer".to_string(),
                                description: Some(item.description.clone()),
                                checked: false,
                                is_transfer: true,
                                linked_transaction_id: Some(to_id.clone()),
                            },
                            to_transaction: Transaction {
                                id: to_id,
                                date: occurrence_date.clone(),
                                account_id: to_account_id,
                                transaction_type: "income".to_string(),
                                amount: item.amount,
                                category: "transfer".to_string(),
                                description: Some(item.description.clone()),
                                checked: false,
                                is_transfer: true,
                                linked_transaction_id: Some(from_id),
                            },
                        },
                    )
                    .await?;
                    processed += 2;
                }
            } else {
                insert_transaction(
                    pool,
                    Transaction {
                        id: scheduled_transaction_id(&item.id, &occurrence_date, "single"),
                        date: occurrence_date,
                        account_id: item.account_id.clone(),
                        transaction_type: item.transaction_type.clone(),
                        amount: item.amount,
                        category: item.category.clone(),
                        description: Some(item.description.clone()),
                        checked: false,
                        is_transfer: false,
                        linked_transaction_id: None,
                    },
                )
                .await?;
                processed += 1;
            }

            next_date = next_scheduled_date(next_date, &item.frequency);
            item.next_date = next_date.format("%Y-%m-%d").to_string();
        }

        if changed {
            if item.frequency == "once" {
                delete_scheduled(pool, item.id.clone()).await?;
            } else {
                update_scheduled(pool, item.clone()).await?;
            }
        }
    }

    Ok(processed)
}

fn scheduled_transaction_id(scheduled_id: &str, occurrence_date: &str, side: &str) -> String {
    format!("scheduled:{scheduled_id}:{occurrence_date}:{side}")
}

fn parse_date(value: &str) -> Result<NaiveDate, String> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|e| format!("Date invalide ({value}): {e}"))
}

fn next_scheduled_date(date: NaiveDate, frequency: &str) -> NaiveDate {
    match frequency {
        "once" => date
            .with_year(date.year() + 100)
            .unwrap_or_else(|| date + chrono::Duration::days(36500)),
        "daily" => date + chrono::Duration::days(1),
        "weekly" => date + chrono::Duration::days(7),
        "biweekly" => date + chrono::Duration::days(14),
        "bimonthly" => date + chrono::Duration::days(15),
        "fourweekly" => date + chrono::Duration::days(28),
        "monthly" => date.checked_add_months(Months::new(1)).unwrap_or(date),
        "bimestrial" => date.checked_add_months(Months::new(2)).unwrap_or(date),
        "quarterly" => date.checked_add_months(Months::new(3)).unwrap_or(date),
        "fourmonthly" => date.checked_add_months(Months::new(4)).unwrap_or(date),
        "semiannual" => date.checked_add_months(Months::new(6)).unwrap_or(date),
        "annual" => date
            .with_year(date.year() + 1)
            .unwrap_or_else(|| date + chrono::Duration::days(365)),
        "biennial" => date
            .with_year(date.year() + 2)
            .unwrap_or_else(|| date + chrono::Duration::days(730)),
        _ => date.checked_add_months(Months::new(1)).unwrap_or(date),
    }
}
