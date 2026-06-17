use crate::db::DbPool;
use tauri::{
    menu::{Menu, MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime, WebviewWindow, WindowEvent,
};

#[derive(Clone, serde::Serialize)]
struct NavigationPayload {
    page: String,
    #[serde(rename = "accountId")]
    account_id: Option<String>,
}

#[derive(Debug)]
struct AccountSummary {
    id: String,
    name: String,
    current_balance: f64,
}

const TRAY_ID: &str = "dmxmoney-background";
const SHOW_MENU_ID: &str = "show_main_window";
const REFRESH_DATA_MENU_ID: &str = "refresh_bank_data";
const ALL_ACCOUNTS_MENU_ID: &str = "open_all_accounts";
const DASHBOARD_MENU_ID: &str = "open_dashboard";
const ACCOUNTS_MENU_ID: &str = "open_accounts";
const TRANSACTIONS_MENU_ID: &str = "open_transactions";
const BUDGET_MENU_ID: &str = "open_budget";
const SCHEDULED_MENU_ID: &str = "open_scheduled";
const ANALYTICS_MENU_ID: &str = "open_analytics";
const PREDICTIONS_MENU_ID: &str = "open_predictions";
const CATEGORIES_MENU_ID: &str = "open_categories";
const MOBILE_COMPANION_MENU_ID: &str = "open_mobile_companion_settings";
const SETTINGS_MENU_ID: &str = "open_settings";
const QUIT_MENU_ID: &str = "quit_app";
const ACCOUNT_MENU_PREFIX: &str = "open_account:";
const NAVIGATE_EVENT: &str = "dmxmoney-navigate-to-page";
const DATA_REFRESH_EVENT: &str = "bank-data-changed";

pub fn install<R: Runtime>(
    app: &tauri::App<R>,
    window: &WebviewWindow<R>,
    pool: DbPool,
) -> tauri::Result<()> {
    let menu = tauri::async_runtime::block_on(build_tray_menu(app, &pool));

    let mut tray = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("DmxMoney");

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray.on_menu_event(|app, event| {
        let id = event.id().as_ref();

        if let Some(account_id) = id.strip_prefix(ACCOUNT_MENU_PREFIX) {
            open_page_with_account(app, "transactions", Some(account_id.to_string()));
            return;
        }

        match id {
            SHOW_MENU_ID => show_main_window(app),
            ALL_ACCOUNTS_MENU_ID => open_page(app, "transactions"),
            DASHBOARD_MENU_ID => open_page(app, "dashboard"),
            ACCOUNTS_MENU_ID => open_page(app, "accounts"),
            TRANSACTIONS_MENU_ID => open_page(app, "transactions"),
            BUDGET_MENU_ID => open_page(app, "budget"),
            SCHEDULED_MENU_ID => open_page(app, "scheduled"),
            ANALYTICS_MENU_ID => open_page(app, "analytics"),
            PREDICTIONS_MENU_ID => open_page(app, "predictions"),
            CATEGORIES_MENU_ID => open_page(app, "categories"),
            MOBILE_COMPANION_MENU_ID => open_settings(app),
            REFRESH_DATA_MENU_ID => refresh_bank_data(app),
            SETTINGS_MENU_ID => open_settings(app),
            QUIT_MENU_ID => app.exit(0),
            _ => {}
        }
    })
    .on_tray_icon_event(|tray, event| {
        if let TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        } = event
        {
            refresh_and_show_native_menu(tray);
        }
    })
    .build(app)?;

    let app_handle = app.handle().clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            if let Some(window) = app_handle.get_webview_window("main") {
                let _ = window.hide();
            }
        }
    });

    Ok(())
}

pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn refresh_menu<R: Runtime>(app: &AppHandle<R>) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return;
    };

    if let Some(pool) = app.try_state::<DbPool>() {
        let menu = tauri::async_runtime::block_on(build_tray_menu(app, &pool));
        let _ = tray.set_menu(Some(menu));
    }
}

fn refresh_and_show_native_menu<R: Runtime>(tray: &TrayIcon<R>) {
    refresh_menu(tray.app_handle());
    let _ = tray.with_inner_tray_icon(|inner| inner.show_menu());
}

async fn build_tray_menu<R: Runtime, M: Manager<R>>(manager: &M, pool: &DbPool) -> Menu<R> {
    let summaries = load_account_summaries(pool).await;
    build_native_menu(manager, &summaries).unwrap_or_else(|error| {
        log::error!("Failed to build native tray menu: {error}");
        MenuBuilder::new(manager)
            .text(SHOW_MENU_ID, "Ouvrir DmxMoney")
            .text(SETTINGS_MENU_ID, "Paramètres")
            .separator()
            .text(QUIT_MENU_ID, "Quitter")
            .build()
            .expect("fallback tray menu should build")
    })
}

fn build_native_menu<R: Runtime, M: Manager<R>>(
    manager: &M,
    summaries: &[AccountSummary],
) -> tauri::Result<Menu<R>> {
    let total_current = summaries
        .iter()
        .map(|summary| summary.current_balance)
        .sum::<f64>();
    let section_quick = section_item(manager, "section_quick", "RACCOURCIS")?;
    let section_accounts = section_item(manager, "section_accounts", "COMPTES")?;
    let section_navigation = section_item(manager, "section_navigation", "NAVIGATION")?;
    let section_app = section_item(manager, "section_app", "APPLICATION")?;

    let mut builder = MenuBuilder::new(manager)
        .item(&section_quick)
        .text(SHOW_MENU_ID, "Ouvrir DmxMoney")
        .text(REFRESH_DATA_MENU_ID, "Synchroniser maintenant")
        .separator()
        .item(&section_accounts)
        .text(
            ALL_ACCOUNTS_MENU_ID,
            format!("Tous  {}", format_currency(total_current)),
        );

    if summaries.is_empty() {
        let empty_accounts = section_item(manager, "accounts_empty", "Aucun compte configuré")?;
        builder = builder.item(&empty_accounts);
    } else {
        for summary in summaries.iter().take(8) {
            let item = MenuItemBuilder::with_id(
                format!("{ACCOUNT_MENU_PREFIX}{}", summary.id),
                format!(
                    "{}  {}",
                    truncate_label(&summary.name, 24),
                    format_currency(summary.current_balance)
                ),
            )
            .build(manager)?;
            builder = builder.item(&item);
        }

        if summaries.len() > 8 {
            let more_accounts = section_item(
                manager,
                "accounts_more",
                format!("+{} autres comptes", summaries.len() - 8),
            )?;
            builder = builder.item(&more_accounts);
        }
    }

    builder
        .separator()
        .item(&section_navigation)
        .text(DASHBOARD_MENU_ID, "Vue d'ensemble")
        .text(ACCOUNTS_MENU_ID, "Tous les comptes")
        .text(TRANSACTIONS_MENU_ID, "Journal")
        .text(BUDGET_MENU_ID, "Budget")
        .text(SCHEDULED_MENU_ID, "Échéancier")
        .text(ANALYTICS_MENU_ID, "Analyses")
        .text(PREDICTIONS_MENU_ID, "Prédictions")
        .text(CATEGORIES_MENU_ID, "Catégories")
        .separator()
        .item(&section_app)
        .text(MOBILE_COMPANION_MENU_ID, "Compagnon mobile")
        .text(SETTINGS_MENU_ID, "Paramètres")
        .separator()
        .text(QUIT_MENU_ID, "Quitter")
        .build()
}

fn section_item<R: Runtime, M: Manager<R>, S: AsRef<str>>(
    manager: &M,
    id: &str,
    label: S,
) -> tauri::Result<tauri::menu::MenuItem<R>> {
    MenuItemBuilder::with_id(id, label)
        .enabled(false)
        .build(manager)
}

async fn load_account_summaries(pool: &DbPool) -> Vec<AccountSummary> {
    #[derive(sqlx::FromRow)]
    struct Row {
        id: String,
        name: String,
        initial_balance: f64,
        current_delta: f64,
    }

    let rows = sqlx::query_as::<_, Row>(
        r#"
        SELECT
            a.id,
            a.name,
            a."initialBalance" AS initial_balance,
            COALESCE(SUM(CASE WHEN t."type" = 'income' THEN t.amount ELSE -t.amount END), 0) AS current_delta
        FROM accounts a
        LEFT JOIN transactions t ON t."accountId" = a.id
        GROUP BY a.id, a.name, a."initialBalance"
        ORDER BY a.rowid ASC
        "#,
    )
    .fetch_all(pool)
    .await;

    match rows {
        Ok(rows) => rows
            .into_iter()
            .map(|row| AccountSummary {
                id: row.id,
                name: row.name,
                current_balance: round_cents(row.initial_balance + row.current_delta),
            })
            .collect(),
        Err(error) => {
            log::error!("Failed to load tray account summaries: {error}");
            Vec::new()
        }
    }
}

fn round_cents(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

fn format_currency(value: f64) -> String {
    let sign = if value < 0.0 { "-" } else { "" };
    let absolute = value.abs();
    let formatted = format!("{absolute:.2}").replace('.', ",");
    format!("{sign}{formatted} €")
}

fn truncate_label(value: &str, max_chars: usize) -> String {
    let count = value.chars().count();
    if count <= max_chars {
        return value.to_string();
    }

    let mut truncated = value
        .chars()
        .take(max_chars.saturating_sub(1))
        .collect::<String>();
    truncated.push('…');
    truncated
}

fn open_settings<R: Runtime>(app: &AppHandle<R>) {
    open_page(app, "settings");
}

fn open_page<R: Runtime>(app: &AppHandle<R>, page: &str) {
    open_page_with_account(app, page, None);
}

fn open_page_with_account<R: Runtime>(app: &AppHandle<R>, page: &str, account_id: Option<String>) {
    show_main_window(app);
    let _ = app.emit(
        NAVIGATE_EVENT,
        NavigationPayload {
            page: page.to_string(),
            account_id,
        },
    );
}

fn refresh_bank_data<R: Runtime>(app: &AppHandle<R>) {
    let _ = app.emit(DATA_REFRESH_EVENT, ());
    refresh_menu(app);
}

#[tauri::command]
pub fn quit_app<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    app.exit(0);
    Ok(())
}
