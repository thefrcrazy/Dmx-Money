mod commands;
mod db;
mod models;

use tauri::{Manager, TitleBarStyle, WebviewUrl, WebviewWindowBuilder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .build(),
            )?;

            // Manual Window Creation for full control (especially traffic lights)
            let mut window_builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("DmxMoney 2025")
                .inner_size(1320.0, 790.0)
                .resizable(true)
                .fullscreen(false);

            #[cfg(target_os = "macos")]
            {
                window_builder = window_builder
                    .hidden_title(true)
                    .title_bar_style(TitleBarStyle::Overlay)
                    .traffic_light_position(tauri::LogicalPosition::new(14.0, 22.0));
            }

            window_builder.build().expect("failed to build window");

            let handle = app.handle();
            let pool = tauri::async_runtime::block_on(db::init_db(handle))
                .expect("failed to initialize database");
            app.manage(pool.clone());

            // Restore window settings logic
            // Note: We create the window with default size above, but this logic 
            // will resize it immediately if settings exist.
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                #[derive(sqlx::FromRow)]
                struct WindowSettingsRow {
                    #[sqlx(rename = "windowPositionX")]
                    window_position_x: Option<i32>,
                    #[sqlx(rename = "windowPositionY")]
                    window_position_y: Option<i32>,
                    #[sqlx(rename = "windowSizeWidth")]
                    window_size_width: Option<i32>,
                    #[sqlx(rename = "windowSizeHeight")]
                    window_size_height: Option<i32>,
                }

                let row = sqlx::query_as::<_, WindowSettingsRow>(
                    "SELECT \"windowPositionX\", \"windowPositionY\", \"windowSizeWidth\", \"windowSizeHeight\" FROM settings WHERE id = 1"
                )
                .fetch_optional(&pool)
                .await;

                if let Ok(Some(settings)) = row {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        if let (Some(width), Some(height)) = (settings.window_size_width, settings.window_size_height) {
                            let _ = window.set_size(tauri::PhysicalSize::new(width as u32, height as u32));
                        }
                        if let (Some(x), Some(y)) = (settings.window_position_x, settings.window_position_y) {
                            let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_accounts,
            commands::add_account,
            commands::update_account,
            commands::delete_account,
            commands::get_transactions,
            commands::add_transaction,
            commands::update_transaction,
            commands::delete_transaction,
            commands::get_categories,
            commands::add_category,
            commands::update_category,
            commands::delete_category,
            commands::get_scheduled,
            commands::add_scheduled,
            commands::update_scheduled,
            commands::delete_scheduled,
            commands::import_data,
            commands::get_settings,
            commands::save_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}