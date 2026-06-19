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
        .after_connect(|conn, _meta| {
            Box::pin(async move {
                sqlx::query("PRAGMA foreign_keys = ON")
                    .execute(&mut *conn)
                    .await?;
                sqlx::query("PRAGMA busy_timeout = 5000")
                    .execute(&mut *conn)
                    .await?;
                Ok(())
            })
        })
        .connect(&db_url)
        .await
        .map_err(|e| e.to_string())?;

    create_tables(&pool).await.map_err(|e| e.to_string())?;

    Ok(pool)
}

pub(crate) async fn create_tables(pool: &DbPool) -> Result<(), sqlx::Error> {
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
        "CREATE TABLE IF NOT EXISTS budgets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            \"accountId\" TEXT,
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
            \"componentPadding\" INTEGER NOT NULL DEFAULT 6,
            \"mobileAccessEnabled\" BOOLEAN NOT NULL DEFAULT 0,
            \"mobileAccessToken\" TEXT,
            \"mobileAccessPort\" INTEGER NOT NULL DEFAULT 8799,
            \"secureBridgeEnabled\" BOOLEAN NOT NULL DEFAULT 0,
            \"secureBridgeDomain\" TEXT,
            \"secureBridgeAppUrl\" TEXT,
            \"secureBridgeLocalHost\" TEXT,
            \"secureBridgeDeviceId\" TEXT,
            \"secureBridgeCertificateExpiresAt\" TEXT,
            \"secureBridgeDnsRecordId\" TEXT,
            \"secureBridgeDnsLastUpdatedAt\" TEXT,
            \"secureBridgeLastError\" TEXT,
            \"secureBridgeManagedServiceUrl\" TEXT,
            \"secureBridgeManagedRegisteredAt\" TEXT,
            \"secureBridgeManagedDeviceSecret\" TEXT,
            \"dismissedBudgetSuggestions\" TEXT,
            \"dismissedScheduledSuggestions\" TEXT,
            \"predictionTimeRange\" TEXT NOT NULL DEFAULT 'year',
            \"predictionCustomEndDate\" TEXT,
            \"predictionAlertThreshold\" REAL NOT NULL DEFAULT 0,
            \"predictionMonthStartsOnFirst\" BOOLEAN NOT NULL DEFAULT 1,
            \"predictionFakeTransactions\" TEXT,
            \"analyticsTimeRange\" TEXT NOT NULL DEFAULT 'year',
            \"analyticsCustomStartDate\" TEXT,
            \"analyticsCustomEndDate\" TEXT,
            \"analyticsMonthStartsOnFirst\" BOOLEAN NOT NULL DEFAULT 1,
            \"analyticsHiddenExpenseCategories\" TEXT,
            \"analyticsHiddenIncomeCategories\" TEXT,
            \"scheduledDueRange\" TEXT NOT NULL DEFAULT 'all',
            \"settingsRevision\" INTEGER NOT NULL DEFAULT 0,
            \"settingsFieldVersions\" TEXT NOT NULL DEFAULT '{}'
        )",
    )
    .execute(&mut *tx)
    .await?;

    // Indexes for query performance
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(\"accountId\")",
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)")
        .execute(&mut *tx)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_scheduled_account_id ON scheduled_transactions(\"accountId\")")
        .execute(&mut *tx)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_budgets_account_id ON budgets(\"accountId\")")
        .execute(&mut *tx)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category)")
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
        log::info!("Migrating settings table: adding displayStyle column");
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
        log::info!("Migrating settings table: adding componentSpacing column");
        sqlx::query(
            "ALTER TABLE settings ADD COLUMN \"componentSpacing\" INTEGER NOT NULL DEFAULT 6",
        )
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
        log::info!("Migrating settings table: adding componentPadding column");
        sqlx::query(
            "ALTER TABLE settings ADD COLUMN \"componentPadding\" INTEGER NOT NULL DEFAULT 6",
        )
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
        log::info!("Migrating settings table: adding accountGroups column");
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
        log::info!("Migrating settings table: adding customGroups column");
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
        log::info!("Migrating settings table: adding customGroupsOrder column");
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
        log::info!("Migrating settings table: adding accountsOrder column");
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
        log::info!("Migrating scheduled_transactions table: adding toAccountId column");
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
        log::info!("Migrating scheduled_transactions table: adding includeInForecast column");
        sqlx::query(
            "ALTER TABLE scheduled_transactions ADD COLUMN \"includeInForecast\" BOOLEAN DEFAULT 1",
        )
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
        log::info!("Migrating scheduled_transactions table: adding endDate column");
        sqlx::query("ALTER TABLE scheduled_transactions ADD COLUMN \"endDate\" TEXT")
            .execute(&mut *tx)
            .await?;
    }

    // Migration: Add budgetId to scheduled_transactions
    let has_budget_id: bool = sqlx::query_scalar(
        "SELECT count(*) FROM pragma_table_info('scheduled_transactions') WHERE name='budgetId'",
    )
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0)
        > 0;

    if !has_budget_id {
        log::info!("Migrating scheduled_transactions table: adding budgetId column");
        sqlx::query("ALTER TABLE scheduled_transactions ADD COLUMN \"budgetId\" TEXT")
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
        log::info!("Migrating settings table: adding lastSeenVersion column");
        sqlx::query("ALTER TABLE settings ADD COLUMN \"lastSeenVersion\" TEXT")
            .execute(&mut *tx)
            .await?;
    }

    // Migration: Add local mobile companion settings
    let has_mobile_access_enabled: bool = sqlx::query_scalar(
        "SELECT count(*) FROM pragma_table_info('settings') WHERE name='mobileAccessEnabled'",
    )
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0)
        > 0;

    if !has_mobile_access_enabled {
        log::info!("Migrating settings table: adding mobileAccessEnabled column");
        sqlx::query(
            "ALTER TABLE settings ADD COLUMN \"mobileAccessEnabled\" BOOLEAN NOT NULL DEFAULT 0",
        )
        .execute(&mut *tx)
        .await?;
    }

    let has_mobile_access_token: bool = sqlx::query_scalar(
        "SELECT count(*) FROM pragma_table_info('settings') WHERE name='mobileAccessToken'",
    )
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0)
        > 0;

    if !has_mobile_access_token {
        log::info!("Migrating settings table: adding mobileAccessToken column");
        sqlx::query("ALTER TABLE settings ADD COLUMN \"mobileAccessToken\" TEXT")
            .execute(&mut *tx)
            .await?;
    }

    let has_mobile_access_port: bool = sqlx::query_scalar(
        "SELECT count(*) FROM pragma_table_info('settings') WHERE name='mobileAccessPort'",
    )
    .fetch_one(&mut *tx)
    .await
    .unwrap_or(0)
        > 0;

    if !has_mobile_access_port {
        log::info!("Migrating settings table: adding mobileAccessPort column");
        sqlx::query(
            "ALTER TABLE settings ADD COLUMN \"mobileAccessPort\" INTEGER NOT NULL DEFAULT 8799",
        )
        .execute(&mut *tx)
        .await?;
    }

    for (name, definition) in [
        (
            "dismissedBudgetSuggestions",
            "ALTER TABLE settings ADD COLUMN \"dismissedBudgetSuggestions\" TEXT",
        ),
        (
            "dismissedScheduledSuggestions",
            "ALTER TABLE settings ADD COLUMN \"dismissedScheduledSuggestions\" TEXT",
        ),
        (
            "predictionTimeRange",
            "ALTER TABLE settings ADD COLUMN \"predictionTimeRange\" TEXT NOT NULL DEFAULT 'year'",
        ),
        (
            "predictionCustomEndDate",
            "ALTER TABLE settings ADD COLUMN \"predictionCustomEndDate\" TEXT",
        ),
        (
            "predictionAlertThreshold",
            "ALTER TABLE settings ADD COLUMN \"predictionAlertThreshold\" REAL NOT NULL DEFAULT 0",
        ),
        (
            "predictionMonthStartsOnFirst",
            "ALTER TABLE settings ADD COLUMN \"predictionMonthStartsOnFirst\" BOOLEAN NOT NULL DEFAULT 1",
        ),
        (
            "predictionFakeTransactions",
            "ALTER TABLE settings ADD COLUMN \"predictionFakeTransactions\" TEXT",
        ),
        (
            "analyticsTimeRange",
            "ALTER TABLE settings ADD COLUMN \"analyticsTimeRange\" TEXT NOT NULL DEFAULT 'year'",
        ),
        (
            "analyticsCustomStartDate",
            "ALTER TABLE settings ADD COLUMN \"analyticsCustomStartDate\" TEXT",
        ),
        (
            "analyticsCustomEndDate",
            "ALTER TABLE settings ADD COLUMN \"analyticsCustomEndDate\" TEXT",
        ),
        (
            "analyticsMonthStartsOnFirst",
            "ALTER TABLE settings ADD COLUMN \"analyticsMonthStartsOnFirst\" BOOLEAN NOT NULL DEFAULT 1",
        ),
        (
            "analyticsHiddenExpenseCategories",
            "ALTER TABLE settings ADD COLUMN \"analyticsHiddenExpenseCategories\" TEXT",
        ),
        (
            "analyticsHiddenIncomeCategories",
            "ALTER TABLE settings ADD COLUMN \"analyticsHiddenIncomeCategories\" TEXT",
        ),
        (
            "scheduledDueRange",
            "ALTER TABLE settings ADD COLUMN \"scheduledDueRange\" TEXT NOT NULL DEFAULT 'all'",
        ),
        (
            "settingsRevision",
            "ALTER TABLE settings ADD COLUMN \"settingsRevision\" INTEGER NOT NULL DEFAULT 0",
        ),
        (
            "settingsFieldVersions",
            "ALTER TABLE settings ADD COLUMN \"settingsFieldVersions\" TEXT NOT NULL DEFAULT '{}'",
        ),
    ] {
        let exists: bool =
            sqlx::query_scalar("SELECT count(*) FROM pragma_table_info('settings') WHERE name=$1")
                .bind(name)
                .fetch_one(&mut *tx)
                .await
                .unwrap_or(0)
                > 0;

        if !exists {
            log::info!("Migrating settings table: adding {name} column");
            sqlx::query(definition).execute(&mut *tx).await?;
        }
    }

    for (name, definition) in [
        (
            "secureBridgeEnabled",
            "ALTER TABLE settings ADD COLUMN \"secureBridgeEnabled\" BOOLEAN NOT NULL DEFAULT 0",
        ),
        (
            "secureBridgeDomain",
            "ALTER TABLE settings ADD COLUMN \"secureBridgeDomain\" TEXT",
        ),
        (
            "secureBridgeAppUrl",
            "ALTER TABLE settings ADD COLUMN \"secureBridgeAppUrl\" TEXT",
        ),
        (
            "secureBridgeLocalHost",
            "ALTER TABLE settings ADD COLUMN \"secureBridgeLocalHost\" TEXT",
        ),
        (
            "secureBridgeDeviceId",
            "ALTER TABLE settings ADD COLUMN \"secureBridgeDeviceId\" TEXT",
        ),
        (
            "secureBridgeCertificateExpiresAt",
            "ALTER TABLE settings ADD COLUMN \"secureBridgeCertificateExpiresAt\" TEXT",
        ),
        (
            "secureBridgeDnsRecordId",
            "ALTER TABLE settings ADD COLUMN \"secureBridgeDnsRecordId\" TEXT",
        ),
        (
            "secureBridgeDnsLastUpdatedAt",
            "ALTER TABLE settings ADD COLUMN \"secureBridgeDnsLastUpdatedAt\" TEXT",
        ),
        (
            "secureBridgeLastError",
            "ALTER TABLE settings ADD COLUMN \"secureBridgeLastError\" TEXT",
        ),
        (
            "secureBridgeManagedServiceUrl",
            "ALTER TABLE settings ADD COLUMN \"secureBridgeManagedServiceUrl\" TEXT",
        ),
        (
            "secureBridgeManagedRegisteredAt",
            "ALTER TABLE settings ADD COLUMN \"secureBridgeManagedRegisteredAt\" TEXT",
        ),
        (
            "secureBridgeManagedDeviceSecret",
            "ALTER TABLE settings ADD COLUMN \"secureBridgeManagedDeviceSecret\" TEXT",
        ),
    ] {
        let exists: bool =
            sqlx::query_scalar("SELECT count(*) FROM pragma_table_info('settings') WHERE name=$1")
                .bind(name)
                .fetch_one(&mut *tx)
                .await
                .unwrap_or(0)
                > 0;

        if !exists {
            log::info!("Migrating settings table: adding {name} column");
            sqlx::query(definition).execute(&mut *tx).await?;
        }
    }

    sqlx::query(
        "UPDATE settings
         SET \"mobileAccessToken\" = NULL,
             \"secureBridgeManagedDeviceSecret\" = NULL
         WHERE \"mobileAccessToken\" IS NOT NULL
            OR \"secureBridgeManagedDeviceSecret\" IS NOT NULL",
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS mobile_passkeys (
            id TEXT PRIMARY KEY,
            credential_id TEXT NOT NULL UNIQUE,
            public_key TEXT NOT NULL,
            counter INTEGER NOT NULL DEFAULT 0,
            device_label TEXT,
            created_at TEXT NOT NULL,
            last_used_at TEXT,
            revoked_at TEXT
        )",
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS mobile_pairing_tokens (
            id TEXT PRIMARY KEY,
            token_hash TEXT NOT NULL UNIQUE,
            expires_at TEXT NOT NULL,
            consumed_at TEXT,
            created_at TEXT NOT NULL
        )",
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS mobile_sessions (
            id TEXT PRIMARY KEY,
            session_hash TEXT NOT NULL UNIQUE,
            csrf_hash TEXT NOT NULL,
            passkey_id TEXT,
            device_label TEXT,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            last_used_at TEXT,
            revoked_at TEXT
        )",
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS mobile_auth_challenges (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            state_json TEXT NOT NULL,
            session_id TEXT,
            device_label TEXT,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL
        )",
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS sync_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            version INTEGER NOT NULL DEFAULT 0
        )",
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query("INSERT OR IGNORE INTO sync_state (id, version) VALUES (1, 0)")
        .execute(&mut *tx)
        .await?;

    for table in [
        "accounts",
        "transactions",
        "categories",
        "budgets",
        "scheduled_transactions",
        "settings",
    ] {
        for action in ["INSERT", "UPDATE", "DELETE"] {
            let trigger_name = format!("trg_sync_{table}_{action}");
            let statement = format!(
                "CREATE TRIGGER IF NOT EXISTS {trigger_name}
                 AFTER {action} ON {table}
                 BEGIN
                    UPDATE sync_state SET version = version + 1 WHERE id = 1;
                 END"
            );
            sqlx::query(&statement).execute(&mut *tx).await?;
        }
    }

    tx.commit().await?;

    Ok(())
}
