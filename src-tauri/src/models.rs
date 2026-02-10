use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Account {
    pub id: String,
    pub name: String,
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub account_type: String,
    #[sqlx(rename = "initialBalance")]
    #[serde(rename = "initialBalance")]
    #[serde(default = "default_balance")]
    pub initial_balance: f64,
    #[serde(default = "default_color")]
    pub color: String,
    #[serde(default = "default_icon")]
    pub icon: String,
}

fn default_balance() -> f64 {
    0.0
}

fn default_color() -> String {
    "#3b82f6".to_string()
}

fn default_icon() -> String {
    "Wallet".to_string()
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Transaction {
    pub id: String,
    pub date: String,
    #[sqlx(rename = "accountId")]
    #[serde(rename = "accountId")]
    pub account_id: String,
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub transaction_type: String,
    pub amount: f64,
    pub category: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub checked: bool,
    #[sqlx(rename = "isTransfer")]
    #[serde(rename = "isTransfer", default)]
    pub is_transfer: bool,
    #[sqlx(rename = "linkedTransactionId")]
    #[serde(rename = "linkedTransactionId", default)]
    pub linked_transaction_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub color: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ScheduledTransaction {
    pub id: String,
    pub description: String,
    pub amount: f64,
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub transaction_type: String,
    pub frequency: String,
    #[sqlx(rename = "accountId")]
    #[serde(rename = "accountId")]
    pub account_id: String,
    #[sqlx(rename = "nextDate")]
    #[serde(rename = "nextDate")]
    pub next_date: String,
    pub category: String,
    #[sqlx(rename = "toAccountId")]
    #[serde(rename = "toAccountId")]
    pub to_account_id: Option<String>,
    #[sqlx(rename = "includeInForecast")]
    #[serde(rename = "includeInForecast")]
    pub include_in_forecast: Option<bool>,
    #[sqlx(rename = "endDate")]
    #[serde(rename = "endDate")]
    pub end_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppData {
    pub accounts: Vec<Account>,
    pub transactions: Vec<Transaction>,
    pub categories: Vec<Category>,
    pub scheduled: Vec<ScheduledTransaction>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WindowPosition {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WindowSize {
    pub width: i32,
    pub height: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Settings {
    pub theme: String,
    #[serde(rename = "primaryColor")]
    pub primary_color: String,
    #[serde(rename = "displayStyle")]
    pub display_style: String,
    #[serde(rename = "windowPosition")]
    pub window_position: Option<WindowPosition>,
    #[serde(rename = "windowSize")]
    pub window_size: Option<WindowSize>,
    #[serde(rename = "accountGroups")]
    pub account_groups: Option<String>, // JSON string
    #[serde(rename = "customGroups")]
    pub custom_groups: Option<String>, // JSON string
    #[serde(rename = "customGroupsOrder")]
    pub custom_groups_order: Option<String>, // JSON string
    #[serde(rename = "accountsOrder")]
    pub accounts_order: Option<String>, // JSON string
    #[serde(rename = "lastSeenVersion")]
    pub last_seen_version: Option<String>,
    #[serde(rename = "componentSpacing")]
    pub component_spacing: i32,
    #[serde(rename = "componentPadding")]
    pub component_padding: i32,
}
