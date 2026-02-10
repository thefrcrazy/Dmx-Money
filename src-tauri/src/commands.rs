use crate::db::DbPool;
use crate::models::{
    Account, AppData, Category, ScheduledTransaction, Settings, Transaction, WindowPosition,
    WindowSize,
};
use tauri::{command, State};

// Helper to map SQLx errors to user-friendly strings
fn map_db_error(e: sqlx::Error, context: &str) -> String {
    let err_msg = e.to_string();
    println!("Database Error during {context}: {err_msg}");
    
    if err_msg.contains("FOREIGN KEY constraint failed") {
        return "Impossible de supprimer cet élément car il est utilisé ailleurs.".to_string();
    }
    if err_msg.contains("UNIQUE constraint failed") {
        return "Un élément avec cet identifiant existe déjà.".to_string();
    }
    
    format!("Erreur BDD ({context}): {err_msg}")
}

// --- Accounts ---
#[command]
pub async fn get_accounts(pool: State<'_, DbPool>) -> Result<Vec<Account>, String> {
    println!("Invoked get_accounts");
    sqlx::query_as::<_, Account>("SELECT * FROM accounts")
        .fetch_all(&*pool)
        .await
        .map_err(|e| map_db_error(e, "récupération des comptes"))
}

#[command]
pub async fn add_account(pool: State<'_, DbPool>, account: Account) -> Result<(), String> {
    println!("Invoked add_account: {account:?}");
    sqlx::query(
        "INSERT OR IGNORE INTO accounts (id, name, \"type\", \"initialBalance\", color, icon) VALUES ($1, $2, $3, $4, $5, $6)"
    )
    .bind(account.id)
    .bind(account.name)
    .bind(account.account_type)
    .bind(account.initial_balance)
    .bind(account.color)
    .bind(account.icon)
    .execute(&*pool)
    .await
    .map_err(|e| map_db_error(e, "ajout du compte"))?;
    Ok(())
}

#[command]
pub async fn update_account(pool: State<'_, DbPool>, account: Account) -> Result<(), String> {
    println!("Invoked update_account: {account:?}");
    sqlx::query(
        "UPDATE accounts SET name = $1, \"type\" = $2, \"initialBalance\" = $3, color = $4, icon = $5 WHERE id = $6"
    )
    .bind(account.name)
    .bind(account.account_type)
    .bind(account.initial_balance)
    .bind(account.color)
    .bind(account.icon)
    .bind(account.id)
    .execute(&*pool)
    .await
    .map_err(|e| map_db_error(e, "mise à jour du compte"))?;
    Ok(())
}

#[command]
pub async fn delete_account(pool: State<'_, DbPool>, id: String) -> Result<(), String> {
    println!("Invoked delete_account: {id}");
    // Transactional delete
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

    sqlx::query("DELETE FROM accounts WHERE id = $1")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| map_db_error(e, "suppression du compte"))?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

// --- Transactions ---
#[command]
pub async fn get_transactions(pool: State<'_, DbPool>) -> Result<Vec<Transaction>, String> {
    println!("Invoked get_transactions");
    sqlx::query_as::<_, Transaction>("SELECT * FROM transactions ORDER BY date DESC")
        .fetch_all(&*pool)
        .await
        .map_err(|e| map_db_error(e, "récupération des transactions"))
}

#[command]
pub async fn add_transaction(
    pool: State<'_, DbPool>,
    transaction: Transaction,
) -> Result<(), String> {
    println!("Invoked add_transaction: {transaction:?}");
    sqlx::query(
        "INSERT INTO transactions (id, date, \"accountId\", \"type\", amount, category, description, checked, \"isTransfer\", \"linkedTransactionId\") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)"
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
    .execute(&*pool)
    .await
    .map_err(|e| map_db_error(e, "ajout de transaction"))?;
    Ok(())
}

#[command]
pub async fn update_transaction(
    pool: State<'_, DbPool>,
    transaction: Transaction,
) -> Result<(), String> {
    println!("Invoked update_transaction: {transaction:?}");
    sqlx::query(
        "UPDATE transactions SET date = $1, \"accountId\" = $2, \"type\" = $3, amount = $4, category = $5, description = $6, checked = $7, \"isTransfer\" = $8, \"linkedTransactionId\" = $9 WHERE id = $10"
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
    .execute(&*pool)
    .await
    .map_err(|e| map_db_error(e, "mise à jour de transaction"))?;
    Ok(())
}

#[command]
pub async fn delete_transaction(pool: State<'_, DbPool>, id: String) -> Result<(), String> {
    println!("Invoked delete_transaction: {id}");
    sqlx::query("DELETE FROM transactions WHERE id = $1")
        .bind(id)
        .execute(&*pool)
        .await
        .map_err(|e| map_db_error(e, "suppression de transaction"))?;
    Ok(())
}

// --- Categories ---
#[command]
pub async fn get_categories(pool: State<'_, DbPool>) -> Result<Vec<Category>, String> {
    println!("Invoked get_categories");
    sqlx::query_as::<_, Category>("SELECT * FROM categories")
        .fetch_all(&*pool)
        .await
        .map_err(|e| map_db_error(e, "récupération des catégories"))
}

#[command]
pub async fn add_category(pool: State<'_, DbPool>, category: Category) -> Result<(), String> {
    println!("Invoked add_category: {category:?}");
    sqlx::query("INSERT OR IGNORE INTO categories (id, name, icon, color) VALUES ($1, $2, $3, $4)")
        .bind(category.id)
        .bind(category.name)
        .bind(category.icon)
        .bind(category.color)
        .execute(&*pool)
        .await
        .map_err(|e| map_db_error(e, "ajout de catégorie"))?;
    Ok(())
}

#[command]
pub async fn update_category(pool: State<'_, DbPool>, category: Category) -> Result<(), String> {
    println!("Invoked update_category: {category:?}");
    sqlx::query("UPDATE categories SET name = $1, icon = $2, color = $3 WHERE id = $4")
        .bind(category.name)
        .bind(category.icon)
        .bind(category.color)
        .bind(category.id)
        .execute(&*pool)
        .await
        .map_err(|e| map_db_error(e, "mise à jour de catégorie"))?;
    Ok(())
}

#[command]
pub async fn delete_category(pool: State<'_, DbPool>, id: String) -> Result<(), String> {
    println!("Invoked delete_category: {id}");
    sqlx::query("DELETE FROM categories WHERE id = $1")
        .bind(id)
        .execute(&*pool)
        .await
        .map_err(|e| map_db_error(e, "suppression de catégorie"))?;
    Ok(())
}

// --- Scheduled Transactions ---
#[command]
pub async fn get_scheduled(pool: State<'_, DbPool>) -> Result<Vec<ScheduledTransaction>, String> {
    println!("Invoked get_scheduled");
    sqlx::query_as::<_, ScheduledTransaction>("SELECT * FROM scheduled_transactions")
        .fetch_all(&*pool)
        .await
        .map_err(|e| map_db_error(e, "récupération des échéances"))
}

#[command]
pub async fn add_scheduled(
    pool: State<'_, DbPool>,
    scheduled: ScheduledTransaction,
) -> Result<(), String> {
    println!("Invoked add_scheduled: {scheduled:?}");
    sqlx::query(
        "INSERT INTO scheduled_transactions (id, description, amount, \"type\", frequency, \"accountId\", \"nextDate\", category, \"toAccountId\", \"includeInForecast\", \"endDate\") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)"
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
    .bind(scheduled.end_date)
    .execute(&*pool)
    .await
    .map_err(|e| map_db_error(e, "ajout d'échéance"))?;
    Ok(())
}

#[command]
pub async fn update_scheduled(
    pool: State<'_, DbPool>,
    scheduled: ScheduledTransaction,
) -> Result<(), String> {
    println!("Invoked update_scheduled: {scheduled:?}");
    sqlx::query(
        "UPDATE scheduled_transactions SET description = $1, amount = $2, \"type\" = $3, frequency = $4, \"accountId\" = $5, \"nextDate\" = $6, category = $7, \"toAccountId\" = $8, \"includeInForecast\" = $9, \"endDate\" = $10 WHERE id = $11"
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
    .bind(scheduled.end_date)
    .bind(scheduled.id)
    .execute(&*pool)
    .await
    .map_err(|e| map_db_error(e, "mise à jour d'échéance"))?;
    Ok(())
}

#[command]
pub async fn delete_scheduled(pool: State<'_, DbPool>, id: String) -> Result<(), String> {
    println!("Invoked delete_scheduled: {id}");
    sqlx::query("DELETE FROM scheduled_transactions WHERE id = $1")
        .bind(id)
        .execute(&*pool)
        .await
        .map_err(|e| map_db_error(e, "suppression d'échéance"))?;
    Ok(())
}

// --- Import Data ---
#[command]
pub async fn import_data(pool: State<'_, DbPool>, data: AppData) -> Result<(), String> {
    println!("Invoked import_data with {} accounts", data.accounts.len());
    let mut tx = pool.begin().await.map_err(|e| map_db_error(e, "début de transaction d'import"))?;

    // STEP 1: DELETE ALL EXISTING DATA
    println!("Clearing existing database data...");
    
    sqlx::query("DELETE FROM transactions")
        .execute(&mut *tx)
        .await
        .map_err(|e| map_db_error(e, "nettoyage des transactions"))?;
    
    sqlx::query("DELETE FROM scheduled_transactions")
        .execute(&mut *tx)
        .await
        .map_err(|e| map_db_error(e, "nettoyage des échéances"))?;
    
    sqlx::query("DELETE FROM accounts")
        .execute(&mut *tx)
        .await
        .map_err(|e| map_db_error(e, "nettoyage des comptes"))?;
    
    sqlx::query("DELETE FROM categories")
        .execute(&mut *tx)
        .await
        .map_err(|e| map_db_error(e, "nettoyage des catégories"))?;

    // STEP 2: INSERT NEW DATA
    for acc in data.accounts {
        sqlx::query(
            "INSERT INTO accounts (id, name, \"type\", \"initialBalance\", color, icon) VALUES ($1, $2, $3, $4, $5, $6)"
        )
        .bind(acc.id)
        .bind(acc.name)
        .bind(acc.account_type)
        .bind(acc.initial_balance)
        .bind(acc.color)
        .bind(acc.icon)
        .execute(&mut *tx)
        .await
        .map_err(|e| map_db_error(e, "import de compte"))?;
    }

    for cat in data.categories {
        sqlx::query("INSERT INTO categories (id, name, icon, color) VALUES ($1, $2, $3, $4)")
            .bind(cat.id)
            .bind(cat.name)
            .bind(cat.icon)
            .bind(cat.color)
            .execute(&mut *tx)
            .await
            .map_err(|e| map_db_error(e, "import de catégorie"))?;
    }

    for t in data.transactions {
        sqlx::query(
            "INSERT INTO transactions (id, date, \"accountId\", \"type\", amount, category, description, checked, \"isTransfer\", \"linkedTransactionId\") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)"
        )
        .bind(t.id)
        .bind(t.date)
        .bind(t.account_id)
        .bind(t.transaction_type)
        .bind(t.amount)
        .bind(t.category)
        .bind(t.description)
        .bind(t.checked)
        .bind(t.is_transfer)
        .bind(t.linked_transaction_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| map_db_error(e, "import de transaction"))?;
    }

    for s in data.scheduled {
        sqlx::query(
            "INSERT INTO scheduled_transactions (id, description, amount, \"type\", frequency, \"accountId\", \"nextDate\", category, \"toAccountId\", \"includeInForecast\", \"endDate\") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)"
        )
        .bind(s.id)
        .bind(s.description)
        .bind(s.amount)
        .bind(s.transaction_type)
        .bind(s.frequency)
        .bind(s.account_id)
        .bind(s.next_date)
        .bind(s.category)
        .bind(s.to_account_id)
        .bind(s.include_in_forecast)
        .bind(s.end_date)
        .execute(&mut *tx)
        .await
        .map_err(|e| map_db_error(e, "import d'échéance"))?;
    }

    tx.commit().await.map_err(|e| map_db_error(e, "validation finale de l'import"))?;
    println!("Import data completed successfully");
    Ok(())
}

// --- Settings ---
#[command]
pub async fn get_settings(pool: State<'_, DbPool>) -> Result<Option<Settings>, String> {
    println!("Invoked get_settings");

    #[derive(sqlx::FromRow)]
    struct SettingsRow {
        theme: String,
        #[sqlx(rename = "primaryColor")]
        primary_color: String,
        #[sqlx(rename = "displayStyle")]
        display_style: String,
        #[sqlx(rename = "windowPositionX")]
        window_position_x: Option<i32>,
        #[sqlx(rename = "windowPositionY")]
        window_position_y: Option<i32>,
        #[sqlx(rename = "windowSizeWidth")]
        window_size_width: Option<i32>,
        #[sqlx(rename = "windowSizeHeight")]
        window_size_height: Option<i32>,
        #[sqlx(rename = "accountGroups")]
        account_groups: Option<String>,
        #[sqlx(rename = "customGroups")]
        custom_groups: Option<String>,
        #[sqlx(rename = "customGroupsOrder")]
        custom_groups_order: Option<String>,
        #[sqlx(rename = "accountsOrder")]
        accounts_order: Option<String>,
        #[sqlx(rename = "lastSeenVersion")]
        last_seen_version: Option<String>,
        #[sqlx(rename = "componentSpacing")]
        component_spacing: i32,
        #[sqlx(rename = "componentPadding")]
        component_padding: i32,
    }

    match sqlx::query_as::<_, SettingsRow>("SELECT * FROM settings WHERE id = 1")
        .fetch_optional(&*pool)
        .await
        .map_err(|e| map_db_error(e, "récupération des paramètres"))?
    {
        Some(row) => {
            let window_position =
                if let (Some(x), Some(y)) = (row.window_position_x, row.window_position_y) {
                    Some(WindowPosition { x, y })
                } else {
                    None
                };

            let window_size = if let (Some(width), Some(height)) =
                (row.window_size_width, row.window_size_height)
            {
                Some(WindowSize { width, height })
            } else {
                None
            };

            Ok(Some(Settings {
                theme: row.theme,
                primary_color: row.primary_color,
                display_style: row.display_style,
                window_position,
                window_size,
                account_groups: row.account_groups,
                custom_groups: row.custom_groups,
                custom_groups_order: row.custom_groups_order,
                accounts_order: row.accounts_order,
                last_seen_version: row.last_seen_version,
                component_spacing: row.component_spacing,
                component_padding: row.component_padding,
            }))
        }
        None => Ok(None),
    }
}

#[command]
pub async fn save_settings(pool: State<'_, DbPool>, settings: Settings) -> Result<(), String> {
    println!("Invoked save_settings: {settings:?}");

    let (pos_x, pos_y) = if let Some(pos) = settings.window_position {
        (Some(pos.x), Some(pos.y))
    } else {
        (None, None)
    };

    let (size_w, size_h) = if let Some(size) = settings.window_size {
        (Some(size.width), Some(size.height))
    } else {
        (None, None)
    };

    sqlx::query(
        "INSERT INTO settings (id, theme, \"primaryColor\", \"displayStyle\", \"windowPositionX\", \"windowPositionY\", \"windowSizeWidth\", \"windowSizeHeight\", \"accountGroups\", \"customGroups\", \"customGroupsOrder\", \"accountsOrder\", \"lastSeenVersion\", \"componentSpacing\", \"componentPadding\")
         VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT(id) DO UPDATE SET
            theme = $1,
            \"primaryColor\" = $2,
            \"displayStyle\" = $3,
            \"windowPositionX\" = $4,
            \"windowPositionY\" = $5,
            \"windowSizeWidth\" = $6,
            \"windowSizeHeight\" = $7,
            \"accountGroups\" = $8,
            \"customGroups\" = $9,
            \"customGroupsOrder\" = $10,
            \"accountsOrder\" = $11,
            \"lastSeenVersion\" = $12,
            \"componentSpacing\" = $13,
            \"componentPadding\" = $14"
    )
    .bind(settings.theme)
    .bind(settings.primary_color)
    .bind(settings.display_style)
    .bind(pos_x)
    .bind(pos_y)
    .bind(size_w)
    .bind(size_h)
    .bind(settings.account_groups)
    .bind(settings.custom_groups)
    .bind(settings.custom_groups_order)
    .bind(settings.accounts_order)
    .bind(settings.last_seen_version)
    .bind(settings.component_spacing)
    .bind(settings.component_padding)
    .execute(&*pool)
    .await
    .map_err(|e| map_db_error(e, "sauvegarde des paramètres"))?;

    Ok(())
}