mod commands;
mod db;
mod mobile_companion;
mod models;
mod secure_bridge;

use tauri::{LogicalPosition, Manager, WebviewWindowBuilder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = rustls::crypto::ring::default_provider().install_default();

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
            let mut window_builder =
                WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::default())
                    .title("DmxMoney")
                    .inner_size(400.0, 400.0) // 400x400 square splash
                    .resizable(true)
                    .center();

            #[cfg(target_os = "macos")]
            {
                window_builder = window_builder
                    .hidden_title(true)
                    .title_bar_style(tauri::TitleBarStyle::Overlay)
                    .traffic_light_position(LogicalPosition::new(12.0, 34.0));
            }

            let window = window_builder.build().expect("failed to build window");

            // Explicitly set shadow
            let _ = window.set_shadow(true);

            let handle = app.handle();
            let pool = tauri::async_runtime::block_on(db::init_db(handle))
                .expect("failed to initialize database");
            app.manage(pool.clone());

            let mobile_state =
                mobile_companion::MobileCompanionState::new(pool.clone(), app.handle().clone());
            tauri::async_runtime::block_on(mobile_state.bootstrap())
                .expect("failed to initialize mobile companion");
            app.manage(mobile_state);

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
            commands::get_budgets,
            commands::add_budget,
            commands::update_budget,
            commands::delete_budget,
            commands::get_scheduled,
            commands::add_scheduled,
            commands::update_scheduled,
            commands::delete_scheduled,
            commands::import_data,
            commands::get_settings,
            commands::save_settings,
            mobile_companion::get_mobile_companion_status,
            mobile_companion::get_secure_bridge_status,
            mobile_companion::set_secure_bridge_enabled,
            mobile_companion::regenerate_secure_pairing_token,
            mobile_companion::revoke_mobile_passkey
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
