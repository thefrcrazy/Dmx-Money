use super::*;

pub(super) async fn get_settings_record(pool: &DbPool) -> Result<Option<Settings>, String> {
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
        #[sqlx(rename = "dismissedBudgetSuggestions")]
        dismissed_budget_suggestions: Option<String>,
        #[sqlx(rename = "dismissedScheduledSuggestions")]
        dismissed_scheduled_suggestions: Option<String>,
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
        }
    }))
}

pub(super) async fn save_settings_record(pool: &DbPool, settings: Settings) -> Result<(), String> {
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

    let display_style = settings
        .display_style
        .unwrap_or_else(|| "modern".to_string());

    sqlx::query(
        "INSERT INTO settings (
            id, theme, \"primaryColor\", \"displayStyle\", \"windowPositionX\", \"windowPositionY\",
            \"windowSizeWidth\", \"windowSizeHeight\", \"accountGroups\", \"customGroups\",
            \"customGroupsOrder\", \"accountsOrder\", \"lastSeenVersion\", \"componentSpacing\", \"componentPadding\",
            \"dismissedBudgetSuggestions\", \"dismissedScheduledSuggestions\"
        )
         VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
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
            \"componentPadding\" = $14,
            \"dismissedBudgetSuggestions\" = $15,
            \"dismissedScheduledSuggestions\" = $16",
    )
    .bind(settings.theme)
    .bind(settings.primary_color)
    .bind(display_style)
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
    .bind(settings.dismissed_budget_suggestions)
    .bind(settings.dismissed_scheduled_suggestions)
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "sauvegarde des paramètres"))?;

    Ok(())
}
