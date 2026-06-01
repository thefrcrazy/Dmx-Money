use crate::db::DbPool;
use crate::models::{
    Account, Budget, Category, ScheduledTransaction, Settings, Transaction, WindowPosition,
    WindowSize,
};
use crate::secure_bridge::{self, SecureBridgeStatus};
use chrono::{Datelike, Local, Months, NaiveDate};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use std::{
    collections::HashMap,
    io::{Read, Write},
    net::{TcpListener, TcpStream, UdpSocket},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};
use tauri::{command, AppHandle, Emitter, State};

mod api;
mod assets;
mod http;
mod response;
mod settings;
mod state;
mod types;
mod url;

use self::api::route_api_request;
use self::assets::serve_static_asset;
use self::http::{server_loop, HttpRequest};
use self::response::{
    auth_response, empty_response, error_response, json_response, write_response, HttpResponse,
};
pub(crate) use self::settings::detect_local_ip;
use self::settings::{bind_listener, get_data_version, load_mobile_settings, map_db_error};
use self::types::{MobileSettings, ServerRuntime, ServerSecurity};
use self::url::{percent_decode, strip_query};

pub use self::state::MobileCompanionState;
pub use self::types::MobileCompanionStatus;

#[command]
pub async fn get_mobile_companion_status(
    state: State<'_, MobileCompanionState>,
) -> Result<MobileCompanionStatus, String> {
    state.status().await
}

#[command]
pub async fn get_secure_bridge_status(
    state: State<'_, MobileCompanionState>,
) -> Result<SecureBridgeStatus, String> {
    let status = state.status().await?;
    status
        .secure_bridge
        .ok_or_else(|| "Statut du pont sécurisé indisponible.".to_string())
}

#[command]
pub async fn set_secure_bridge_enabled(
    state: State<'_, MobileCompanionState>,
    enabled: bool,
) -> Result<MobileCompanionStatus, String> {
    state.set_secure_bridge_enabled(enabled).await
}

#[command]
pub async fn regenerate_secure_pairing_token(
    state: State<'_, MobileCompanionState>,
) -> Result<MobileCompanionStatus, String> {
    state.regenerate_secure_pairing_token().await
}

#[command]
pub async fn revoke_mobile_passkey(
    state: State<'_, MobileCompanionState>,
    passkey_id: String,
) -> Result<MobileCompanionStatus, String> {
    state.revoke_mobile_passkey(passkey_id).await
}
