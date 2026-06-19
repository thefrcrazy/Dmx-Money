use crate::{
    db::DbPool,
    models::{Settings, WindowPosition, WindowSize},
    versioning::newest_seen_version,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{sqlite::SqliteRow, Row, SqliteConnection};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPatch {
    #[serde(default)]
    pub schema_version: u32,
    #[serde(default)]
    pub base_revision: i64,
    #[serde(default)]
    pub values: SettingsValuesPatch,
    #[serde(default)]
    pub expected_values: BTreeMap<String, Value>,
    #[serde(default)]
    pub dismissed_budget_suggestions_add: Vec<String>,
    #[serde(default)]
    pub dismissed_scheduled_suggestions_add: Vec<String>,
    #[serde(default)]
    pub prediction_fake_transactions_upsert: Vec<Value>,
    #[serde(default)]
    pub prediction_fake_transaction_delete_ids: Vec<String>,
    #[serde(default)]
    pub prediction_fake_transactions_expected: BTreeMap<String, Value>,
    #[serde(default)]
    pub analytics_hidden_expense_categories_add: Vec<String>,
    #[serde(default)]
    pub analytics_hidden_expense_categories_remove: Vec<String>,
    #[serde(default)]
    pub analytics_hidden_expense_categories_expected: BTreeMap<String, bool>,
    #[serde(default)]
    pub analytics_hidden_income_categories_add: Vec<String>,
    #[serde(default)]
    pub analytics_hidden_income_categories_remove: Vec<String>,
    #[serde(default)]
    pub analytics_hidden_income_categories_expected: BTreeMap<String, bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPatchResult {
    pub ok: bool,
    pub revision: i64,
    pub conflicts: Vec<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsValuesPatch {
    pub theme: Option<String>,
    pub primary_color: Option<String>,
    pub display_style: Option<String>,
    pub window_position: Option<WindowPosition>,
    pub window_size: Option<WindowSize>,
    pub account_groups: Option<String>,
    pub custom_groups: Option<String>,
    pub custom_groups_order: Option<String>,
    pub accounts_order: Option<String>,
    pub last_seen_version: Option<String>,
    pub component_spacing: Option<i32>,
    pub component_padding: Option<i32>,
    pub prediction_time_range: Option<String>,
    pub prediction_custom_end_date: Option<String>,
    pub prediction_alert_threshold: Option<f64>,
    pub prediction_month_starts_on_first: Option<bool>,
    pub analytics_time_range: Option<String>,
    pub analytics_custom_start_date: Option<String>,
    pub analytics_custom_end_date: Option<String>,
    pub analytics_month_starts_on_first: Option<bool>,
    pub scheduled_due_range: Option<String>,
}

pub async fn apply_settings_patch(
    pool: &DbPool,
    patch: SettingsPatch,
) -> Result<SettingsPatchResult, String> {
    if patch.schema_version > 2 {
        return Err("Version de synchronisation des paramètres non supportée.".to_string());
    }

    let mut connection = pool.acquire().await.map_err(|error| error.to_string())?;
    sqlx::query("BEGIN IMMEDIATE")
        .execute(&mut *connection)
        .await
        .map_err(|error| error.to_string())?;

    let result = apply_settings_patch_locked(&mut connection, patch).await;
    match result {
        Ok(result) => {
            sqlx::query("COMMIT")
                .execute(&mut *connection)
                .await
                .map_err(|error| error.to_string())?;
            Ok(result)
        }
        Err(error) => {
            let _ = sqlx::query("ROLLBACK").execute(&mut *connection).await;
            Err(error)
        }
    }
}

pub fn legacy_mobile_settings_patch(settings: Settings) -> SettingsPatch {
    SettingsPatch {
        schema_version: 1,
        base_revision: 0,
        values: SettingsValuesPatch {
            last_seen_version: settings.last_seen_version,
            ..SettingsValuesPatch::default()
        },
        dismissed_budget_suggestions_add: parse_string_array(
            settings.dismissed_budget_suggestions.as_deref(),
        ),
        dismissed_scheduled_suggestions_add: parse_string_array(
            settings.dismissed_scheduled_suggestions.as_deref(),
        ),
        analytics_hidden_expense_categories_add: parse_string_array(
            settings.analytics_hidden_expense_categories.as_deref(),
        ),
        analytics_hidden_income_categories_add: parse_string_array(
            settings.analytics_hidden_income_categories.as_deref(),
        ),
        ..SettingsPatch::default()
    }
}

pub fn legacy_desktop_settings_patch(settings: Settings) -> SettingsPatch {
    SettingsPatch {
        schema_version: 2,
        base_revision: settings.settings_revision.unwrap_or_default(),
        values: SettingsValuesPatch {
            theme: Some(settings.theme),
            primary_color: Some(settings.primary_color),
            display_style: settings.display_style,
            window_position: settings.window_position,
            window_size: settings.window_size,
            account_groups: settings.account_groups,
            custom_groups: settings.custom_groups,
            custom_groups_order: settings.custom_groups_order,
            accounts_order: settings.accounts_order,
            last_seen_version: settings.last_seen_version,
            component_spacing: Some(settings.component_spacing),
            component_padding: Some(settings.component_padding),
            prediction_time_range: settings.prediction_time_range,
            prediction_custom_end_date: settings.prediction_custom_end_date,
            prediction_alert_threshold: settings.prediction_alert_threshold,
            prediction_month_starts_on_first: settings.prediction_month_starts_on_first,
            analytics_time_range: settings.analytics_time_range,
            analytics_custom_start_date: settings.analytics_custom_start_date,
            analytics_custom_end_date: settings.analytics_custom_end_date,
            analytics_month_starts_on_first: settings.analytics_month_starts_on_first,
            scheduled_due_range: settings.scheduled_due_range,
        },
        dismissed_budget_suggestions_add: parse_string_array(
            settings.dismissed_budget_suggestions.as_deref(),
        ),
        dismissed_scheduled_suggestions_add: parse_string_array(
            settings.dismissed_scheduled_suggestions.as_deref(),
        ),
        prediction_fake_transactions_upsert: parse_value_array(
            settings.prediction_fake_transactions.as_deref(),
        ),
        analytics_hidden_expense_categories_add: parse_string_array(
            settings.analytics_hidden_expense_categories.as_deref(),
        ),
        analytics_hidden_income_categories_add: parse_string_array(
            settings.analytics_hidden_income_categories.as_deref(),
        ),
        ..SettingsPatch::default()
    }
}

async fn apply_settings_patch_locked(
    connection: &mut SqliteConnection,
    mut patch: SettingsPatch,
) -> Result<SettingsPatchResult, String> {
    sqlx::query(
        "INSERT OR IGNORE INTO settings (
            id, theme, \"primaryColor\", \"displayStyle\", \"componentSpacing\", \"componentPadding\"
        ) VALUES (1, 'system', '#6366f1', 'modern', 6, 6)",
    )
    .execute(&mut *connection)
    .await
    .map_err(|error| error.to_string())?;

    let row = sqlx::query("SELECT * FROM settings WHERE id = 1")
        .fetch_one(&mut *connection)
        .await
        .map_err(|error| error.to_string())?;

    let current_revision = row
        .try_get::<i64, _>("settingsRevision")
        .unwrap_or_default();
    let mut field_versions = optional_string(&row, "settingsFieldVersions")
        .and_then(|value| serde_json::from_str::<BTreeMap<String, i64>>(&value).ok())
        .unwrap_or_default();
    let mut conflicts = Vec::new();
    let mut applied_fields = Vec::new();

    macro_rules! protect_scalar {
        ($field:ident, $name:literal, $current:expr) => {
            if patch.values.$field.is_some() {
                let changed_since_base =
                    field_versions.get($name).copied().unwrap_or_default() > patch.base_revision;
                let expected_matches = patch
                    .expected_values
                    .get($name)
                    .map(|expected| json_values_equal(expected, &$current))
                    .unwrap_or(false);
                if changed_since_base && !expected_matches {
                    patch.values.$field = None;
                    conflicts.push($name.to_string());
                } else {
                    applied_fields.push($name.to_string());
                }
            }
        };
    }

    protect_scalar!(theme, "theme", row_string_value(&row, "theme"));
    protect_scalar!(
        primary_color,
        "primaryColor",
        row_string_value(&row, "primaryColor")
    );
    protect_scalar!(
        display_style,
        "displayStyle",
        row_string_value(&row, "displayStyle")
    );
    protect_scalar!(
        window_position,
        "windowPosition",
        row_window_position_value(&row)
    );
    protect_scalar!(window_size, "windowSize", row_window_size_value(&row));
    protect_scalar!(
        account_groups,
        "accountGroups",
        row_string_value(&row, "accountGroups")
    );
    protect_scalar!(
        custom_groups,
        "customGroups",
        row_string_value(&row, "customGroups")
    );
    protect_scalar!(
        custom_groups_order,
        "customGroupsOrder",
        row_string_value(&row, "customGroupsOrder")
    );
    protect_scalar!(
        accounts_order,
        "accountsOrder",
        row_string_value(&row, "accountsOrder")
    );
    protect_scalar!(
        component_spacing,
        "componentSpacing",
        row_integer_value(&row, "componentSpacing")
    );
    protect_scalar!(
        component_padding,
        "componentPadding",
        row_integer_value(&row, "componentPadding")
    );
    protect_scalar!(
        prediction_time_range,
        "predictionTimeRange",
        row_string_value(&row, "predictionTimeRange")
    );
    protect_scalar!(
        prediction_custom_end_date,
        "predictionCustomEndDate",
        row_string_value(&row, "predictionCustomEndDate")
    );
    protect_scalar!(
        prediction_alert_threshold,
        "predictionAlertThreshold",
        row_float_value(&row, "predictionAlertThreshold")
    );
    protect_scalar!(
        prediction_month_starts_on_first,
        "predictionMonthStartsOnFirst",
        row_boolean_value(&row, "predictionMonthStartsOnFirst")
    );
    protect_scalar!(
        analytics_time_range,
        "analyticsTimeRange",
        row_string_value(&row, "analyticsTimeRange")
    );
    protect_scalar!(
        analytics_custom_start_date,
        "analyticsCustomStartDate",
        row_string_value(&row, "analyticsCustomStartDate")
    );
    protect_scalar!(
        analytics_custom_end_date,
        "analyticsCustomEndDate",
        row_string_value(&row, "analyticsCustomEndDate")
    );
    protect_scalar!(
        analytics_month_starts_on_first,
        "analyticsMonthStartsOnFirst",
        row_boolean_value(&row, "analyticsMonthStartsOnFirst")
    );
    protect_scalar!(
        scheduled_due_range,
        "scheduledDueRange",
        row_string_value(&row, "scheduledDueRange")
    );

    let current_fake_transactions =
        parse_value_map(optional_string(&row, "predictionFakeTransactions").as_deref());
    let expected_fake_transactions = patch.prediction_fake_transactions_expected.clone();
    patch.prediction_fake_transactions_upsert = patch
        .prediction_fake_transactions_upsert
        .into_iter()
        .filter(|value| {
            let Some(id) = value_id(value) else {
                return false;
            };
            let key = format!("predictionFakeTransactions:{id}");
            let changed_since_base =
                field_versions.get(&key).copied().unwrap_or_default() > patch.base_revision;
            let expected_matches = expected_fake_transactions
                .get(&id)
                .map(|expected| {
                    let current = current_fake_transactions
                        .get(&id)
                        .cloned()
                        .unwrap_or(Value::Null);
                    json_values_equal(expected, &current)
                })
                .unwrap_or(false);
            if changed_since_base && !expected_matches {
                conflicts.push(key);
                false
            } else {
                true
            }
        })
        .collect();
    patch.prediction_fake_transaction_delete_ids = patch
        .prediction_fake_transaction_delete_ids
        .into_iter()
        .filter(|id| {
            let key = format!("predictionFakeTransactions:{id}");
            let changed_since_base =
                field_versions.get(&key).copied().unwrap_or_default() > patch.base_revision;
            let expected_matches = expected_fake_transactions
                .get(id)
                .map(|expected| {
                    let current = current_fake_transactions
                        .get(id)
                        .cloned()
                        .unwrap_or(Value::Null);
                    json_values_equal(expected, &current)
                })
                .unwrap_or(false);
            if changed_since_base && !expected_matches {
                conflicts.push(key);
                false
            } else {
                true
            }
        })
        .collect();

    macro_rules! protect_set_operations {
        ($add:ident, $remove:ident, $expected:ident, $prefix:literal, $current:expr) => {{
            let current_values = $current;
            let expected_values = patch.$expected.clone();
            patch.$add = patch
                .$add
                .into_iter()
                .filter(|value| {
                    let key = format!("{}:{value}", $prefix);
                    let changed_since_base =
                        field_versions.get(&key).copied().unwrap_or_default() > patch.base_revision;
                    let expected_matches = expected_values
                        .get(value)
                        .map(|expected| *expected == current_values.contains(value))
                        .unwrap_or(false);
                    if changed_since_base && !expected_matches {
                        conflicts.push(key);
                        false
                    } else {
                        true
                    }
                })
                .collect();
            patch.$remove = patch
                .$remove
                .into_iter()
                .filter(|value| {
                    let key = format!("{}:{value}", $prefix);
                    let changed_since_base =
                        field_versions.get(&key).copied().unwrap_or_default() > patch.base_revision;
                    let expected_matches = expected_values
                        .get(value)
                        .map(|expected| *expected == current_values.contains(value))
                        .unwrap_or(false);
                    if changed_since_base && !expected_matches {
                        conflicts.push(key);
                        false
                    } else {
                        true
                    }
                })
                .collect();
        }};
    }
    protect_set_operations!(
        analytics_hidden_expense_categories_add,
        analytics_hidden_expense_categories_remove,
        analytics_hidden_expense_categories_expected,
        "analyticsHiddenExpenseCategories",
        parse_string_array(optional_string(&row, "analyticsHiddenExpenseCategories").as_deref())
            .into_iter()
            .collect::<BTreeSet<_>>()
    );
    protect_set_operations!(
        analytics_hidden_income_categories_add,
        analytics_hidden_income_categories_remove,
        analytics_hidden_income_categories_expected,
        "analyticsHiddenIncomeCategories",
        parse_string_array(optional_string(&row, "analyticsHiddenIncomeCategories").as_deref())
            .into_iter()
            .collect::<BTreeSet<_>>()
    );

    if patch.values.last_seen_version.is_some() {
        applied_fields.push("lastSeenVersion".to_string());
    }
    if !patch.dismissed_budget_suggestions_add.is_empty() {
        applied_fields.push("dismissedBudgetSuggestions".to_string());
    }
    if !patch.dismissed_scheduled_suggestions_add.is_empty() {
        applied_fields.push("dismissedScheduledSuggestions".to_string());
    }
    if !patch.prediction_fake_transactions_upsert.is_empty()
        || !patch.prediction_fake_transaction_delete_ids.is_empty()
    {
        applied_fields.push("predictionFakeTransactions".to_string());
        patch
            .prediction_fake_transactions_upsert
            .iter()
            .filter_map(value_id)
            .for_each(|id| applied_fields.push(format!("predictionFakeTransactions:{id}")));
        patch
            .prediction_fake_transaction_delete_ids
            .iter()
            .for_each(|id| applied_fields.push(format!("predictionFakeTransactions:{id}")));
    }
    if !patch.analytics_hidden_expense_categories_add.is_empty()
        || !patch.analytics_hidden_expense_categories_remove.is_empty()
    {
        applied_fields.push("analyticsHiddenExpenseCategories".to_string());
        patch
            .analytics_hidden_expense_categories_add
            .iter()
            .chain(patch.analytics_hidden_expense_categories_remove.iter())
            .for_each(|value| {
                applied_fields.push(format!("analyticsHiddenExpenseCategories:{value}"))
            });
    }
    if !patch.analytics_hidden_income_categories_add.is_empty()
        || !patch.analytics_hidden_income_categories_remove.is_empty()
    {
        applied_fields.push("analyticsHiddenIncomeCategories".to_string());
        patch
            .analytics_hidden_income_categories_add
            .iter()
            .chain(patch.analytics_hidden_income_categories_remove.iter())
            .for_each(|value| {
                applied_fields.push(format!("analyticsHiddenIncomeCategories:{value}"))
            });
    }

    if applied_fields.is_empty() {
        return Ok(SettingsPatchResult {
            ok: true,
            revision: current_revision,
            conflicts,
        });
    }
    let next_revision = current_revision + 1;
    applied_fields.iter().for_each(|field| {
        field_versions.insert(field.clone(), next_revision);
    });
    let serialized_field_versions =
        serde_json::to_string(&field_versions).map_err(|error| error.to_string())?;

    let last_seen_version = if patch.values.last_seen_version.is_some() {
        newest_seen_version(
            optional_string(&row, "lastSeenVersion"),
            patch.values.last_seen_version.clone(),
        )
    } else {
        None
    };
    let dismissed_budget_suggestions = merge_string_array(
        optional_string(&row, "dismissedBudgetSuggestions").as_deref(),
        &patch.dismissed_budget_suggestions_add,
        &[],
    );
    let dismissed_scheduled_suggestions = merge_string_array(
        optional_string(&row, "dismissedScheduledSuggestions").as_deref(),
        &patch.dismissed_scheduled_suggestions_add,
        &[],
    );
    let prediction_fake_transactions = merge_values_by_id(
        optional_string(&row, "predictionFakeTransactions").as_deref(),
        &patch.prediction_fake_transactions_upsert,
        &patch.prediction_fake_transaction_delete_ids,
    );
    let hidden_expense_categories = merge_string_array(
        optional_string(&row, "analyticsHiddenExpenseCategories").as_deref(),
        &patch.analytics_hidden_expense_categories_add,
        &patch.analytics_hidden_expense_categories_remove,
    );
    let hidden_income_categories = merge_string_array(
        optional_string(&row, "analyticsHiddenIncomeCategories").as_deref(),
        &patch.analytics_hidden_income_categories_add,
        &patch.analytics_hidden_income_categories_remove,
    );

    let dismissed_budget_update = (!patch.dismissed_budget_suggestions_add.is_empty())
        .then_some(dismissed_budget_suggestions);
    let dismissed_scheduled_update = (!patch.dismissed_scheduled_suggestions_add.is_empty())
        .then_some(dismissed_scheduled_suggestions);
    let fake_transactions_update = (!patch.prediction_fake_transactions_upsert.is_empty()
        || !patch.prediction_fake_transaction_delete_ids.is_empty())
    .then_some(prediction_fake_transactions);
    let hidden_expense_update = (!patch.analytics_hidden_expense_categories_add.is_empty()
        || !patch.analytics_hidden_expense_categories_remove.is_empty())
    .then_some(hidden_expense_categories);
    let hidden_income_update = (!patch.analytics_hidden_income_categories_add.is_empty()
        || !patch.analytics_hidden_income_categories_remove.is_empty())
    .then_some(hidden_income_categories);

    let window_position_x = patch
        .values
        .window_position
        .as_ref()
        .map(|position| position.x);
    let window_position_y = patch
        .values
        .window_position
        .as_ref()
        .map(|position| position.y);
    let window_size_width = patch.values.window_size.as_ref().map(|size| size.width);
    let window_size_height = patch.values.window_size.as_ref().map(|size| size.height);

    sqlx::query(
        "UPDATE settings SET
            theme = COALESCE($1, theme),
            \"primaryColor\" = COALESCE($2, \"primaryColor\"),
            \"displayStyle\" = COALESCE($3, \"displayStyle\"),
            \"windowPositionX\" = COALESCE($4, \"windowPositionX\"),
            \"windowPositionY\" = COALESCE($5, \"windowPositionY\"),
            \"windowSizeWidth\" = COALESCE($6, \"windowSizeWidth\"),
            \"windowSizeHeight\" = COALESCE($7, \"windowSizeHeight\"),
            \"accountGroups\" = COALESCE($8, \"accountGroups\"),
            \"customGroups\" = COALESCE($9, \"customGroups\"),
            \"customGroupsOrder\" = COALESCE($10, \"customGroupsOrder\"),
            \"accountsOrder\" = COALESCE($11, \"accountsOrder\"),
            \"lastSeenVersion\" = COALESCE($12, \"lastSeenVersion\"),
            \"componentSpacing\" = COALESCE($13, \"componentSpacing\"),
            \"componentPadding\" = COALESCE($14, \"componentPadding\"),
            \"dismissedBudgetSuggestions\" = COALESCE($15, \"dismissedBudgetSuggestions\"),
            \"dismissedScheduledSuggestions\" = COALESCE($16, \"dismissedScheduledSuggestions\"),
            \"predictionTimeRange\" = COALESCE($17, \"predictionTimeRange\"),
            \"predictionCustomEndDate\" = COALESCE($18, \"predictionCustomEndDate\"),
            \"predictionAlertThreshold\" = COALESCE($19, \"predictionAlertThreshold\"),
            \"predictionMonthStartsOnFirst\" = COALESCE($20, \"predictionMonthStartsOnFirst\"),
            \"predictionFakeTransactions\" = COALESCE($21, \"predictionFakeTransactions\"),
            \"analyticsTimeRange\" = COALESCE($22, \"analyticsTimeRange\"),
            \"analyticsCustomStartDate\" = COALESCE($23, \"analyticsCustomStartDate\"),
            \"analyticsCustomEndDate\" = COALESCE($24, \"analyticsCustomEndDate\"),
            \"analyticsMonthStartsOnFirst\" = COALESCE($25, \"analyticsMonthStartsOnFirst\"),
            \"analyticsHiddenExpenseCategories\" = COALESCE($26, \"analyticsHiddenExpenseCategories\"),
            \"analyticsHiddenIncomeCategories\" = COALESCE($27, \"analyticsHiddenIncomeCategories\"),
            \"scheduledDueRange\" = COALESCE($28, \"scheduledDueRange\"),
            \"settingsRevision\" = $29,
            \"settingsFieldVersions\" = $30
         WHERE id = 1",
    )
    .bind(patch.values.theme)
    .bind(patch.values.primary_color)
    .bind(patch.values.display_style)
    .bind(window_position_x)
    .bind(window_position_y)
    .bind(window_size_width)
    .bind(window_size_height)
    .bind(patch.values.account_groups)
    .bind(patch.values.custom_groups)
    .bind(patch.values.custom_groups_order)
    .bind(patch.values.accounts_order)
    .bind(last_seen_version)
    .bind(patch.values.component_spacing)
    .bind(patch.values.component_padding)
    .bind(dismissed_budget_update)
    .bind(dismissed_scheduled_update)
    .bind(patch.values.prediction_time_range)
    .bind(patch.values.prediction_custom_end_date)
    .bind(patch.values.prediction_alert_threshold)
    .bind(patch.values.prediction_month_starts_on_first)
    .bind(fake_transactions_update)
    .bind(patch.values.analytics_time_range)
    .bind(patch.values.analytics_custom_start_date)
    .bind(patch.values.analytics_custom_end_date)
    .bind(patch.values.analytics_month_starts_on_first)
    .bind(hidden_expense_update)
    .bind(hidden_income_update)
    .bind(patch.values.scheduled_due_range)
    .bind(next_revision)
    .bind(serialized_field_versions)
    .execute(&mut *connection)
    .await
    .map_err(|error| error.to_string())?;

    Ok(SettingsPatchResult {
        ok: true,
        revision: next_revision,
        conflicts,
    })
}

fn optional_string(row: &SqliteRow, column: &str) -> Option<String> {
    row.try_get::<Option<String>, _>(column).ok().flatten()
}

fn row_string_value(row: &SqliteRow, column: &str) -> Value {
    optional_string(row, column)
        .map(Value::String)
        .unwrap_or(Value::Null)
}

fn row_integer_value(row: &SqliteRow, column: &str) -> Value {
    row.try_get::<i64, _>(column)
        .map(Value::from)
        .unwrap_or(Value::Null)
}

fn row_float_value(row: &SqliteRow, column: &str) -> Value {
    row.try_get::<f64, _>(column)
        .ok()
        .and_then(serde_json::Number::from_f64)
        .map(Value::Number)
        .unwrap_or(Value::Null)
}

fn row_boolean_value(row: &SqliteRow, column: &str) -> Value {
    row.try_get::<bool, _>(column)
        .map(Value::Bool)
        .unwrap_or(Value::Null)
}

fn row_window_position_value(row: &SqliteRow) -> Value {
    match (
        row.try_get::<Option<i32>, _>("windowPositionX")
            .ok()
            .flatten(),
        row.try_get::<Option<i32>, _>("windowPositionY")
            .ok()
            .flatten(),
    ) {
        (Some(x), Some(y)) => serde_json::json!({ "x": x, "y": y }),
        _ => Value::Null,
    }
}

fn row_window_size_value(row: &SqliteRow) -> Value {
    match (
        row.try_get::<Option<i32>, _>("windowSizeWidth")
            .ok()
            .flatten(),
        row.try_get::<Option<i32>, _>("windowSizeHeight")
            .ok()
            .flatten(),
    ) {
        (Some(width), Some(height)) => {
            serde_json::json!({ "width": width, "height": height })
        }
        _ => Value::Null,
    }
}

fn json_values_equal(left: &Value, right: &Value) -> bool {
    match (left.as_f64(), right.as_f64()) {
        (Some(left), Some(right)) => (left - right).abs() < f64::EPSILON,
        _ => match (left.as_str(), right.as_str()) {
            (Some(left), Some(right)) => {
                match (
                    serde_json::from_str::<Value>(left),
                    serde_json::from_str::<Value>(right),
                ) {
                    (Ok(left), Ok(right)) => json_values_equal(&left, &right),
                    _ => left == right,
                }
            }
            _ => left == right,
        },
    }
}

fn parse_string_array(value: Option<&str>) -> Vec<String> {
    value
        .and_then(|value| serde_json::from_str::<Vec<String>>(value).ok())
        .unwrap_or_default()
}

fn parse_value_array(value: Option<&str>) -> Vec<Value> {
    value
        .and_then(|value| serde_json::from_str::<Vec<Value>>(value).ok())
        .unwrap_or_default()
}

fn parse_value_map(value: Option<&str>) -> BTreeMap<String, Value> {
    parse_value_array(value)
        .into_iter()
        .filter_map(|value| value_id(&value).map(|id| (id, value)))
        .collect()
}

fn merge_string_array(current: Option<&str>, add: &[String], remove: &[String]) -> String {
    let mut values = parse_string_array(current)
        .into_iter()
        .collect::<BTreeSet<_>>();
    remove.iter().for_each(|value| {
        values.remove(value);
    });
    values.extend(add.iter().cloned());
    serde_json::to_string(&values.into_iter().collect::<Vec<_>>())
        .unwrap_or_else(|_| "[]".to_string())
}

fn merge_values_by_id(current: Option<&str>, upserts: &[Value], delete_ids: &[String]) -> String {
    let mut values = parse_value_map(current);

    delete_ids.iter().for_each(|id| {
        values.remove(id);
    });
    upserts.iter().for_each(|value| {
        if let Some(id) = value_id(value) {
            values.insert(id, value.clone());
        }
    });

    serde_json::to_string(&values.into_values().collect::<Vec<_>>())
        .unwrap_or_else(|_| "[]".to_string())
}

fn value_id(value: &Value) -> Option<String> {
    value.get("id")?.as_str().map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::{
        apply_settings_patch, merge_string_array, merge_values_by_id, SettingsPatch,
        SettingsValuesPatch,
    };
    use crate::db::{create_tables, DbPool};
    use serde_json::{json, Value};
    use sqlx::{sqlite::SqlitePoolOptions, Row};
    use std::collections::BTreeMap;

    async fn test_pool() -> DbPool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        create_tables(&pool).await.unwrap();
        pool
    }

    #[test]
    fn additive_suggestions_keep_existing_values() {
        assert_eq!(
            merge_string_array(Some(r#"["fuel","tax"]"#), &["car".into()], &[]),
            r#"["car","fuel","tax"]"#
        );
    }

    #[test]
    fn fake_transaction_operations_preserve_remote_items() {
        let merged = merge_values_by_id(
            Some(r#"[{"id":"local"},{"id":"remote"}]"#),
            &[json!({"id": "local", "amount": 20})],
            &[],
        );
        let value: Vec<Value> = serde_json::from_str(&merged).unwrap();
        assert_eq!(value.len(), 2);
        assert!(value.iter().any(|item| item["id"] == "remote"));
        assert!(value.iter().any(|item| item["amount"] == 20));
    }

    #[tokio::test]
    async fn stale_scalar_patch_is_rejected_without_blocking_unrelated_fields() {
        let pool = test_pool().await;

        let first = apply_settings_patch(
            &pool,
            SettingsPatch {
                schema_version: 2,
                base_revision: 0,
                values: SettingsValuesPatch {
                    prediction_alert_threshold: Some(100.0),
                    ..SettingsValuesPatch::default()
                },
                ..SettingsPatch::default()
            },
        )
        .await
        .unwrap();
        assert_eq!(first.revision, 1);

        let unrelated = apply_settings_patch(
            &pool,
            SettingsPatch {
                schema_version: 2,
                base_revision: 0,
                values: SettingsValuesPatch {
                    theme: Some("dark".to_string()),
                    ..SettingsValuesPatch::default()
                },
                ..SettingsPatch::default()
            },
        )
        .await
        .unwrap();
        assert_eq!(unrelated.revision, 2);
        assert!(unrelated.conflicts.is_empty());

        let stale = apply_settings_patch(
            &pool,
            SettingsPatch {
                schema_version: 2,
                base_revision: 0,
                expected_values: BTreeMap::from([(
                    "predictionAlertThreshold".to_string(),
                    json!(0),
                )]),
                values: SettingsValuesPatch {
                    prediction_alert_threshold: Some(25.0),
                    ..SettingsValuesPatch::default()
                },
                ..SettingsPatch::default()
            },
        )
        .await
        .unwrap();
        assert_eq!(stale.revision, 2);
        assert_eq!(stale.conflicts, vec!["predictionAlertThreshold"]);

        let row =
            sqlx::query("SELECT theme, \"predictionAlertThreshold\" FROM settings WHERE id = 1")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(row.get::<String, _>("theme"), "dark");
        assert_eq!(row.get::<f64, _>("predictionAlertThreshold"), 100.0);
    }

    #[tokio::test]
    async fn sequential_local_scalar_patch_is_allowed_only_when_expected_value_matches() {
        let pool = test_pool().await;

        apply_settings_patch(
            &pool,
            SettingsPatch {
                schema_version: 2,
                base_revision: 0,
                values: SettingsValuesPatch {
                    prediction_alert_threshold: Some(100.0),
                    ..SettingsValuesPatch::default()
                },
                ..SettingsPatch::default()
            },
        )
        .await
        .unwrap();

        let result = apply_settings_patch(
            &pool,
            SettingsPatch {
                schema_version: 2,
                base_revision: 0,
                expected_values: BTreeMap::from([(
                    "predictionAlertThreshold".to_string(),
                    json!(100),
                )]),
                values: SettingsValuesPatch {
                    prediction_alert_threshold: Some(200.0),
                    ..SettingsValuesPatch::default()
                },
                ..SettingsPatch::default()
            },
        )
        .await
        .unwrap();

        assert!(result.conflicts.is_empty());
        assert_eq!(result.revision, 2);
        let value = sqlx::query_scalar::<_, f64>(
            "SELECT \"predictionAlertThreshold\" FROM settings WHERE id = 1",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(value, 200.0);
    }

    #[tokio::test]
    async fn fake_transactions_merge_by_id_and_stale_delete_is_rejected() {
        let pool = test_pool().await;

        let first = apply_settings_patch(
            &pool,
            SettingsPatch {
                schema_version: 2,
                base_revision: 0,
                prediction_fake_transactions_upsert: vec![json!({
                    "id": "desktop",
                    "amount": 10
                })],
                ..SettingsPatch::default()
            },
        )
        .await
        .unwrap();
        assert_eq!(first.revision, 1);

        let second = apply_settings_patch(
            &pool,
            SettingsPatch {
                schema_version: 2,
                base_revision: 0,
                prediction_fake_transactions_upsert: vec![json!({
                    "id": "mobile",
                    "amount": 20
                })],
                ..SettingsPatch::default()
            },
        )
        .await
        .unwrap();
        assert_eq!(second.revision, 2);
        assert!(second.conflicts.is_empty());

        let stale_delete = apply_settings_patch(
            &pool,
            SettingsPatch {
                schema_version: 2,
                base_revision: 0,
                prediction_fake_transaction_delete_ids: vec!["desktop".to_string()],
                ..SettingsPatch::default()
            },
        )
        .await
        .unwrap();
        assert_eq!(stale_delete.revision, 2);
        assert_eq!(
            stale_delete.conflicts,
            vec!["predictionFakeTransactions:desktop"]
        );

        let serialized = sqlx::query_scalar::<_, String>(
            "SELECT \"predictionFakeTransactions\" FROM settings WHERE id = 1",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        let values: Vec<Value> = serde_json::from_str(&serialized).unwrap();
        assert_eq!(values.len(), 2);
        assert!(values.iter().any(|item| item["id"] == "desktop"));
        assert!(values.iter().any(|item| item["id"] == "mobile"));
    }
}
