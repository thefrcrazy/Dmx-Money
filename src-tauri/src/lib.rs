mod commands;
mod db;
mod models;

use tauri::{Manager, WebviewWindowBuilder};

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

            // Manual Window Creation for full control
            let mut window_builder = WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::default())
                .title("DmxMoney")
                .inner_size(400.0, 400.0) // 400x400 square splash
                .resizable(true)
                .center();

            #[cfg(target_os = "macos")]
            {
                window_builder = window_builder
                    .hidden_title(true)
                    .title_bar_style(tauri::TitleBarStyle::Overlay);
            }

            let window = window_builder.build().expect("failed to build window");

            // Explicitly set shadow
            let _ = window.set_shadow(true);

            let handle = app.handle();
            let pool = tauri::async_runtime::block_on(db::init_db(handle))
                .expect("failed to initialize database");
            app.manage(pool.clone());

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