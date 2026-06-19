use super::*;

pub(super) async fn get_settings_record(pool: &DbPool) -> Result<Option<Settings>, String> {
    #[derive(sqlx::FromRow)]
    struct SettingsRow {
        #[sqlx(rename = "settingsRevision")]
        settings_revision: i64,
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
        #[sqlx(rename = "dismissedBudgetSuggestions")]
        dismissed_budget_suggestions: Option<String>,
        #[sqlx(rename = "dismissedScheduledSuggestions")]
        dismissed_scheduled_suggestions: Option<String>,
        #[sqlx(rename = "predictionTimeRange")]
        prediction_time_range: Option<String>,
        #[sqlx(rename = "predictionCustomEndDate")]
        prediction_custom_end_date: Option<String>,
        #[sqlx(rename = "predictionAlertThreshold")]
        prediction_alert_threshold: f64,
        #[sqlx(rename = "predictionMonthStartsOnFirst")]
        prediction_month_starts_on_first: bool,
        #[sqlx(rename = "predictionFakeTransactions")]
        prediction_fake_transactions: Option<String>,
        #[sqlx(rename = "analyticsTimeRange")]
        analytics_time_range: Option<String>,
        #[sqlx(rename = "analyticsCustomStartDate")]
        analytics_custom_start_date: Option<String>,
        #[sqlx(rename = "analyticsCustomEndDate")]
        analytics_custom_end_date: Option<String>,
        #[sqlx(rename = "analyticsMonthStartsOnFirst")]
        analytics_month_starts_on_first: bool,
        #[sqlx(rename = "analyticsHiddenExpenseCategories")]
        analytics_hidden_expense_categories: Option<String>,
        #[sqlx(rename = "analyticsHiddenIncomeCategories")]
        analytics_hidden_income_categories: Option<String>,
        #[sqlx(rename = "scheduledDueRange")]
        scheduled_due_range: Option<String>,
    }

    let row = sqlx::query_as::<_, SettingsRow>("SELECT * FROM settings WHERE id = 1")
        .fetch_optional(pool)
        .await
        .map_err(|e| map_db_error(e, "récupération des paramètres"))?;

    Ok(row.map(|row| {
        let window_position =
            if let (Some(x), Some(y)) = (row.window_position_x, row.window_position_y) {
                Some(WindowPosition { x, y })
            } else {
                None
            };

        let window_size =
            if let (Some(width), Some(height)) = (row.window_size_width, row.window_size_height) {
                Some(WindowSize { width, height })
            } else {
                None
            };

        Settings {
            settings_revision: Some(row.settings_revision),
            theme: row.theme,
            primary_color: row.primary_color,
            display_style: Some(row.display_style),
            window_position,
            window_size,
            account_groups: row.account_groups,
            custom_groups: row.custom_groups,
            custom_groups_order: row.custom_groups_order,
            accounts_order: row.accounts_order,
            last_seen_version: row.last_seen_version,
            component_spacing: row.component_spacing,
            component_padding: row.component_padding,
            dismissed_budget_suggestions: row.dismissed_budget_suggestions,
            dismissed_scheduled_suggestions: row.dismissed_scheduled_suggestions,
            prediction_time_range: row.prediction_time_range,
            prediction_custom_end_date: row.prediction_custom_end_date,
            prediction_alert_threshold: Some(row.prediction_alert_threshold),
            prediction_month_starts_on_first: Some(row.prediction_month_starts_on_first),
            prediction_fake_transactions: row.prediction_fake_transactions,
            analytics_time_range: row.analytics_time_range,
            analytics_custom_start_date: row.analytics_custom_start_date,
            analytics_custom_end_date: row.analytics_custom_end_date,
            analytics_month_starts_on_first: Some(row.analytics_month_starts_on_first),
            analytics_hidden_expense_categories: row.analytics_hidden_expense_categories,
            analytics_hidden_income_categories: row.analytics_hidden_income_categories,
            scheduled_due_range: row.scheduled_due_range,
        }
    }))
}
