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
use uuid::Uuid;

const DEFAULT_PORT: u16 = 8799;
const PORT_FALLBACK_COUNT: u16 = 30;
const MAX_BODY_BYTES: usize = 8 * 1024 * 1024;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileCompanionStatus {
    pub enabled: bool,
    pub active: bool,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub url: Option<String>,
    pub data_version: i64,
    pub secure_bridge: Option<SecureBridgeStatus>,
}

#[derive(Debug, Clone)]
struct MobileSettings {
    enabled: bool,
    port: u16,
}

#[derive(Clone)]
struct ServerRuntime {
    host: String,
    port: u16,
    url: String,
    secure: bool,
    stop: Arc<AtomicBool>,
}

#[derive(Clone)]
struct ServerSecurity {
    secure_app_origin: Option<String>,
}

pub struct MobileCompanionState {
    pool: DbPool,
    app_handle: AppHandle,
    runtime: Mutex<Option<ServerRuntime>>,
    secure_pairing: Mutex<Option<(String, String)>>,
}

impl MobileCompanionState {
    pub fn new(pool: DbPool, app_handle: AppHandle) -> Self {
        Self {
            pool,
            app_handle,
            runtime: Mutex::new(None),
            secure_pairing: Mutex::new(None),
        }
    }

    pub async fn bootstrap(&self) -> Result<(), String> {
        let settings = load_mobile_settings(&self.pool).await?;
        let secure_enabled = secure_bridge::load_settings(&self.pool)
            .await
            .map(|settings| settings.enabled)
            .unwrap_or(false);
        if settings.enabled || secure_enabled {
            self.start_server(settings.port).await?;
        }
        Ok(())
    }

    async fn status(&self) -> Result<MobileCompanionStatus, String> {
        let settings = load_mobile_settings(&self.pool).await?;

        let secure_enabled = secure_bridge::load_settings(&self.pool)
            .await
            .map(|settings| settings.enabled)
            .unwrap_or(false);
        if secure_enabled {
            let _ = secure_bridge::ensure_auto_configuration(&self.pool, &self.app_handle).await;
        }

        if settings.enabled || secure_enabled {
            self.start_server(settings.port).await?;
        } else {
            self.stop_server();
        }

        let runtime = self.runtime.lock().map_err(|e| e.to_string())?.clone();
        let active = runtime
            .as_ref()
            .map(|server| !server.stop.load(Ordering::SeqCst))
            .unwrap_or(false);

        let secure_pairing = {
            self.secure_pairing
                .lock()
                .map_err(|e| e.to_string())?
                .clone()
        };
        let secure_bridge = secure_bridge::build_status(
            &self.pool,
            &self.app_handle,
            active,
            runtime.as_ref().map(|server| server.port),
            secure_pairing,
        )
        .await?;

        Ok(MobileCompanionStatus {
            enabled: settings.enabled,
            active,
            host: runtime.as_ref().map(|server| server.host.clone()),
            port: runtime.as_ref().map(|server| server.port),
            url: runtime.as_ref().map(|server| server.url.clone()),
            data_version: get_data_version(&self.pool).await?,
            secure_bridge: Some(secure_bridge),
        })
    }

    async fn start_server(&self, preferred_port: u16) -> Result<(), String> {
        let secure_settings = secure_bridge::load_settings(&self.pool).await.ok();
        let tls_config = match secure_settings.as_ref() {
            Some(settings) => secure_bridge::load_tls_config(&self.app_handle, settings).await?,
            None => None,
        };
        let secure = tls_config.is_some();

        if let Some(current) = self.runtime.lock().map_err(|e| e.to_string())?.clone() {
            if current.secure == secure && !current.stop.load(Ordering::SeqCst) {
                return Ok(());
            }
            current.stop.store(true, Ordering::SeqCst);
            let _ = TcpStream::connect(("127.0.0.1", current.port));
        }

        let (listener, port) = bind_listener(preferred_port)?;
        listener
            .set_nonblocking(true)
            .map_err(|e| format!("Configuration du serveur mobile impossible: {e}"))?;

        let host = if secure {
            secure_settings
                .as_ref()
                .and_then(|settings| settings.local_host.clone())
                .unwrap_or_else(detect_local_ip)
        } else {
            detect_local_ip()
        };
        let scheme = if secure { "https" } else { "http" };
        let url = format!("{scheme}://{host}:{port}/mobile");
        let stop = Arc::new(AtomicBool::new(false));
        let runtime = ServerRuntime {
            host,
            port,
            url,
            secure,
            stop: stop.clone(),
        };

        sqlx::query("UPDATE settings SET \"mobileAccessPort\" = $1 WHERE id = 1")
            .bind(i64::from(port))
            .execute(&self.pool)
            .await
            .map_err(|e| map_db_error(e, "sauvegarde du port mobile"))?;

        *self.runtime.lock().map_err(|e| e.to_string())? = Some(runtime);

        let pool = self.pool.clone();
        let app_handle = self.app_handle.clone();
        let security = ServerSecurity {
            secure_app_origin: secure_settings
                .as_ref()
                .and_then(secure_bridge::secure_app_origin),
        };
        thread::spawn(move || server_loop(listener, pool, app_handle, security, tls_config, stop));

        Ok(())
    }

    fn stop_server(&self) {
        if let Ok(mut runtime) = self.runtime.lock() {
            if let Some(server) = runtime.take() {
                server.stop.store(true, Ordering::SeqCst);
                let _ = TcpStream::connect(("127.0.0.1", server.port));
            }
        }
    }

    async fn set_secure_bridge_enabled(
        &self,
        enabled: bool,
    ) -> Result<MobileCompanionStatus, String> {
        log::info!("Mobile companion secure bridge toggle requested: enabled={enabled}");
        secure_bridge::set_enabled(&self.pool, &self.app_handle, enabled).await?;
        sqlx::query("UPDATE settings SET \"mobileAccessEnabled\" = $1 WHERE id = 1")
            .bind(enabled)
            .execute(&self.pool)
            .await
            .map_err(|e| map_db_error(e, "liaison du mode compagnon sécurisé"))?;
        let settings = load_mobile_settings(&self.pool).await?;
        if settings.enabled || enabled {
            self.stop_server();
            self.start_server(settings.port).await?;
            if enabled {
                self.spawn_secure_bridge_refresh();
            }
        } else {
            self.stop_server();
        }
        self.status().await
    }

    fn spawn_secure_bridge_refresh(&self) {
        let pool = self.pool.clone();
        let app_handle = self.app_handle.clone();
        tauri::async_runtime::spawn(async move {
            log::info!("Secure bridge infrastructure refresh started in background");
            let result = secure_bridge::refresh_infrastructure(&pool, &app_handle, false).await;
            match &result {
                Ok(_) => log::info!("Secure bridge infrastructure refresh completed"),
                Err(error) => log::error!("Secure bridge infrastructure refresh failed: {error}"),
            }
            let _ = app_handle.emit(
                "mobile-companion-status-changed",
                json!({ "ok": result.is_ok() }),
            );
        });
    }

    async fn regenerate_secure_pairing_token(&self) -> Result<MobileCompanionStatus, String> {
        secure_bridge::ensure_auto_configuration(&self.pool, &self.app_handle).await?;
        let pairing = secure_bridge::regenerate_pairing_token(&self.pool).await?;
        *self.secure_pairing.lock().map_err(|e| e.to_string())? = Some(pairing);
        self.status().await
    }

    async fn revoke_mobile_passkey(
        &self,
        passkey_id: String,
    ) -> Result<MobileCompanionStatus, String> {
        secure_bridge::revoke_passkey(&self.pool, passkey_id).await?;
        self.status().await
    }
}

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

fn bind_listener(preferred_port: u16) -> Result<(TcpListener, u16), String> {
    for offset in 0..=PORT_FALLBACK_COUNT {
        let port = preferred_port.saturating_add(offset);
        match TcpListener::bind(("0.0.0.0", port)) {
            Ok(listener) => return Ok((listener, port)),
            Err(error) => {
                if offset == PORT_FALLBACK_COUNT {
                    return Err(format!(
                        "Impossible de démarrer le serveur mobile sur le port {preferred_port}: {error}"
                    ));
                }
            }
        }
    }

    Err("Aucun port disponible pour l'accès mobile".to_string())
}

pub(crate) fn detect_local_ip() -> String {
    UdpSocket::bind("0.0.0.0:0")
        .and_then(|socket| {
            let _ = socket.connect("8.8.8.8:80");
            socket.local_addr()
        })
        .map(|addr| addr.ip().to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string())
}

async fn ensure_settings_row(pool: &DbPool) -> Result<(), String> {
    sqlx::query(
        "INSERT OR IGNORE INTO settings (
            id, theme, \"primaryColor\", \"displayStyle\", \"componentSpacing\", \"componentPadding\",
            \"mobileAccessEnabled\", \"mobileAccessPort\"
        )
        VALUES (1, 'system', 'default', 'modern', 6, 6, 0, $1)",
    )
    .bind(i64::from(DEFAULT_PORT))
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "initialisation des paramètres mobiles"))?;

    sqlx::query("UPDATE settings SET \"mobileAccessToken\" = NULL WHERE id = 1")
        .execute(pool)
        .await
        .map_err(|e| map_db_error(e, "nettoyage du token mobile legacy"))?;

    Ok(())
}

async fn load_mobile_settings(pool: &DbPool) -> Result<MobileSettings, String> {
    ensure_settings_row(pool).await?;

    let row = sqlx::query(
        "SELECT
            COALESCE(\"mobileAccessEnabled\", 0) AS enabled,
            COALESCE(\"mobileAccessPort\", 8799) AS port
         FROM settings WHERE id = 1",
    )
    .fetch_one(pool)
    .await
    .map_err(|e| map_db_error(e, "lecture des paramètres mobiles"))?;

    let enabled = row.try_get::<i64, _>("enabled").unwrap_or(0) != 0;
    let port = row
        .try_get::<i64, _>("port")
        .unwrap_or(i64::from(DEFAULT_PORT))
        .clamp(1, i64::from(u16::MAX)) as u16;

    Ok(MobileSettings { enabled, port })
}

async fn get_data_version(pool: &DbPool) -> Result<i64, String> {
    sqlx::query_scalar::<_, i64>("SELECT version FROM sync_state WHERE id = 1")
        .fetch_optional(pool)
        .await
        .map(|version| version.unwrap_or(0))
        .map_err(|e| map_db_error(e, "lecture de la version de synchronisation"))
}

fn map_db_error(e: sqlx::Error, context: &str) -> String {
    let err_msg = e.to_string();
    log::error!("Database Error during {context}: {err_msg}");

    if err_msg.contains("FOREIGN KEY constraint failed") {
        return "Impossible de supprimer cet élément car il est utilisé ailleurs.".to_string();
    }
    if err_msg.contains("UNIQUE constraint failed") {
        return "Un élément avec cet identifiant existe déjà.".to_string();
    }

    format!("Erreur BDD ({context}): {err_msg}")
}

fn server_loop(
    listener: TcpListener,
    pool: DbPool,
    app_handle: AppHandle,
    security: ServerSecurity,
    tls_config: Option<Arc<rustls::ServerConfig>>,
    stop: Arc<AtomicBool>,
) {
    log::info!("Mobile companion server started");

    while !stop.load(Ordering::SeqCst) {
        match listener.accept() {
            Ok((stream, _)) => {
                let pool = pool.clone();
                let app_handle = app_handle.clone();
                let security = security.clone();
                let tls_config = tls_config.clone();
                thread::spawn(move || {
                    handle_stream(stream, pool, app_handle, security, tls_config)
                });
            }
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(50));
            }
            Err(error) => {
                log::warn!("Mobile companion accept error: {error}");
                thread::sleep(Duration::from_millis(200));
            }
        }
    }

    log::info!("Mobile companion server stopped");
}

fn handle_stream(
    mut stream: TcpStream,
    pool: DbPool,
    app_handle: AppHandle,
    security: ServerSecurity,
    tls_config: Option<Arc<rustls::ServerConfig>>,
) {
    if let Err(error) = stream.set_nonblocking(false) {
        log::warn!("Mobile companion stream blocking mode failed: {error}");
    }
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));

    if let Some(config) = tls_config {
        match rustls::ServerConnection::new(config) {
            Ok(connection) => {
                let mut tls_stream = rustls::StreamOwned::new(connection, stream);
                handle_connection(&mut tls_stream, pool, app_handle, security);
            }
            Err(error) => {
                log::warn!("Mobile companion TLS connection failed: {error}");
            }
        }
        return;
    }

    handle_connection(&mut stream, pool, app_handle, security);
}

fn handle_connection<S: Read + Write>(
    stream: &mut S,
    pool: DbPool,
    app_handle: AppHandle,
    security: ServerSecurity,
) {
    let (response, origin) = match read_request(stream) {
        Ok(request) => {
            let origin = request.headers.get("origin").cloned();
            (
                handle_request(request, pool, app_handle),
                origin,
            )
        }
        Err(error) => (error_response(400, &error), None),
    };

    if let Err(error) = write_response(
        stream,
        response,
        origin.as_deref(),
        security.secure_app_origin.as_deref(),
    ) {
        log::warn!("Mobile companion response write failed: {error}");
    }
}

#[derive(Debug)]
struct HttpRequest {
    method: String,
    path: String,
    headers: HashMap<String, String>,
    body: Vec<u8>,
}

struct HttpResponse {
    status: u16,
    reason: &'static str,
    content_type: String,
    body: Vec<u8>,
    headers: Vec<(String, String)>,
}

fn read_request<S: Read>(stream: &mut S) -> Result<HttpRequest, String> {
    let mut buffer = Vec::new();
    let mut temp = [0u8; 8192];
    let mut header_end = None;
    let mut content_length = 0usize;

    loop {
        let read = stream
            .read(&mut temp)
            .map_err(|e| format!("Requête HTTP illisible: {e}"))?;
        if read == 0 {
            break;
        }
        buffer.extend_from_slice(&temp[..read]);

        if buffer.len() > MAX_BODY_BYTES {
            return Err("Requête HTTP trop volumineuse".to_string());
        }

        if header_end.is_none() {
            if let Some(index) = find_header_end(&buffer) {
                header_end = Some(index);
                let header_text = String::from_utf8_lossy(&buffer[..index]);
                content_length = parse_content_length(&header_text);
            }
        }

        if let Some(index) = header_end {
            let body_start = index + 4;
            if buffer.len() >= body_start + content_length {
                break;
            }
        }
    }

    let header_end = header_end.ok_or_else(|| "En-têtes HTTP manquants".to_string())?;
    let body_start = header_end + 4;
    let header_text = String::from_utf8_lossy(&buffer[..header_end]);
    let mut lines = header_text.lines();
    let request_line = lines
        .next()
        .ok_or_else(|| "Ligne de requête HTTP manquante".to_string())?;
    let mut request_parts = request_line.split_whitespace();
    let method = request_parts
        .next()
        .ok_or_else(|| "Méthode HTTP manquante".to_string())?
        .to_string();
    let path = request_parts
        .next()
        .ok_or_else(|| "Chemin HTTP manquant".to_string())?
        .to_string();
    let mut headers = HashMap::new();

    for line in lines {
        if let Some((key, value)) = line.split_once(':') {
            headers.insert(key.trim().to_lowercase(), value.trim().to_string());
        }
    }

    let body_end = body_start + content_length.min(buffer.len().saturating_sub(body_start));
    let body = buffer[body_start..body_end].to_vec();

    Ok(HttpRequest {
        method,
        path,
        headers,
        body,
    })
}

fn find_header_end(buffer: &[u8]) -> Option<usize> {
    buffer.windows(4).position(|window| window == b"\r\n\r\n")
}

fn parse_content_length(header_text: &str) -> usize {
    header_text
        .lines()
        .find_map(|line| {
            let (key, value) = line.split_once(':')?;
            if key.trim().eq_ignore_ascii_case("content-length") {
                value.trim().parse::<usize>().ok()
            } else {
                None
            }
        })
        .unwrap_or(0)
}

fn handle_request(
    request: HttpRequest,
    pool: DbPool,
    app_handle: AppHandle,
) -> HttpResponse {
    let path = strip_query(&request.path);

    if request.method == "OPTIONS" {
        return empty_response(204);
    }

    if path.starts_with("/auth/") {
        let result = tauri::async_runtime::block_on(secure_bridge::handle_auth_request(
            &pool,
            &request.method,
            &path,
            &request.headers,
            &request.body,
        ));
        return match result {
            Ok(output) => auth_response(output),
            Err(error) => error_response(401, &error),
        };
    }

    if path.starts_with("/api/") {
        return handle_api_request(request, path, pool, app_handle);
    }

    serve_static_asset(&app_handle, &path)
}

fn handle_api_request(
    request: HttpRequest,
    path: String,
    pool: DbPool,
    app_handle: AppHandle,
) -> HttpResponse {
    let authorized = tauri::async_runtime::block_on(secure_bridge::authorize_api_request(
        &pool,
        &request.method,
        &path,
        &request.headers,
    ));

    if let Err(error) = authorized {
        return error_response(401, &error);
    }

    let result = tauri::async_runtime::block_on(route_api_request(&pool, request, &path));
    match result {
        Ok((response, changed)) => {
            if changed {
                let version = tauri::async_runtime::block_on(get_data_version(&pool)).unwrap_or(0);
                let _ = app_handle.emit("bank-data-changed", json!({ "dataVersion": version }));
            }
            response
        }
        Err(error) => error_response(500, &error),
    }
}

async fn route_api_request(
    pool: &DbPool,
    request: HttpRequest,
    path: &str,
) -> Result<(HttpResponse, bool), String> {
    let parts = path
        .trim_start_matches('/')
        .split('/')
        .map(percent_decode)
        .collect::<Vec<_>>();

    if parts.len() < 2 || parts[0] != "api" {
        return Ok((error_response(404, "Route introuvable"), false));
    }

    let resource = parts[1].as_str();
    let id = parts.get(2).map(String::as_str);
    let method = request.method.as_str();

    match (method, resource) {
        ("GET", "status") => Ok((
            json_response(
                200,
                json!({
                    "ok": true,
                    "dataVersion": get_data_version(pool).await?,
                }),
            ),
            false,
        )),
        ("GET", "accounts") => Ok((json_response(200, list_accounts(pool).await?), false)),
        ("POST", "accounts") => {
            insert_account(pool, parse_json(&request.body)?).await?;
            Ok((json_response(201, json!({ "ok": true })), true))
        }
        ("PUT", "accounts") => {
            update_account(pool, parse_json(&request.body)?).await?;
            Ok((json_response(200, json!({ "ok": true })), true))
        }
        ("DELETE", "accounts") => {
            delete_account(pool, extract_id(id, &request.body)?).await?;
            Ok((json_response(200, json!({ "ok": true })), true))
        }
        ("GET", "transactions") => Ok((json_response(200, list_transactions(pool).await?), false)),
        ("POST", "transactions") => {
            insert_transaction(pool, parse_json(&request.body)?).await?;
            Ok((json_response(201, json!({ "ok": true })), true))
        }
        ("PUT", "transactions") => {
            update_transaction(pool, parse_json(&request.body)?).await?;
            Ok((json_response(200, json!({ "ok": true })), true))
        }
        ("DELETE", "transactions") => {
            delete_transaction(pool, extract_id(id, &request.body)?).await?;
            Ok((json_response(200, json!({ "ok": true })), true))
        }
        ("POST", "transfers") => {
            let payload: TransferPayload = parse_json(&request.body)?;
            insert_transfer(pool, payload).await?;
            Ok((json_response(201, json!({ "ok": true })), true))
        }
        ("GET", "categories") => Ok((json_response(200, list_categories(pool).await?), false)),
        ("POST", "categories") => {
            insert_category(pool, parse_json(&request.body)?).await?;
            Ok((json_response(201, json!({ "ok": true })), true))
        }
        ("PUT", "categories") => {
            update_category(pool, parse_json(&request.body)?).await?;
            Ok((json_response(200, json!({ "ok": true })), true))
        }
        ("DELETE", "categories") => {
            delete_category(pool, extract_id(id, &request.body)?).await?;
            Ok((json_response(200, json!({ "ok": true })), true))
        }
        ("GET", "budgets") => Ok((json_response(200, list_budgets(pool).await?), false)),
        ("POST", "budgets") => {
            insert_budget(pool, parse_json(&request.body)?).await?;
            Ok((json_response(201, json!({ "ok": true })), true))
        }
        ("PUT", "budgets") => {
            update_budget(pool, parse_json(&request.body)?).await?;
            Ok((json_response(200, json!({ "ok": true })), true))
        }
        ("DELETE", "budgets") => {
            delete_budget(pool, extract_id(id, &request.body)?).await?;
            Ok((json_response(200, json!({ "ok": true })), true))
        }
        ("GET", "scheduled") => Ok((json_response(200, list_scheduled(pool).await?), false)),
        ("POST", "scheduled") if parts.get(2).map(String::as_str) == Some("process-due") => {
            let processed = process_due_scheduled(pool).await?;
            Ok((
                json_response(200, json!({ "processed": processed })),
                processed > 0,
            ))
        }
        ("POST", "scheduled") => {
            insert_scheduled(pool, parse_json(&request.body)?).await?;
            Ok((json_response(201, json!({ "ok": true })), true))
        }
        ("PUT", "scheduled") => {
            update_scheduled(pool, parse_json(&request.body)?).await?;
            Ok((json_response(200, json!({ "ok": true })), true))
        }
        ("DELETE", "scheduled") => {
            delete_scheduled(pool, extract_id(id, &request.body)?).await?;
            Ok((json_response(200, json!({ "ok": true })), true))
        }
        ("GET", "settings") => Ok((json_response(200, get_settings_record(pool).await?), false)),
        ("PUT", "settings") => {
            save_settings_record(pool, parse_json(&request.body)?).await?;
            Ok((json_response(200, json!({ "ok": true })), true))
        }
        _ => Ok((error_response(404, "Route introuvable"), false)),
    }
}

fn parse_json<T: DeserializeOwned>(body: &[u8]) -> Result<T, String> {
    serde_json::from_slice(body).map_err(|e| format!("JSON invalide: {e}"))
}

#[derive(Deserialize)]
struct DeletePayload {
    id: String,
}

fn extract_id(path_id: Option<&str>, body: &[u8]) -> Result<String, String> {
    if let Some(id) = path_id {
        return Ok(id.to_string());
    }
    parse_json::<DeletePayload>(body).map(|payload| payload.id)
}

async fn list_accounts(pool: &DbPool) -> Result<Vec<Account>, String> {
    sqlx::query_as::<_, Account>("SELECT * FROM accounts")
        .fetch_all(pool)
        .await
        .map_err(|e| map_db_error(e, "récupération des comptes"))
}

async fn insert_account(pool: &DbPool, account: Account) -> Result<(), String> {
    sqlx::query(
        "INSERT OR IGNORE INTO accounts (id, name, \"type\", \"initialBalance\", color, icon)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(account.id)
    .bind(account.name)
    .bind(account.account_type)
    .bind(account.initial_balance)
    .bind(account.color)
    .bind(account.icon)
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "ajout du compte"))?;
    Ok(())
}

async fn update_account(pool: &DbPool, account: Account) -> Result<(), String> {
    sqlx::query(
        "UPDATE accounts
         SET name = $1, \"type\" = $2, \"initialBalance\" = $3, color = $4, icon = $5
         WHERE id = $6",
    )
    .bind(account.name)
    .bind(account.account_type)
    .bind(account.initial_balance)
    .bind(account.color)
    .bind(account.icon)
    .bind(account.id)
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "mise à jour du compte"))?;
    Ok(())
}

async fn delete_account(pool: &DbPool, id: String) -> Result<(), String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM transactions WHERE \"accountId\" = $1")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| map_db_error(e, "suppression des transactions liées"))?;
    sqlx::query("DELETE FROM scheduled_transactions WHERE \"accountId\" = $1")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| map_db_error(e, "suppression des échéances liées"))?;
    sqlx::query("UPDATE budgets SET \"accountId\" = NULL WHERE \"accountId\" = $1")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| map_db_error(e, "déliaison des budgets liés"))?;
    sqlx::query("DELETE FROM accounts WHERE id = $1")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| map_db_error(e, "suppression du compte"))?;

    tx.commit().await.map_err(|e| e.to_string())
}

async fn list_transactions(pool: &DbPool) -> Result<Vec<Transaction>, String> {
    sqlx::query_as::<_, Transaction>("SELECT * FROM transactions ORDER BY date DESC, rowid DESC")
        .fetch_all(pool)
        .await
        .map_err(|e| map_db_error(e, "récupération des transactions"))
}

async fn insert_transaction(pool: &DbPool, transaction: Transaction) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO transactions
        (id, date, \"accountId\", \"type\", amount, category, description, checked, \"isTransfer\", \"linkedTransactionId\")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
    )
    .bind(transaction.id)
    .bind(transaction.date)
    .bind(transaction.account_id)
    .bind(transaction.transaction_type)
    .bind(transaction.amount)
    .bind(transaction.category)
    .bind(transaction.description)
    .bind(transaction.checked)
    .bind(transaction.is_transfer)
    .bind(transaction.linked_transaction_id)
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "ajout de transaction"))?;
    Ok(())
}

async fn update_transaction(pool: &DbPool, transaction: Transaction) -> Result<(), String> {
    sqlx::query(
        "UPDATE transactions
         SET date = $1, \"accountId\" = $2, \"type\" = $3, amount = $4, category = $5,
             description = $6, checked = $7, \"isTransfer\" = $8, \"linkedTransactionId\" = $9
         WHERE id = $10",
    )
    .bind(transaction.date)
    .bind(transaction.account_id)
    .bind(transaction.transaction_type)
    .bind(transaction.amount)
    .bind(transaction.category)
    .bind(transaction.description)
    .bind(transaction.checked)
    .bind(transaction.is_transfer)
    .bind(transaction.linked_transaction_id)
    .bind(transaction.id)
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "mise à jour de transaction"))?;
    Ok(())
}

async fn delete_transaction(pool: &DbPool, id: String) -> Result<(), String> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| map_db_error(e, "début de suppression de transaction"))?;

    let linked_transaction_id: Option<String> =
        sqlx::query_scalar("SELECT \"linkedTransactionId\" FROM transactions WHERE id = $1")
            .bind(&id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| map_db_error(e, "récupération du virement lié"))?
            .flatten();

    if let Some(linked_id) = linked_transaction_id {
        sqlx::query("DELETE FROM transactions WHERE id = $1 OR id = $2")
            .bind(&id)
            .bind(linked_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| map_db_error(e, "suppression du virement lié"))?;
    } else {
        sqlx::query("DELETE FROM transactions WHERE id = $1")
            .bind(&id)
            .execute(&mut *tx)
            .await
            .map_err(|e| map_db_error(e, "suppression de transaction"))?;
    }

    tx.commit()
        .await
        .map_err(|e| map_db_error(e, "suppression de transaction"))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TransferPayload {
    from_transaction: Transaction,
    to_transaction: Transaction,
}

async fn insert_transfer(pool: &DbPool, payload: TransferPayload) -> Result<(), String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    insert_transaction_in_tx(&mut tx, payload.from_transaction).await?;
    insert_transaction_in_tx(&mut tx, payload.to_transaction).await?;
    tx.commit().await.map_err(|e| e.to_string())
}

async fn insert_transaction_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    transaction: Transaction,
) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO transactions
        (id, date, \"accountId\", \"type\", amount, category, description, checked, \"isTransfer\", \"linkedTransactionId\")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
    )
    .bind(transaction.id)
    .bind(transaction.date)
    .bind(transaction.account_id)
    .bind(transaction.transaction_type)
    .bind(transaction.amount)
    .bind(transaction.category)
    .bind(transaction.description)
    .bind(transaction.checked)
    .bind(transaction.is_transfer)
    .bind(transaction.linked_transaction_id)
    .execute(&mut **tx)
    .await
    .map_err(|e| map_db_error(e, "ajout de transaction"))?;
    Ok(())
}

async fn list_categories(pool: &DbPool) -> Result<Vec<Category>, String> {
    sqlx::query_as::<_, Category>("SELECT * FROM categories")
        .fetch_all(pool)
        .await
        .map_err(|e| map_db_error(e, "récupération des catégories"))
}

async fn insert_category(pool: &DbPool, category: Category) -> Result<(), String> {
    sqlx::query("INSERT OR IGNORE INTO categories (id, name, icon, color) VALUES ($1, $2, $3, $4)")
        .bind(category.id)
        .bind(category.name)
        .bind(category.icon)
        .bind(category.color)
        .execute(pool)
        .await
        .map_err(|e| map_db_error(e, "ajout de catégorie"))?;
    Ok(())
}

async fn update_category(pool: &DbPool, category: Category) -> Result<(), String> {
    sqlx::query("UPDATE categories SET name = $1, icon = $2, color = $3 WHERE id = $4")
        .bind(category.name)
        .bind(category.icon)
        .bind(category.color)
        .bind(category.id)
        .execute(pool)
        .await
        .map_err(|e| map_db_error(e, "mise à jour de catégorie"))?;
    Ok(())
}

async fn delete_category(pool: &DbPool, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM categories WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| map_db_error(e, "suppression de catégorie"))?;
    Ok(())
}

async fn list_budgets(pool: &DbPool) -> Result<Vec<Budget>, String> {
    sqlx::query_as::<_, Budget>("SELECT * FROM budgets ORDER BY rowid DESC")
        .fetch_all(pool)
        .await
        .map_err(|e| map_db_error(e, "récupération des budgets"))
}

async fn insert_budget(pool: &DbPool, budget: Budget) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO budgets (id, name, amount, category, \"accountId\")
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(budget.id)
    .bind(budget.name)
    .bind(budget.amount)
    .bind(budget.category)
    .bind(budget.account_id)
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "ajout de budget"))?;
    Ok(())
}

async fn update_budget(pool: &DbPool, budget: Budget) -> Result<(), String> {
    sqlx::query(
        "UPDATE budgets SET name = $1, amount = $2, category = $3, \"accountId\" = $4 WHERE id = $5",
    )
    .bind(budget.name)
    .bind(budget.amount)
    .bind(budget.category)
    .bind(budget.account_id)
    .bind(budget.id)
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "mise à jour de budget"))?;
    Ok(())
}

async fn delete_budget(pool: &DbPool, id: String) -> Result<(), String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query("UPDATE scheduled_transactions SET \"budgetId\" = NULL, \"includeInForecast\" = 0 WHERE \"budgetId\" = $1")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| map_db_error(e, "déliaison des échéances du budget"))?;
    sqlx::query("DELETE FROM budgets WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| map_db_error(e, "suppression de budget"))?;

    tx.commit().await.map_err(|e| e.to_string())
}

async fn list_scheduled(pool: &DbPool) -> Result<Vec<ScheduledTransaction>, String> {
    sqlx::query_as::<_, ScheduledTransaction>("SELECT * FROM scheduled_transactions")
        .fetch_all(pool)
        .await
        .map_err(|e| map_db_error(e, "récupération des échéances"))
}

async fn insert_scheduled(pool: &DbPool, scheduled: ScheduledTransaction) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO scheduled_transactions
        (id, description, amount, \"type\", frequency, \"accountId\", \"nextDate\", category,
         \"toAccountId\", \"includeInForecast\", \"budgetId\", \"endDate\")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
    )
    .bind(scheduled.id)
    .bind(scheduled.description)
    .bind(scheduled.amount)
    .bind(scheduled.transaction_type)
    .bind(scheduled.frequency)
    .bind(scheduled.account_id)
    .bind(scheduled.next_date)
    .bind(scheduled.category)
    .bind(scheduled.to_account_id)
    .bind(scheduled.include_in_forecast)
    .bind(scheduled.budget_id)
    .bind(scheduled.end_date)
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "ajout d'échéance"))?;
    Ok(())
}

async fn update_scheduled(pool: &DbPool, scheduled: ScheduledTransaction) -> Result<(), String> {
    sqlx::query(
        "UPDATE scheduled_transactions
         SET description = $1, amount = $2, \"type\" = $3, frequency = $4, \"accountId\" = $5,
             \"nextDate\" = $6, category = $7, \"toAccountId\" = $8, \"includeInForecast\" = $9,
             \"budgetId\" = $10, \"endDate\" = $11
         WHERE id = $12",
    )
    .bind(scheduled.description)
    .bind(scheduled.amount)
    .bind(scheduled.transaction_type)
    .bind(scheduled.frequency)
    .bind(scheduled.account_id)
    .bind(scheduled.next_date)
    .bind(scheduled.category)
    .bind(scheduled.to_account_id)
    .bind(scheduled.include_in_forecast)
    .bind(scheduled.budget_id)
    .bind(scheduled.end_date)
    .bind(scheduled.id)
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "mise à jour d'échéance"))?;
    Ok(())
}

async fn delete_scheduled(pool: &DbPool, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM scheduled_transactions WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| map_db_error(e, "suppression d'échéance"))?;
    Ok(())
}

async fn process_due_scheduled(pool: &DbPool) -> Result<usize, String> {
    let mut scheduled_items = list_scheduled(pool).await?;
    let today = Local::now().date_naive();
    let mut processed = 0usize;

    for item in scheduled_items.iter_mut() {
        let mut next_date = parse_date(&item.next_date)?;
        let mut changed = false;

        while next_date <= today {
            changed = true;

            if let Some(end_date) = &item.end_date {
                if next_date > parse_date(end_date)? {
                    break;
                }
            }

            if item.transaction_type == "transfer" {
                if let Some(to_account_id) = item.to_account_id.clone() {
                    let from_id = Uuid::new_v4().to_string();
                    let to_id = Uuid::new_v4().to_string();
                    insert_transfer(
                        pool,
                        TransferPayload {
                            from_transaction: Transaction {
                                id: from_id.clone(),
                                date: item.next_date.clone(),
                                account_id: item.account_id.clone(),
                                transaction_type: "expense".to_string(),
                                amount: item.amount,
                                category: "transfer".to_string(),
                                description: Some(item.description.clone()),
                                checked: false,
                                is_transfer: true,
                                linked_transaction_id: Some(to_id.clone()),
                            },
                            to_transaction: Transaction {
                                id: to_id,
                                date: item.next_date.clone(),
                                account_id: to_account_id,
                                transaction_type: "income".to_string(),
                                amount: item.amount,
                                category: "transfer".to_string(),
                                description: Some(item.description.clone()),
                                checked: false,
                                is_transfer: true,
                                linked_transaction_id: Some(from_id),
                            },
                        },
                    )
                    .await?;
                    processed += 2;
                }
            } else {
                insert_transaction(
                    pool,
                    Transaction {
                        id: Uuid::new_v4().to_string(),
                        date: item.next_date.clone(),
                        account_id: item.account_id.clone(),
                        transaction_type: item.transaction_type.clone(),
                        amount: item.amount,
                        category: item.category.clone(),
                        description: Some(item.description.clone()),
                        checked: false,
                        is_transfer: false,
                        linked_transaction_id: None,
                    },
                )
                .await?;
                processed += 1;
            }

            next_date = next_scheduled_date(next_date, &item.frequency);
            item.next_date = next_date.format("%Y-%m-%d").to_string();
        }

        if changed {
            if item.frequency == "once" {
                delete_scheduled(pool, item.id.clone()).await?;
            } else {
                update_scheduled(pool, item.clone()).await?;
            }
        }
    }

    Ok(processed)
}

fn parse_date(value: &str) -> Result<NaiveDate, String> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|e| format!("Date invalide ({value}): {e}"))
}

fn next_scheduled_date(date: NaiveDate, frequency: &str) -> NaiveDate {
    match frequency {
        "once" => date
            .with_year(date.year() + 100)
            .unwrap_or_else(|| date + chrono::Duration::days(36500)),
        "daily" => date + chrono::Duration::days(1),
        "weekly" => date + chrono::Duration::days(7),
        "biweekly" => date + chrono::Duration::days(14),
        "bimonthly" => date + chrono::Duration::days(15),
        "fourweekly" => date + chrono::Duration::days(28),
        "monthly" => date.checked_add_months(Months::new(1)).unwrap_or(date),
        "bimestrial" => date.checked_add_months(Months::new(2)).unwrap_or(date),
        "quarterly" => date.checked_add_months(Months::new(3)).unwrap_or(date),
        "fourmonthly" => date.checked_add_months(Months::new(4)).unwrap_or(date),
        "semiannual" => date.checked_add_months(Months::new(6)).unwrap_or(date),
        "annual" => date
            .with_year(date.year() + 1)
            .unwrap_or_else(|| date + chrono::Duration::days(365)),
        "biennial" => date
            .with_year(date.year() + 2)
            .unwrap_or_else(|| date + chrono::Duration::days(730)),
        _ => date.checked_add_months(Months::new(1)).unwrap_or(date),
    }
}

async fn get_settings_record(pool: &DbPool) -> Result<Option<Settings>, String> {
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
        }
    }))
}

async fn save_settings_record(pool: &DbPool, settings: Settings) -> Result<(), String> {
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
            \"customGroupsOrder\", \"accountsOrder\", \"lastSeenVersion\", \"componentSpacing\", \"componentPadding\"
        )
         VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
            \"componentPadding\" = $14",
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
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "sauvegarde des paramètres"))?;

    Ok(())
}

fn serve_static_asset(app_handle: &AppHandle, path: &str) -> HttpResponse {
    let asset_path = asset_path_from_request(path);
    if let Some(asset) = app_handle.asset_resolver().get(asset_path.clone()) {
        return HttpResponse {
            status: 200,
            reason: "OK",
            content_type: asset.mime_type,
            body: asset.bytes,
            headers: vec![("Cache-Control".to_string(), "no-cache".to_string())],
        };
    }

    if asset_path != "index.html" {
        if let Some(asset) = app_handle.asset_resolver().get("index.html".to_string()) {
            return HttpResponse {
                status: 200,
                reason: "OK",
                content_type: asset.mime_type,
                body: asset.bytes,
                headers: vec![("Cache-Control".to_string(), "no-cache".to_string())],
            };
        }
    }

    error_response(404, "Ressource introuvable")
}

fn asset_path_from_request(path: &str) -> String {
    let clean = path.trim_start_matches('/').trim_end_matches('/');

    if clean.is_empty() || clean == "mobile" {
        return "index.html".to_string();
    }

    if let Some(rest) = clean.strip_prefix("mobile/") {
        if rest.is_empty() || !rest.contains('.') {
            return "index.html".to_string();
        }
        return rest.to_string();
    }

    if !clean.contains('.') {
        "index.html".to_string()
    } else {
        clean.to_string()
    }
}

fn strip_query(path: &str) -> String {
    path.split('?').next().unwrap_or(path).to_string()
}

fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut output = Vec::with_capacity(bytes.len());
    let mut i = 0;

    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(high), Some(low)) = (hex_value(bytes[i + 1]), hex_value(bytes[i + 2])) {
                output.push(high * 16 + low);
                i += 3;
                continue;
            }
        }
        output.push(bytes[i]);
        i += 1;
    }

    String::from_utf8_lossy(&output).to_string()
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

fn json_response<T: Serialize>(status: u16, value: T) -> HttpResponse {
    let reason = status_reason(status);
    let body = serde_json::to_vec(&value).unwrap_or_else(|_| b"{\"ok\":false}".to_vec());
    HttpResponse {
        status,
        reason,
        content_type: "application/json; charset=utf-8".to_string(),
        body,
        headers: Vec::new(),
    }
}

fn auth_response(output: secure_bridge::AuthRouteOutput) -> HttpResponse {
    let body = serde_json::to_vec(&output.body).unwrap_or_else(|_| b"{\"ok\":false}".to_vec());
    HttpResponse {
        status: output.status,
        reason: status_reason(output.status),
        content_type: "application/json; charset=utf-8".to_string(),
        body,
        headers: output.headers,
    }
}

fn error_response(status: u16, message: &str) -> HttpResponse {
    json_response(status, json!({ "error": message }))
}

fn empty_response(status: u16) -> HttpResponse {
    HttpResponse {
        status,
        reason: status_reason(status),
        content_type: "text/plain; charset=utf-8".to_string(),
        body: Vec::new(),
        headers: Vec::new(),
    }
}

fn status_reason(status: u16) -> &'static str {
    match status {
        200 => "OK",
        201 => "Created",
        204 => "No Content",
        400 => "Bad Request",
        401 => "Unauthorized",
        404 => "Not Found",
        500 => "Internal Server Error",
        _ => "OK",
    }
}

fn sanitize_header_value(value: &str) -> String {
    value
        .chars()
        .filter(|character| *character != '\r' && *character != '\n')
        .collect()
}

fn write_response(
    stream: &mut impl Write,
    response: HttpResponse,
    origin: Option<&str>,
    secure_app_origin: Option<&str>,
) -> std::io::Result<()> {
    let allow_origin = match (secure_app_origin, origin) {
        (Some(allowed), Some(origin)) if origin == allowed => Some(sanitize_header_value(origin)),
        (Some(_), _) => None,
        (None, Some(origin)) => Some(sanitize_header_value(origin)),
        (None, None) => None,
    };
    let mut headers = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\nCross-Origin-Resource-Policy: cross-origin\r\nVary: Origin, Access-Control-Request-Method, Access-Control-Request-Headers\r\n",
        response.status,
        response.reason,
        response.content_type,
        response.body.len(),
    );

    if secure_app_origin.is_none() || allow_origin.is_some() {
        headers.push_str(&format!(
            "Access-Control-Allow-Origin: {}\r\nAccess-Control-Allow-Headers: Content-Type, Accept, Origin, X-Requested-With, X-Dmx-Csrf, Access-Control-Request-Private-Network\r\nAccess-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\nAccess-Control-Allow-Private-Network: true\r\nAccess-Control-Max-Age: 86400\r\n",
            allow_origin.as_deref().unwrap_or("*")
        ));
    }

    if allow_origin.is_some() {
        headers.push_str("Access-Control-Allow-Credentials: true\r\n");
    }

    for (key, value) in response.headers {
        headers.push_str(&format!("{key}: {value}\r\n"));
    }

    headers.push_str("\r\n");
    stream.write_all(headers.as_bytes())?;
    stream.write_all(&response.body)?;
    stream.flush()
}
