use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite};
use std::fs;
use tauri::Manager;

pub type DbPool = Pool<Sqlite>;

pub async fn init_db(app_handle: &tauri::AppHandle) -> Result<DbPool, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    if !app_dir.exists() {
        fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    }

    let db_path = app_dir.join("dmxmoney2025.db");
    let db_url = format!("sqlite://{}", db_path.to_string_lossy());

    if !db_path.exists() {
        fs::File::create(&db_path).map_err(|e| e.to_string())?;
    }

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .map_err(|e| e.to_string())?;

    create_tables(&pool).await.map_err(|e| e.to_string())?;

    Ok(pool)
}

async fn create_tables(pool: &DbPool) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            \"type\" TEXT NOT NULL,
            \"initialBalance\" REAL NOT NULL,
            color TEXT,
            icon TEXT
        )",
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            \"accountId\" TEXT NOT NULL,
            \"type\" TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            description TEXT,
            checked BOOLEAN DEFAULT 0,
            \"isTransfer\" BOOLEAN DEFAULT 0,
            \"linkedTransactionId\" TEXT,
            FOREIGN KEY(\"accountId\") REFERENCES accounts(id)
        )",
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            icon TEXT NOT NULL,
            color TEXT NOT NULL
        )",
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS scheduled_transactions (
            id TEXT PRIMARY KEY,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            \"type\" TEXT NOT NULL,
            frequency TEXT NOT NULL,
            \"accountId\" TEXT NOT NULL,
            \"nextDate\" TEXT NOT NULL,
            category TEXT NOT NULL,
            FOREIGN KEY(\"accountId\") REFERENCES accounts(id)
        )",
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            theme TEXT NOT NULL DEFAULT 'system',
            \"primaryColor\" TEXT NOT NULL DEFAULT '#6366f1',
            \"displayStyle\" TEXT NOT NULL DEFAULT 'modern',
            \"windowPositionX\" INTEGER,
            \"windowPositionY\" INTEGER,
            \"windowSizeWidth\" INTEGER,
            \"windowSizeHeight\" INTEGER,
            \"componentSpacing\" INTEGER NOT NULL DEFAULT 6,
            \"componentPadding\" INTEGER NOT NULL DEFAULT 6
        )",
    )
    .execute(&mut *tx)
    .await?;

    // Migration: Add displayStyle column if it doesn't exist
    let has_display_style: bool = sqlx::query_scalar(
        "SELECT count(*) FROM pragma_table_info('settings') WHERE name='displayStyle'",
    )
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0)
        > 0;

    if !has_display_style {
        println!("Migrating settings table: adding displayStyle column");
        sqlx::query(
            "ALTER TABLE settings ADD COLUMN \"displayStyle\" TEXT NOT NULL DEFAULT 'modern'",
        )
        .execute(&mut *tx)
        .await?;
    }

    // Migration: Add componentSpacing column if it doesn't exist
    let has_component_spacing: bool = sqlx::query_scalar(
        "SELECT count(*) FROM pragma_table_info('settings') WHERE name='componentSpacing'",
    )
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0)
        > 0;

    if !has_component_spacing {
        println!("Migrating settings table: adding componentSpacing column");
        sqlx::query("ALTER TABLE settings ADD COLUMN \"componentSpacing\" INTEGER NOT NULL DEFAULT 6")
            .execute(&mut *tx)
            .await?;
    }

    // Migration: Add componentPadding column if it doesn't exist
    let has_component_padding: bool = sqlx::query_scalar(
        "SELECT count(*) FROM pragma_table_info('settings') WHERE name='componentPadding'",
    )
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0)
        > 0;

    if !has_component_padding {
        println!("Migrating settings table: adding componentPadding column");
        sqlx::query("ALTER TABLE settings ADD COLUMN \"componentPadding\" INTEGER NOT NULL DEFAULT 6")
            .execute(&mut *tx)
            .await?;
    }

    // Migration: Add accountGroups column to settings
    let has_account_groups: bool = sqlx::query_scalar(
        "SELECT count(*) FROM pragma_table_info('settings') WHERE name='accountGroups'",
    )
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0)
        > 0;


    if !has_account_groups {
        println!("Migrating settings table: adding accountGroups column");
        sqlx::query("ALTER TABLE settings ADD COLUMN \"accountGroups\" TEXT")
            .execute(&mut *tx)
            .await?;
    }

    // Migration: Add customGroups column to settings
    let has_custom_groups: bool = sqlx::query_scalar(
        "SELECT count(*) FROM pragma_table_info('settings') WHERE name='customGroups'",
    )
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0)
        > 0;

    if !has_custom_groups {
        println!("Migrating settings table: adding customGroups column");
        sqlx::query("ALTER TABLE settings ADD COLUMN \"customGroups\" TEXT")
            .execute(&mut *tx)
            .await?;
    }

    // Migration: Add customGroupsOrder column to settings
    let has_custom_groups_order: bool = sqlx::query_scalar(
        "SELECT count(*) FROM pragma_table_info('settings') WHERE name='customGroupsOrder'",
    )
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0)
        > 0;

    if !has_custom_groups_order {
        println!("Migrating settings table: adding customGroupsOrder column");
        sqlx::query("ALTER TABLE settings ADD COLUMN \"customGroupsOrder\" TEXT")
            .execute(&mut *tx)
            .await?;
    }

    // Migration: Add accountsOrder column to settings
    let has_accounts_order: bool = sqlx::query_scalar(
        "SELECT count(*) FROM pragma_table_info('settings') WHERE name='accountsOrder'",
    )
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0)
        > 0;

    if !has_accounts_order {
        println!("Migrating settings table: adding accountsOrder column");
        sqlx::query("ALTER TABLE settings ADD COLUMN \"accountsOrder\" TEXT")
            .execute(&mut *tx)
            .await?;
    }

    // Migration: Add toAccountId to scheduled_transactions
    let has_to_account_id: bool = sqlx::query_scalar(
        "SELECT count(*) FROM pragma_table_info('scheduled_transactions') WHERE name='toAccountId'",
    )
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0)
        > 0;

    if !has_to_account_id {
        println!("Migrating scheduled_transactions table: adding toAccountId column");
        sqlx::query("ALTER TABLE scheduled_transactions ADD COLUMN \"toAccountId\" TEXT")
            .execute(&mut *tx)
            .await?;
    }

    // Migration: Add includeInForecast to scheduled_transactions
    let has_include_in_forecast: bool = sqlx::query_scalar(
        "SELECT count(*) FROM pragma_table_info('scheduled_transactions') WHERE name='includeInForecast'",
    )
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0)
        > 0;

    if !has_include_in_forecast {
        println!("Migrating scheduled_transactions table: adding includeInForecast column");
        sqlx::query("ALTER TABLE scheduled_transactions ADD COLUMN \"includeInForecast\" BOOLEAN DEFAULT 1")
            .execute(&mut *tx)
            .await?;
    }

    // Migration: Add endDate to scheduled_transactions
    let has_end_date: bool = sqlx::query_scalar(
        "SELECT count(*) FROM pragma_table_info('scheduled_transactions') WHERE name='endDate'",
    )
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0)
        > 0;

    if !has_end_date {
        println!("Migrating scheduled_transactions table: adding endDate column");
        sqlx::query("ALTER TABLE scheduled_transactions ADD COLUMN \"endDate\" TEXT")
            .execute(&mut *tx)
            .await?;
    }

    // Migration: Add lastSeenVersion to settings
    let has_last_seen_version: bool = sqlx::query_scalar(
        "SELECT count(*) FROM pragma_table_info('settings') WHERE name='lastSeenVersion'",
    )
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0)
        > 0;

    if !has_last_seen_version {
        println!("Migrating settings table: adding lastSeenVersion column");
        sqlx::query("ALTER TABLE settings ADD COLUMN \"lastSeenVersion\" TEXT")
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;

    Ok(())
}
