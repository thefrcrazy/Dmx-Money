use crate::db::DbPool;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use chrono::{Duration as ChronoDuration, Utc};
use instant_acme::{
    Account, AuthorizationStatus, ChallengeType, Identifier, LetsEncrypt, NewAccount, NewOrder,
    OrderStatus,
};
use passkey_auth::{
    AuthenticationResponse, AuthenticationState, CredentialId, PasskeyCredential,
    RegistrationResponse, RegistrationState, Webauthn,
};
use rand::{rngs::OsRng, RngCore};
use rcgen::{CertificateParams, DistinguishedName, KeyPair};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::Row;
use std::{
    collections::HashMap, fs, io::BufReader, path::PathBuf, sync::Arc, thread, time::Duration,
};
use subtle::ConstantTimeEq;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const KEYCHAIN_SERVICE: &str = "DmxMoney Secure Bridge";
const KEYCHAIN_MANAGED_DEVICE_SECRET: &str = "managed-device-secret";
const KEYCHAIN_MANAGED_REGISTRATION_SECRET: &str = "managed-registration-secret";
const SESSION_COOKIE: &str = "dmxmoney_session";
const PAIRING_TTL_MINUTES: i64 = 10;
const SESSION_TTL_MINUTES: i64 = 45;
const CHALLENGE_TTL_MINUTES: i64 = 5;
const CERT_RENEW_WINDOW_DAYS: i64 = 30;
const DEFAULT_MANAGED_SERVICE_URL: &str = "https://dmxmoney.develop-max.com";
const LEGACY_MANAGED_SERVICE_URL: &str = "https://bridge.dmxmoney.app";

#[derive(Debug, Clone)]
pub struct SecureBridgeSettings {
    pub enabled: bool,
    pub domain: Option<String>,
    pub app_url: Option<String>,
    pub local_host: Option<String>,
    pub device_id: Option<String>,
    pub certificate_expires_at: Option<String>,
    pub dns_record_id: Option<String>,
    pub dns_last_updated_at: Option<String>,
    pub last_error: Option<String>,
    pub managed_service_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobilePasskeyInfo {
    pub id: String,
    pub credential_id: String,
    pub device_label: Option<String>,
    pub created_at: String,
    pub last_used_at: Option<String>,
    pub revoked_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecureBridgeStatus {
    pub enabled: bool,
    pub configured: bool,
    pub active: bool,
    pub domain: Option<String>,
    pub app_url: Option<String>,
    pub local_host: Option<String>,
    pub device_id: Option<String>,
    pub api_url: Option<String>,
    pub port: Option<u16>,
    pub pairing_url: Option<String>,
    pub pairing_token_expires_at: Option<String>,
    pub certificate_expires_at: Option<String>,
    pub certificate_ready: bool,
    pub dns_record_id: Option<String>,
    pub dns_last_updated_at: Option<String>,
    pub managed: bool,
    pub managed_service_url: String,
    pub managed_credential_ready: bool,
    pub passkeys: Vec<MobilePasskeyInfo>,
    pub last_error: Option<String>,
}

#[derive(Debug)]
pub struct AuthRouteOutput {
    pub status: u16,
    pub body: Value,
    pub headers: Vec<(String, String)>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PairingStartPayload {
    token: String,
    device_label: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegisterOptionsPayload {
    device_label: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegisterVerifyPayload {
    challenge_id: String,
    device_label: Option<String>,
    response: RegistrationResponse,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoginVerifyPayload {
    challenge_id: String,
    device_label: Option<String>,
    response: AuthenticationResponse,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ManagedRegisterRequest {
    existing_device_id: Option<String>,
    local_ip: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManagedRegisterResponse {
    device_id: String,
    device_secret: String,
    domain: String,
    app_url: String,
    local_host: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ManagedDnsUpdateRequest<'a> {
    local_ip: &'a str,
    local_host: &'a str,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManagedDnsUpdateResponse {
    record_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ManagedTxtRequest<'a> {
    name: &'a str,
    value: &'a str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ManagedTxtDeleteRequest<'a> {
    record_id: &'a str,
}

#[derive(Debug, Deserialize)]
struct DnsJsonResponse {
    #[serde(rename = "Answer")]
    answer: Option<Vec<DnsJsonAnswer>>,
}

#[derive(Debug, Deserialize)]
struct DnsJsonAnswer {
    data: String,
}

pub async fn build_status(
    pool: &DbPool,
    app_handle: &AppHandle,
    active: bool,
    port: Option<u16>,
    pairing_preview: Option<(String, String)>,
) -> Result<SecureBridgeStatus, String> {
    let settings = load_settings(pool).await?;
    let managed_credential_ready = has_managed_device_secret();
    let configured = settings
        .domain
        .as_deref()
        .map(|domain| !domain.is_empty())
        .unwrap_or(false)
        && settings
            .app_url
            .as_deref()
            .map(|url| !url.is_empty())
            .unwrap_or(false)
        && settings
            .local_host
            .as_deref()
            .map(|host| !host.is_empty())
            .unwrap_or(false)
        && managed_credential_ready;
    let certificate_ready = certificate_paths(app_handle, settings.device_id.as_deref())
        .map(|paths| paths.cert.exists() && paths.key.exists())
        .unwrap_or(false);
    let api_url = settings
        .local_host
        .as_ref()
        .zip(port)
        .map(|(host, port)| format!("https://{host}:{port}"));
    let pairing = pairing_preview;
    let pairing_url = settings
        .app_url
        .as_ref()
        .zip(api_url.as_ref())
        .zip(pairing.as_ref())
        .map(|((app_url, api_url), (raw, _expires_at))| {
            format!("{app_url}#pairing={raw}&api={api_url}")
        });

    Ok(SecureBridgeStatus {
        enabled: settings.enabled,
        configured,
        active: settings.enabled && active && certificate_ready,
        domain: settings.domain,
        app_url: settings.app_url,
        local_host: settings.local_host,
        device_id: settings.device_id,
        api_url,
        port,
        pairing_url,
        pairing_token_expires_at: pairing.map(|(_, expires_at)| expires_at),
        certificate_expires_at: settings.certificate_expires_at,
        certificate_ready,
        dns_record_id: settings.dns_record_id,
        dns_last_updated_at: settings.dns_last_updated_at,
        managed: true,
        managed_service_url: managed_service_base_url(settings.managed_service_url.as_deref()),
        managed_credential_ready,
        passkeys: list_passkeys(pool).await?,
        last_error: settings.last_error,
    })
}

pub async fn ensure_auto_configuration(
    pool: &DbPool,
    _app_handle: &AppHandle,
) -> Result<(), String> {
    let current = load_settings(pool).await?;
    let has_secret = has_managed_device_secret();
    let has_config = current
        .domain
        .as_deref()
        .map(|value| !value.is_empty())
        .unwrap_or(false)
        && current
            .app_url
            .as_deref()
            .map(|value| !value.is_empty())
            .unwrap_or(false)
        && current
            .local_host
            .as_deref()
            .map(|value| !value.is_empty())
            .unwrap_or(false)
        && has_secret;

    if has_config {
        return Ok(());
    }

    provision_managed_device(pool, &current, has_secret).await?;

    Ok(())
}

async fn provision_managed_device(
    pool: &DbPool,
    current: &SecureBridgeSettings,
    reuse_existing_device: bool,
) -> Result<(), String> {
    let registration = managed_register_device(if reuse_existing_device {
        current.device_id.as_deref()
    } else {
        None
    })
    .await?;
    let domain = normalize_domain(&registration.domain)?;
    let app_url = normalize_url(&registration.app_url)?;
    let local_host = normalize_host(&registration.local_host)?;
    let now = Utc::now().to_rfc3339();
    set_managed_device_secret(&registration.device_secret)
        .and_then(|_| get_managed_device_secret().map(|secret| !secret.is_empty()))
        .map_err(|error| format!("Secret DmxMoney Bridge non sauvegardé dans le trousseau: {error}"))?;

    sqlx::query(
        "UPDATE settings SET
            \"secureBridgeDomain\" = $1,
            \"secureBridgeAppUrl\" = $2,
            \"secureBridgeLocalHost\" = $3,
            \"secureBridgeDeviceId\" = $4,
            \"secureBridgeManagedServiceUrl\" = $5,
            \"secureBridgeManagedRegisteredAt\" = $6,
            \"secureBridgeDnsRecordId\" = NULL,
            \"secureBridgeCertificateExpiresAt\" = NULL,
            \"secureBridgeManagedDeviceSecret\" = NULL,
            \"secureBridgeLastError\" = NULL
         WHERE id = 1",
    )
    .bind(domain)
    .bind(app_url)
    .bind(local_host)
    .bind(registration.device_id)
    .bind(managed_service_base_url(
        current.managed_service_url.as_deref(),
    ))
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "provisionnement automatique du pont sécurisé"))?;

    Ok(())
}

pub async fn set_enabled(
    pool: &DbPool,
    app_handle: &AppHandle,
    enabled: bool,
) -> Result<(), String> {
    log::info!("Secure bridge set_enabled requested: enabled={enabled}");
    if enabled {
        ensure_auto_configuration(pool, app_handle).await?;
    }

    sqlx::query("UPDATE settings SET \"secureBridgeEnabled\" = $1 WHERE id = 1")
        .bind(enabled)
        .execute(pool)
        .await
        .map_err(|e| map_db_error(e, "activation du pont sécurisé"))?;

    log::info!("Secure bridge enabled flag saved: enabled={enabled}");
    Ok(())
}

pub async fn regenerate_pairing_token(pool: &DbPool) -> Result<(String, String), String> {
    let raw = generate_token(32);
    let expires_at = (Utc::now() + ChronoDuration::minutes(PAIRING_TTL_MINUTES)).to_rfc3339();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO mobile_pairing_tokens (id, token_hash, expires_at, created_at)
         VALUES ($1, $2, $3, $4)",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(hash_secret(&raw))
    .bind(&expires_at)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "création du token de pairing"))?;

    Ok((raw, expires_at))
}

pub async fn revoke_passkey(pool: &DbPool, passkey_id: String) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query("UPDATE mobile_passkeys SET revoked_at = $1 WHERE id = $2")
        .bind(now)
        .bind(passkey_id)
        .execute(pool)
        .await
        .map_err(|e| map_db_error(e, "révocation de la passkey"))?;
    Ok(())
}

pub async fn load_tls_config(
    app_handle: &AppHandle,
    settings: &SecureBridgeSettings,
) -> Result<Option<Arc<rustls::ServerConfig>>, String> {
    if !settings.enabled {
        return Ok(None);
    }

    let paths = match certificate_paths(app_handle, settings.device_id.as_deref()) {
        Some(paths) if paths.cert.exists() && paths.key.exists() => paths,
        _ => return Ok(None),
    };

    let cert_file =
        fs::File::open(&paths.cert).map_err(|e| format!("Certificat HTTPS illisible: {e}"))?;
    let key_file = fs::File::open(&paths.key).map_err(|e| format!("Clé HTTPS illisible: {e}"))?;
    let mut cert_reader = BufReader::new(cert_file);
    let mut key_reader = BufReader::new(key_file);
    let certs = rustls_pemfile::certs(&mut cert_reader)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Certificat HTTPS invalide: {e}"))?;
    let key = rustls_pemfile::private_key(&mut key_reader)
        .map_err(|e| format!("Clé HTTPS invalide: {e}"))?
        .ok_or_else(|| "Clé HTTPS manquante".to_string())?;
    let config = rustls::ServerConfig::builder()
        .with_no_client_auth()
        .with_single_cert(certs, key)
        .map_err(|e| format!("Configuration TLS invalide: {e}"))?;

    Ok(Some(Arc::new(config)))
}

pub async fn refresh_infrastructure(
    pool: &DbPool,
    app_handle: &AppHandle,
    force_certificate: bool,
) -> Result<(), String> {
    ensure_auto_configuration(pool, app_handle).await?;
    let mut settings = load_settings(pool).await?;
    if !settings.enabled {
        return Ok(());
    }

    let _ = sqlx::query("UPDATE settings SET \"secureBridgeLastError\" = NULL WHERE id = 1")
        .execute(pool)
        .await;

    let result = async {
        let mut local_host = settings
            .local_host
            .clone()
            .ok_or_else(|| "Hôte local sécurisé manquant.".to_string())?;
        let local_ip = super::mobile_companion::detect_local_ip();

        let record_id = match managed_update_dns(&settings, &local_host, &local_ip).await {
            Ok(record_id) => record_id,
            Err(error) if is_missing_managed_secret_error(&error) => {
                provision_managed_device(pool, &settings, false).await?;
                settings = load_settings(pool).await?;
                local_host = settings
                    .local_host
                    .clone()
                    .ok_or_else(|| "Hôte local sécurisé manquant.".to_string())?;
                managed_update_dns(&settings, &local_host, &local_ip).await?
            }
            Err(error) => return Err(error),
        };
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            "UPDATE settings SET
                \"secureBridgeDnsRecordId\" = $1,
                \"secureBridgeDnsLastUpdatedAt\" = $2,
                \"secureBridgeLastError\" = NULL
             WHERE id = 1",
        )
        .bind(record_id)
        .bind(now)
        .execute(pool)
        .await
        .map_err(|e| map_db_error(e, "sauvegarde DNS sécurisé"))?;

        ensure_certificate(pool, app_handle, &settings, &local_host, force_certificate).await
    }
    .await;

    if let Err(error) = &result {
        let _ = sqlx::query("UPDATE settings SET \"secureBridgeLastError\" = $1 WHERE id = 1")
            .bind(error)
            .execute(pool)
            .await;
    }

    result
}

pub fn secure_app_origin(settings: &SecureBridgeSettings) -> Option<String> {
    settings
        .app_url
        .as_deref()
        .and_then(|url| url::Url::parse(url).ok())
        .map(|url| {
            let scheme = url.scheme();
            let host = url.host_str().unwrap_or_default();
            match url.port() {
                Some(port) => format!("{scheme}://{host}:{port}"),
                None => format!("{scheme}://{host}"),
            }
        })
}

pub async fn load_settings(pool: &DbPool) -> Result<SecureBridgeSettings, String> {
    let row = sqlx::query(
        "SELECT
            COALESCE(\"secureBridgeEnabled\", 0) AS enabled,
            \"secureBridgeDomain\" AS domain,
            \"secureBridgeAppUrl\" AS app_url,
            \"secureBridgeLocalHost\" AS local_host,
            \"secureBridgeDeviceId\" AS device_id,
            \"secureBridgeCertificateExpiresAt\" AS certificate_expires_at,
            \"secureBridgeDnsRecordId\" AS dns_record_id,
            \"secureBridgeDnsLastUpdatedAt\" AS dns_last_updated_at,
            \"secureBridgeLastError\" AS last_error,
            \"secureBridgeManagedServiceUrl\" AS managed_service_url
         FROM settings WHERE id = 1",
    )
    .fetch_one(pool)
    .await
    .map_err(|e| map_db_error(e, "lecture des paramètres du pont sécurisé"))?;

    Ok(SecureBridgeSettings {
        enabled: row.try_get::<i64, _>("enabled").unwrap_or(0) != 0,
        domain: row.try_get::<Option<String>, _>("domain").unwrap_or(None),
        app_url: row.try_get::<Option<String>, _>("app_url").unwrap_or(None),
        local_host: row
            .try_get::<Option<String>, _>("local_host")
            .unwrap_or(None),
        device_id: row
            .try_get::<Option<String>, _>("device_id")
            .unwrap_or(None),
        certificate_expires_at: row
            .try_get::<Option<String>, _>("certificate_expires_at")
            .unwrap_or(None),
        dns_record_id: row
            .try_get::<Option<String>, _>("dns_record_id")
            .unwrap_or(None),
        dns_last_updated_at: row
            .try_get::<Option<String>, _>("dns_last_updated_at")
            .unwrap_or(None),
        last_error: row
            .try_get::<Option<String>, _>("last_error")
            .unwrap_or(None),
        managed_service_url: row
            .try_get::<Option<String>, _>("managed_service_url")
            .unwrap_or(None),
    })
}

pub async fn authorize_api_request(
    pool: &DbPool,
    method: &str,
    path: &str,
    headers: &HashMap<String, String>,
) -> Result<(), String> {
    let session = extract_cookie(headers, SESSION_COOKIE)
        .ok_or_else(|| "Session mobile manquante.".to_string())?;
    let session_hash = hash_secret(&session);
    let row = sqlx::query(
        "SELECT id, csrf_hash, passkey_id, expires_at, revoked_at
         FROM mobile_sessions WHERE session_hash = $1",
    )
    .bind(session_hash)
    .fetch_optional(pool)
    .await
    .map_err(|e| map_db_error(e, "lecture de session mobile"))?
    .ok_or_else(|| "Session mobile invalide.".to_string())?;

    let expires_at = row
        .try_get::<String, _>("expires_at")
        .map_err(|e| e.to_string())?;
    let revoked_at = row
        .try_get::<Option<String>, _>("revoked_at")
        .unwrap_or(None);
    let passkey_id = row
        .try_get::<Option<String>, _>("passkey_id")
        .unwrap_or(None);
    if revoked_at.is_some() || is_past(&expires_at) || passkey_id.is_none() {
        return Err("Session mobile expirée ou non finalisée.".to_string());
    }

    if method != "GET" && path != "/api/status" {
        let csrf = headers
            .get("x-dmx-csrf")
            .ok_or_else(|| "Jeton CSRF manquant.".to_string())?;
        let csrf_hash = row
            .try_get::<String, _>("csrf_hash")
            .map_err(|e| e.to_string())?;
        if !constant_time_eq(&hash_secret(csrf), &csrf_hash) {
            return Err("Jeton CSRF invalide.".to_string());
        }
    }

    let now = Utc::now().to_rfc3339();
    let _ = sqlx::query("UPDATE mobile_sessions SET last_used_at = $1 WHERE id = $2")
        .bind(now)
        .bind(row.try_get::<String, _>("id").unwrap_or_default())
        .execute(pool)
        .await;

    Ok(())
}

pub async fn handle_auth_request(
    pool: &DbPool,
    method: &str,
    path: &str,
    headers: &HashMap<String, String>,
    body: &[u8],
) -> Result<AuthRouteOutput, String> {
    match (method, path) {
        ("POST", "/auth/pairing/start") => pairing_start(pool, body).await,
        ("POST", "/auth/passkey/register/options") => register_options(pool, headers, body).await,
        ("POST", "/auth/passkey/register/verify") => register_verify(pool, headers, body).await,
        ("POST", "/auth/passkey/login/options") => login_options(pool).await,
        ("POST", "/auth/passkey/login/verify") => login_verify(pool, body).await,
        ("POST", "/auth/logout") => logout(pool, headers).await,
        ("POST", "/auth/unlink") => unlink(pool, headers).await,
        _ => Ok(AuthRouteOutput {
            status: 404,
            body: json!({ "error": "Route introuvable" }),
            headers: Vec::new(),
        }),
    }
}

async fn pairing_start(pool: &DbPool, body: &[u8]) -> Result<AuthRouteOutput, String> {
    let payload: PairingStartPayload = parse_json(body)?;
    let token_hash = hash_secret(&payload.token);
    let now = Utc::now().to_rfc3339();

    let row = sqlx::query(
        "SELECT id, expires_at, consumed_at
         FROM mobile_pairing_tokens WHERE token_hash = $1",
    )
    .bind(token_hash)
    .fetch_optional(pool)
    .await
    .map_err(|e| map_db_error(e, "lecture du pairing mobile"))?
    .ok_or_else(|| "Token de pairing invalide.".to_string())?;

    let token_id = row.try_get::<String, _>("id").map_err(|e| e.to_string())?;
    let expires_at = row
        .try_get::<String, _>("expires_at")
        .map_err(|e| e.to_string())?;
    let consumed_at = row
        .try_get::<Option<String>, _>("consumed_at")
        .unwrap_or(None);
    if consumed_at.is_some() || is_past(&expires_at) {
        return Err("Token de pairing expiré ou déjà utilisé.".to_string());
    }

    sqlx::query("UPDATE mobile_pairing_tokens SET consumed_at = $1 WHERE id = $2")
        .bind(&now)
        .bind(token_id)
        .execute(pool)
        .await
        .map_err(|e| map_db_error(e, "consommation du pairing mobile"))?;

    let session = create_session(pool, None, payload.device_label).await?;
    Ok(session_response(session, true))
}

async fn register_options(
    pool: &DbPool,
    headers: &HashMap<String, String>,
    body: &[u8],
) -> Result<AuthRouteOutput, String> {
    let payload: RegisterOptionsPayload = parse_json_or_default(body)?;
    let session = authorize_session_for_auth(pool, headers).await?;
    let settings = load_settings(pool).await?;
    let webauthn = build_webauthn(&settings)?;
    let existing = list_active_credentials(pool).await?;
    let user_id = settings
        .device_id
        .as_deref()
        .unwrap_or("dmxmoney")
        .as_bytes()
        .to_vec();
    let label = payload.device_label.unwrap_or_else(|| "Mobile".to_string());
    let (challenge, state) =
        webauthn.start_registration(&user_id, "dmxmoney-mobile", &label, &existing);
    let challenge_id =
        store_challenge(pool, "register", &state, Some(&session.id), Some(&label)).await?;

    Ok(AuthRouteOutput {
        status: 200,
        body: json!({ "challengeId": challenge_id, "publicKey": challenge }),
        headers: Vec::new(),
    })
}

async fn register_verify(
    pool: &DbPool,
    headers: &HashMap<String, String>,
    body: &[u8],
) -> Result<AuthRouteOutput, String> {
    let payload: RegisterVerifyPayload = parse_json(body)?;
    let session = authorize_session_for_auth(pool, headers).await?;
    let state: RegistrationState =
        load_challenge(pool, &payload.challenge_id, "register", Some(&session.id)).await?;
    let settings = load_settings(pool).await?;
    let webauthn = build_webauthn(&settings)?;
    let credential = webauthn
        .finish_registration(&state, &payload.response)
        .map_err(|e| format!("Passkey refusée: {e}"))?;
    let label = payload.device_label.unwrap_or_else(|| "Mobile".to_string());
    let passkey_id = insert_passkey(pool, &credential, Some(&label)).await?;
    revoke_session(pool, &session.id).await?;
    delete_challenge(pool, &payload.challenge_id).await?;
    let new_session = create_session(pool, Some(passkey_id), Some(label)).await?;
    Ok(session_response(new_session, false))
}

async fn login_options(pool: &DbPool) -> Result<AuthRouteOutput, String> {
    let settings = load_settings(pool).await?;
    let webauthn = build_webauthn(&settings)?;
    let credentials = list_active_passkeys(pool).await?;
    if credentials.is_empty() {
        return Err("Aucune passkey mobile active. Scannez un QR de pairing.".to_string());
    }
    let (challenge, state) = webauthn.start_authentication_with_creds(&credentials);
    let challenge_id = store_challenge(pool, "login", &state, None, Some("Mobile")).await?;
    Ok(AuthRouteOutput {
        status: 200,
        body: json!({ "challengeId": challenge_id, "publicKey": challenge }),
        headers: Vec::new(),
    })
}

async fn login_verify(pool: &DbPool, body: &[u8]) -> Result<AuthRouteOutput, String> {
    let payload: LoginVerifyPayload = parse_json(body)?;
    let state: AuthenticationState =
        load_challenge(pool, &payload.challenge_id, "login", None).await?;
    let credential = find_passkey_by_credential_id(pool, &payload.response.id).await?;
    let settings = load_settings(pool).await?;
    let webauthn = build_webauthn(&settings)?;
    let outcome = webauthn
        .finish_authentication(&state, &payload.response, &credential.passkey)
        .map_err(|e| format!("Passkey refusée: {e}"))?;
    let device_label = payload.device_label.clone();
    update_passkey_usage(
        pool,
        &credential.id,
        i64::from(outcome.new_counter),
        device_label.as_deref(),
    )
    .await?;
    delete_challenge(pool, &payload.challenge_id).await?;
    let session = create_session(pool, Some(credential.id), device_label).await?;
    Ok(session_response(session, false))
}

async fn logout(
    pool: &DbPool,
    headers: &HashMap<String, String>,
) -> Result<AuthRouteOutput, String> {
    if let Some(raw) = extract_cookie(headers, SESSION_COOKIE) {
        let session_hash = hash_secret(&raw);
        let now = Utc::now().to_rfc3339();
        let _ = sqlx::query("UPDATE mobile_sessions SET revoked_at = $1 WHERE session_hash = $2")
            .bind(now)
            .bind(session_hash)
            .execute(pool)
            .await;
    }

    Ok(AuthRouteOutput {
        status: 200,
        body: json!({ "ok": true }),
        headers: vec![clear_session_cookie()],
    })
}

async fn unlink(
    pool: &DbPool,
    headers: &HashMap<String, String>,
) -> Result<AuthRouteOutput, String> {
    if let Some(raw) = extract_cookie(headers, SESSION_COOKIE) {
        let session_hash = hash_secret(&raw);
        let row = sqlx::query("SELECT id, passkey_id FROM mobile_sessions WHERE session_hash = $1")
            .bind(session_hash)
            .fetch_optional(pool)
            .await
            .map_err(|e| map_db_error(e, "lecture de session mobile"))?;

        if let Some(row) = row {
            let now = Utc::now().to_rfc3339();
            let session_id = row.try_get::<String, _>("id").map_err(|e| e.to_string())?;
            let passkey_id = row
                .try_get::<Option<String>, _>("passkey_id")
                .unwrap_or(None);

            let _ = sqlx::query("UPDATE mobile_sessions SET revoked_at = $1 WHERE id = $2")
                .bind(&now)
                .bind(session_id)
                .execute(pool)
                .await;

            if let Some(passkey_id) = passkey_id {
                let _ = sqlx::query(
                    "UPDATE mobile_passkeys SET revoked_at = $1 WHERE id = $2 AND revoked_at IS NULL",
                )
                .bind(&now)
                .bind(passkey_id)
                .execute(pool)
                .await;
            }
        }
    }

    Ok(AuthRouteOutput {
        status: 200,
        body: json!({ "ok": true }),
        headers: vec![clear_session_cookie()],
    })
}

#[derive(Debug)]
struct SessionTokens {
    raw_session: String,
    raw_csrf: String,
    expires_at: String,
}

#[derive(Debug)]
struct AuthorizedSession {
    id: String,
}

#[derive(Debug)]
struct StoredCredential {
    id: String,
    passkey: PasskeyCredential,
}

async fn create_session(
    pool: &DbPool,
    passkey_id: Option<String>,
    device_label: Option<String>,
) -> Result<SessionTokens, String> {
    let raw_session = generate_token(32);
    let raw_csrf = generate_token(32);
    let now = Utc::now().to_rfc3339();
    let expires_at = (Utc::now() + ChronoDuration::minutes(SESSION_TTL_MINUTES)).to_rfc3339();
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO mobile_sessions
            (id, session_hash, csrf_hash, passkey_id, device_label, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(&id)
    .bind(hash_secret(&raw_session))
    .bind(hash_secret(&raw_csrf))
    .bind(passkey_id)
    .bind(device_label)
    .bind(&expires_at)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "création de session mobile"))?;

    Ok(SessionTokens {
        raw_session,
        raw_csrf,
        expires_at,
    })
}

fn session_response(session: SessionTokens, passkey_required: bool) -> AuthRouteOutput {
    AuthRouteOutput {
        status: 200,
        body: json!({
            "ok": true,
            "csrfToken": session.raw_csrf,
            "expiresAt": session.expires_at,
            "passkeyRequired": passkey_required,
        }),
        headers: vec![session_cookie(&session.raw_session)],
    }
}

async fn authorize_session_for_auth(
    pool: &DbPool,
    headers: &HashMap<String, String>,
) -> Result<AuthorizedSession, String> {
    let session = extract_cookie(headers, SESSION_COOKIE)
        .ok_or_else(|| "Session de pairing manquante.".to_string())?;
    let row = sqlx::query(
        "SELECT id, expires_at, revoked_at FROM mobile_sessions WHERE session_hash = $1",
    )
    .bind(hash_secret(&session))
    .fetch_optional(pool)
    .await
    .map_err(|e| map_db_error(e, "lecture de session mobile"))?
    .ok_or_else(|| "Session de pairing invalide.".to_string())?;

    let expires_at = row
        .try_get::<String, _>("expires_at")
        .map_err(|e| e.to_string())?;
    let revoked_at = row
        .try_get::<Option<String>, _>("revoked_at")
        .unwrap_or(None);
    if revoked_at.is_some() || is_past(&expires_at) {
        return Err("Session de pairing expirée.".to_string());
    }

    Ok(AuthorizedSession {
        id: row.try_get::<String, _>("id").map_err(|e| e.to_string())?,
    })
}

async fn revoke_session(pool: &DbPool, id: &str) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query("UPDATE mobile_sessions SET revoked_at = $1 WHERE id = $2")
        .bind(now)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| map_db_error(e, "révocation de session mobile"))?;
    Ok(())
}

async fn insert_passkey(
    pool: &DbPool,
    passkey: &PasskeyCredential,
    device_label: Option<&str>,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let public_key = serde_json::to_string(passkey).map_err(|e| e.to_string())?;
    sqlx::query(
        "INSERT INTO mobile_passkeys
            (id, credential_id, public_key, counter, device_label, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(&id)
    .bind(passkey.id.to_b64url())
    .bind(public_key)
    .bind(i64::from(passkey.counter))
    .bind(device_label)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "enregistrement de la passkey mobile"))?;
    Ok(id)
}

async fn list_active_credentials(pool: &DbPool) -> Result<Vec<CredentialId>, String> {
    Ok(list_active_passkeys(pool)
        .await?
        .into_iter()
        .map(|passkey| passkey.id)
        .collect())
}

async fn list_active_passkeys(pool: &DbPool) -> Result<Vec<PasskeyCredential>, String> {
    let rows = sqlx::query(
        "SELECT public_key FROM mobile_passkeys WHERE revoked_at IS NULL ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| map_db_error(e, "lecture des passkeys mobiles"))?;

    rows.into_iter()
        .map(|row| {
            let value = row
                .try_get::<String, _>("public_key")
                .map_err(|e| e.to_string())?;
            serde_json::from_str::<PasskeyCredential>(&value).map_err(|e| e.to_string())
        })
        .collect()
}

async fn find_passkey_by_credential_id(
    pool: &DbPool,
    credential_id: &str,
) -> Result<StoredCredential, String> {
    let row = sqlx::query(
        "SELECT id, public_key FROM mobile_passkeys
         WHERE credential_id = $1 AND revoked_at IS NULL",
    )
    .bind(credential_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| map_db_error(e, "lecture de passkey mobile"))?
    .ok_or_else(|| "Passkey mobile inconnue.".to_string())?;

    let id = row.try_get::<String, _>("id").map_err(|e| e.to_string())?;
    let public_key = row
        .try_get::<String, _>("public_key")
        .map_err(|e| e.to_string())?;
    let passkey = serde_json::from_str::<PasskeyCredential>(&public_key)
        .map_err(|e| format!("Passkey stockée invalide: {e}"))?;
    Ok(StoredCredential { id, passkey })
}

async fn update_passkey_usage(
    pool: &DbPool,
    id: &str,
    counter: i64,
    device_label: Option<&str>,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE mobile_passkeys
         SET counter = $1,
             last_used_at = $2,
             device_label = CASE
                WHEN $3 IS NOT NULL AND length($3) > 0 THEN $3
                ELSE device_label
             END
         WHERE id = $4",
    )
        .bind(counter)
        .bind(now)
        .bind(device_label)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| map_db_error(e, "mise à jour de passkey mobile"))?;
    Ok(())
}

async fn list_passkeys(pool: &DbPool) -> Result<Vec<MobilePasskeyInfo>, String> {
    let rows = sqlx::query(
        "SELECT id, credential_id, device_label, created_at, last_used_at, revoked_at
         FROM mobile_passkeys ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| map_db_error(e, "lecture des passkeys mobiles"))?;

    Ok(rows
        .into_iter()
        .map(|row| MobilePasskeyInfo {
            id: row.try_get::<String, _>("id").unwrap_or_default(),
            credential_id: row
                .try_get::<String, _>("credential_id")
                .unwrap_or_default(),
            device_label: row
                .try_get::<Option<String>, _>("device_label")
                .unwrap_or(None),
            created_at: row.try_get::<String, _>("created_at").unwrap_or_default(),
            last_used_at: row
                .try_get::<Option<String>, _>("last_used_at")
                .unwrap_or(None),
            revoked_at: row
                .try_get::<Option<String>, _>("revoked_at")
                .unwrap_or(None),
        })
        .collect())
}

async fn store_challenge<T: Serialize>(
    pool: &DbPool,
    kind: &str,
    state: &T,
    session_id: Option<&str>,
    device_label: Option<&str>,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let expires_at = (Utc::now() + ChronoDuration::minutes(CHALLENGE_TTL_MINUTES)).to_rfc3339();
    let state_json = serde_json::to_string(state).map_err(|e| e.to_string())?;
    sqlx::query(
        "INSERT INTO mobile_auth_challenges
            (id, kind, state_json, session_id, device_label, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(&id)
    .bind(kind)
    .bind(state_json)
    .bind(session_id)
    .bind(device_label)
    .bind(expires_at)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "création du challenge passkey"))?;
    Ok(id)
}

async fn load_challenge<T: for<'de> Deserialize<'de>>(
    pool: &DbPool,
    id: &str,
    kind: &str,
    session_id: Option<&str>,
) -> Result<T, String> {
    let query = sqlx::query(
        "SELECT state_json, expires_at, session_id
         FROM mobile_auth_challenges WHERE id = $1 AND kind = $2",
    )
    .bind(id)
    .bind(kind);

    let row = query
        .fetch_optional(pool)
        .await
        .map_err(|e| map_db_error(e, "lecture du challenge passkey"))?
        .ok_or_else(|| "Challenge passkey introuvable.".to_string())?;
    let expires_at = row
        .try_get::<String, _>("expires_at")
        .map_err(|e| e.to_string())?;
    if is_past(&expires_at) {
        return Err("Challenge passkey expiré.".to_string());
    }
    let stored_session = row
        .try_get::<Option<String>, _>("session_id")
        .unwrap_or(None);
    if stored_session.as_deref() != session_id {
        return Err("Challenge passkey non autorisé.".to_string());
    }
    let state_json = row
        .try_get::<String, _>("state_json")
        .map_err(|e| e.to_string())?;
    serde_json::from_str(&state_json).map_err(|e| e.to_string())
}

async fn delete_challenge(pool: &DbPool, id: &str) -> Result<(), String> {
    sqlx::query("DELETE FROM mobile_auth_challenges WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| map_db_error(e, "suppression du challenge passkey"))?;
    Ok(())
}

fn build_webauthn(settings: &SecureBridgeSettings) -> Result<Webauthn, String> {
    let origin = secure_app_origin(settings).ok_or_else(|| "Origine PWA manquante.".to_string())?;
    let rp_id = settings
        .domain
        .as_deref()
        .ok_or_else(|| "Domaine du pont sécurisé manquant.".to_string())?;
    Ok(Webauthn::new(rp_id, "DmxMoney", &origin).require_user_verification(true))
}

async fn ensure_certificate(
    pool: &DbPool,
    app_handle: &AppHandle,
    settings: &SecureBridgeSettings,
    local_host: &str,
    force: bool,
) -> Result<(), String> {
    let expires_soon = settings
        .certificate_expires_at
        .as_deref()
        .and_then(|value| chrono::DateTime::parse_from_rfc3339(value).ok())
        .map(|value| {
            value.with_timezone(&Utc) < Utc::now() + ChronoDuration::days(CERT_RENEW_WINDOW_DAYS)
        })
        .unwrap_or(true);
    let paths = certificate_paths(app_handle, settings.device_id.as_deref())
        .ok_or_else(|| "Device ID du pont sécurisé manquant.".to_string())?;
    if !force && paths.cert.exists() && paths.key.exists() && !expires_soon {
        return Ok(());
    }

    fs::create_dir_all(&paths.dir)
        .map_err(|e| format!("Création du dossier certificat impossible: {e}"))?;

    let contact: [&str; 0] = [];
    let new_account = NewAccount {
        contact: &contact,
        terms_of_service_agreed: true,
        only_return_existing: false,
    };
    let (account, _credentials) =
        Account::create(&new_account, LetsEncrypt::Production.url(), None)
            .await
            .map_err(|e| format!("Création du compte ACME impossible: {e}"))?;
    let identifiers = [Identifier::Dns(local_host.to_string())];
    let mut order = account
        .new_order(&NewOrder {
            identifiers: &identifiers,
        })
        .await
        .map_err(|e| format!("Création de commande ACME impossible: {e}"))?;

    let txt_name = format!("_acme-challenge.{local_host}");
    let mut txt_record_ids = Vec::new();
    for authz in order
        .authorizations()
        .await
        .map_err(|e| format!("Lecture des autorisations ACME impossible: {e}"))?
    {
        if authz.status == AuthorizationStatus::Valid {
            continue;
        }
        let challenge = authz
            .challenges
            .iter()
            .find(|challenge| challenge.r#type == ChallengeType::Dns01)
            .ok_or_else(|| "Challenge DNS-01 indisponible chez Let's Encrypt.".to_string())?;
        let dns_value = order.key_authorization(challenge).dns_value();
        let txt_id = managed_present_txt(settings, &txt_name, &dns_value).await?;
        txt_record_ids.push(txt_id);

        if let Err(error) = wait_for_dns_txt(&txt_name, &dns_value).await {
            cleanup_txt_records(settings, &mut txt_record_ids).await;
            return Err(error);
        }
        thread::sleep(Duration::from_secs(10));
        if let Err(error) = order.set_challenge_ready(&challenge.url).await {
            cleanup_txt_records(settings, &mut txt_record_ids).await;
            return Err(format!("Validation DNS-01 impossible: {error}"));
        }

        for _ in 0..12 {
            let current = order
                .challenge(&challenge.url)
                .await
                .map_err(|e| format!("Suivi du challenge DNS-01 impossible: {e}"))?;
            if format!("{:?}", current.status) == "Valid" {
                break;
            }
            if format!("{:?}", current.status) == "Invalid" {
                cleanup_txt_records(settings, &mut txt_record_ids).await;
                return Err("Challenge DNS-01 refusé par Let's Encrypt.".to_string());
            }
            thread::sleep(Duration::from_secs(5));
        }
    }

    let key_pair = KeyPair::generate().map_err(|e| format!("Création clé TLS impossible: {e}"))?;
    let mut params = CertificateParams::new(vec![local_host.to_string()])
        .map_err(|e| format!("Création CSR impossible: {e}"))?;
    // Let's Encrypt rejects rcgen's default Common Name.
    params.distinguished_name = DistinguishedName::new();
    log::info!("Finalizing ACME order with SAN-only CSR for {local_host}");
    let csr = params
        .serialize_request(&key_pair)
        .map_err(|e| format!("Sérialisation CSR impossible: {e}"))?;

    for _ in 0..12 {
        let state = order
            .refresh()
            .await
            .map_err(|e| format!("Rafraîchissement commande ACME impossible: {e}"))?;
        if matches!(state.status, OrderStatus::Ready | OrderStatus::Valid) {
            break;
        }
        if matches!(state.status, OrderStatus::Invalid) {
            cleanup_txt_records(settings, &mut txt_record_ids).await;
            return Err("Commande ACME invalide.".to_string());
        }
        thread::sleep(Duration::from_secs(5));
    }

    if order.state().status != OrderStatus::Valid {
        if let Err(error) = order.finalize(csr.der().as_ref()).await {
            cleanup_txt_records(settings, &mut txt_record_ids).await;
            return Err(format!("Finalisation certificat ACME impossible: {error}"));
        }
    }

    let mut cert_pem = None;
    for _ in 0..12 {
        if let Some(cert) = order
            .certificate()
            .await
            .map_err(|e| format!("Téléchargement certificat ACME impossible: {e}"))?
        {
            cert_pem = Some(cert);
            break;
        }
        thread::sleep(Duration::from_secs(5));
    }

    let cert_pem = cert_pem.ok_or_else(|| "Certificat ACME non disponible.".to_string())?;
    fs::write(&paths.cert, cert_pem)
        .map_err(|e| format!("Sauvegarde certificat HTTPS impossible: {e}"))?;
    fs::write(&paths.key, key_pair.serialize_pem())
        .map_err(|e| format!("Sauvegarde clé HTTPS impossible: {e}"))?;

    cleanup_txt_records(settings, &mut txt_record_ids).await;

    let expires_at = (Utc::now() + ChronoDuration::days(90)).to_rfc3339();
    sqlx::query(
        "UPDATE settings SET
            \"secureBridgeCertificateExpiresAt\" = $1,
            \"secureBridgeLastError\" = NULL
         WHERE id = 1",
    )
    .bind(expires_at)
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "sauvegarde expiration certificat"))?;

    Ok(())
}

#[derive(Debug)]
struct CertificatePaths {
    dir: PathBuf,
    cert: PathBuf,
    key: PathBuf,
}

fn certificate_paths(app_handle: &AppHandle, device_id: Option<&str>) -> Option<CertificatePaths> {
    let device_id = device_id?;
    let dir = app_handle
        .path()
        .app_data_dir()
        .ok()?
        .join("secure-bridge")
        .join(device_id);
    Some(CertificatePaths {
        cert: dir.join("cert.pem"),
        key: dir.join("key.pem"),
        dir,
    })
}

async fn wait_for_dns_txt(name: &str, expected_value: &str) -> Result<(), String> {
    let client = reqwest::Client::new();
    let mut last_seen = Vec::new();
    for attempt in 0..30 {
        match client
            .get("https://cloudflare-dns.com/dns-query")
            .header("accept", "application/dns-json")
            .query(&[("name", name), ("type", "TXT")])
            .send()
            .await
        {
            Ok(response) if response.status().is_success() => {
                let body = response
                    .text()
                    .await
                    .map_err(|e| format!("Réponse DNS-01 illisible: {e}"))?;
                if let Ok(parsed) = serde_json::from_str::<DnsJsonResponse>(&body) {
                    last_seen = parsed
                        .answer
                        .unwrap_or_default()
                        .into_iter()
                        .map(|answer| normalize_txt_answer(&answer.data))
                        .collect();
                    if last_seen.iter().any(|value| value == expected_value) {
                        return Ok(());
                    }
                }
            }
            Ok(response) => {
                last_seen = vec![format!("HTTP {}", response.status())];
            }
            Err(error) => {
                last_seen = vec![error.to_string()];
            }
        }

        let delay = if attempt < 6 { 5 } else { 10 };
        thread::sleep(Duration::from_secs(delay));
    }

    let detail = if last_seen.is_empty() {
        "aucun TXT visible".to_string()
    } else {
        format!("TXT visibles: {}", last_seen.join(", "))
    };
    Err(format!(
        "TXT DNS-01 non propagé pour {name} avant validation Let's Encrypt ({detail})."
    ))
}

fn normalize_txt_answer(value: &str) -> String {
    value
        .trim()
        .trim_matches('"')
        .replace("\" \"", "")
        .replace("\\\"", "\"")
}

async fn cleanup_txt_records(settings: &SecureBridgeSettings, txt_record_ids: &mut Vec<String>) {
    let ids = std::mem::take(txt_record_ids);
    for txt_id in ids {
        let _ = managed_delete_txt(settings, &txt_id).await;
    }
}

fn managed_service_base_url(stored: Option<&str>) -> String {
    option_env!("DMXMONEY_MANAGED_BRIDGE_URL")
        .and_then(normalize_managed_service_url)
        .or_else(|| stored.and_then(normalize_managed_service_url))
        .unwrap_or(DEFAULT_MANAGED_SERVICE_URL)
        .to_string()
}

fn normalize_managed_service_url(value: &str) -> Option<&str> {
    let trimmed = value.trim().trim_end_matches('/');
    if trimmed.is_empty() || trimmed == LEGACY_MANAGED_SERVICE_URL {
        None
    } else {
        Some(trimmed)
    }
}

async fn managed_register_device(
    existing_device_id: Option<&str>,
) -> Result<ManagedRegisterResponse, String> {
    let base_url = managed_service_base_url(None);
    let payload = ManagedRegisterRequest {
        existing_device_id: existing_device_id.map(str::to_string),
        local_ip: super::mobile_companion::detect_local_ip(),
    };
    let client = reqwest::Client::new();
    let mut request = client
        .post(format!("{base_url}/v1/devices/register"))
        .json(&payload);
    if let Some(secret) = get_managed_registration_secret() {
        request = request.bearer_auth(secret);
    }
    let response = request
        .send()
        .await
        .map_err(|e| format!("Service DmxMoney Bridge indisponible ({base_url}): {e}"))?;
    let registration = parse_managed_response::<ManagedRegisterResponse>(
        response,
        "Provisionnement DmxMoney Bridge",
    )
    .await?;
    if registration.device_id.trim().is_empty()
        || registration.device_secret.trim().is_empty()
        || registration.domain.trim().is_empty()
        || registration.app_url.trim().is_empty()
        || registration.local_host.trim().is_empty()
    {
        return Err("Provisionnement DmxMoney Bridge incomplet.".to_string());
    }
    Ok(registration)
}

async fn managed_update_dns(
    settings: &SecureBridgeSettings,
    local_host: &str,
    local_ip: &str,
) -> Result<String, String> {
    let (base_url, device_id, secret) = managed_credentials(settings)?;
    let response = reqwest::Client::new()
        .post(format!("{base_url}/v1/devices/{device_id}/dns"))
        .bearer_auth(secret)
        .json(&ManagedDnsUpdateRequest {
            local_ip,
            local_host,
        })
        .send()
        .await
        .map_err(|e| format!("Mise à jour DNS DmxMoney Bridge impossible: {e}"))?;
    parse_managed_response::<ManagedDnsUpdateResponse>(response, "Mise à jour DNS DmxMoney Bridge")
        .await
        .map(|record| record.record_id)
}

async fn managed_present_txt(
    settings: &SecureBridgeSettings,
    name: &str,
    value: &str,
) -> Result<String, String> {
    let (base_url, device_id, secret) = managed_credentials(settings)?;
    let response = reqwest::Client::new()
        .post(format!("{base_url}/v1/devices/{device_id}/acme/txt"))
        .bearer_auth(secret)
        .json(&ManagedTxtRequest { name, value })
        .send()
        .await
        .map_err(|e| format!("Création TXT ACME DmxMoney Bridge impossible: {e}"))?;
    parse_managed_response::<ManagedDnsUpdateResponse>(
        response,
        "Création TXT ACME DmxMoney Bridge",
    )
    .await
    .map(|record| record.record_id)
}

async fn managed_delete_txt(
    settings: &SecureBridgeSettings,
    record_id: &str,
) -> Result<(), String> {
    let (base_url, device_id, secret) = managed_credentials(settings)?;
    let response = reqwest::Client::new()
        .post(format!("{base_url}/v1/devices/{device_id}/acme/txt/delete"))
        .bearer_auth(secret)
        .json(&ManagedTxtDeleteRequest { record_id })
        .send()
        .await
        .map_err(|e| format!("Suppression TXT ACME DmxMoney Bridge impossible: {e}"))?;
    let status = response.status();
    if status.is_success() {
        Ok(())
    } else {
        let body = response.text().await.unwrap_or_default();
        Err(format!(
            "Suppression TXT ACME DmxMoney Bridge refusée ({status}): {body}"
        ))
    }
}

fn managed_credentials(
    settings: &SecureBridgeSettings,
) -> Result<(String, String, String), String> {
    let base_url = managed_service_base_url(settings.managed_service_url.as_deref());
    let device_id = settings
        .device_id
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Device ID DmxMoney Bridge manquant.".to_string())?
        .to_string();
    let secret = get_available_managed_device_secret()?;
    Ok((base_url, device_id, secret))
}

fn has_managed_device_secret() -> bool {
    get_available_managed_device_secret()
        .map(|secret| !secret.is_empty())
        .unwrap_or(false)
}

fn get_available_managed_device_secret() -> Result<String, String> {
    get_managed_device_secret().and_then(|secret| {
        if secret.is_empty() {
            Err("Secret DmxMoney Bridge vide.".to_string())
        } else {
            Ok(secret)
        }
    })
}

fn is_missing_managed_secret_error(error: &str) -> bool {
    error.contains("Secret DmxMoney Bridge absent")
        || error.contains("No matching entry found in secure storage")
}

async fn parse_managed_response<T: for<'de> Deserialize<'de>>(
    response: reqwest::Response,
    context: &str,
) -> Result<T, String> {
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Réponse DmxMoney Bridge illisible: {e}"))?;
    if !status.is_success() {
        if status.as_u16() == 401 || status.as_u16() == 403 {
            return Err(format!(
                "{context} refusé ({status}): pont managé non autorisé pour cette installation"
            ));
        }
        return Err(format!("{context} refusé ({status}): {body}"));
    }
    serde_json::from_str(&body).map_err(|e| format!("Réponse DmxMoney Bridge invalide: {e}"))
}

fn generate_token(length: usize) -> String {
    let mut bytes = vec![0u8; length];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn hash_secret(value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(value.as_bytes());
    URL_SAFE_NO_PAD.encode(hasher.finalize())
}

fn constant_time_eq(left: &str, right: &str) -> bool {
    left.as_bytes().ct_eq(right.as_bytes()).into()
}

fn normalize_domain(value: &str) -> Result<String, String> {
    let trimmed = value
        .trim()
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .trim_matches('/');
    if trimmed.is_empty() || trimmed.contains('/') || trimmed.contains(':') {
        return Err("Domaine invalide.".to_string());
    }
    Ok(trimmed.to_ascii_lowercase())
}

fn normalize_host(value: &str) -> Result<String, String> {
    let host = normalize_domain(value)?;
    if host.split('.').count() < 2 {
        return Err("Hôte local invalide.".to_string());
    }
    Ok(host)
}

fn normalize_url(value: &str) -> Result<String, String> {
    let url = url::Url::parse(value.trim()).map_err(|_| "URL PWA invalide.".to_string())?;
    if url.scheme() != "https" {
        return Err("L’URL PWA doit être en HTTPS.".to_string());
    }
    Ok(url.to_string().trim_end_matches('/').to_string())
}

fn parse_json<T: for<'de> Deserialize<'de>>(body: &[u8]) -> Result<T, String> {
    serde_json::from_slice(body).map_err(|e| format!("JSON invalide: {e}"))
}

fn parse_json_or_default<T: for<'de> Deserialize<'de> + Default>(body: &[u8]) -> Result<T, String> {
    if body.is_empty() {
        return Ok(T::default());
    }
    parse_json(body)
}

fn is_past(value: &str) -> bool {
    chrono::DateTime::parse_from_rfc3339(value)
        .map(|date| date.with_timezone(&Utc) <= Utc::now())
        .unwrap_or(true)
}

fn extract_cookie(headers: &HashMap<String, String>, name: &str) -> Option<String> {
    headers.get("cookie").and_then(|cookie| {
        cookie.split(';').find_map(|part| {
            let (key, value) = part.trim().split_once('=')?;
            if key == name {
                Some(value.to_string())
            } else {
                None
            }
        })
    })
}

fn session_cookie(value: &str) -> (String, String) {
    (
        "Set-Cookie".to_string(),
        format!(
            "{SESSION_COOKIE}={value}; Path=/; Max-Age={}; Secure; HttpOnly; SameSite=Strict",
            SESSION_TTL_MINUTES * 60
        ),
    )
}

fn clear_session_cookie() -> (String, String) {
    (
        "Set-Cookie".to_string(),
        format!("{SESSION_COOKIE}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict"),
    )
}

fn managed_device_secret_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_MANAGED_DEVICE_SECRET)
        .map_err(|e| format!("Trousseau système indisponible: {e}"))
}

fn set_managed_device_secret(secret: &str) -> Result<(), String> {
    managed_device_secret_entry()?
        .set_password(secret)
        .map_err(|e| format!("Sauvegarde secret DmxMoney Bridge impossible: {e}"))
}

fn get_managed_device_secret() -> Result<String, String> {
    managed_device_secret_entry()?
        .get_password()
        .map_err(|e| format!("Secret DmxMoney Bridge absent du trousseau: {e}"))
}

fn managed_registration_secret_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_MANAGED_REGISTRATION_SECRET)
        .map_err(|e| format!("Trousseau système indisponible: {e}"))
}

fn get_managed_registration_secret() -> Option<String> {
    option_env!("DMXMONEY_MANAGED_BRIDGE_REGISTRATION_SECRET")
        .map(str::trim)
        .filter(|secret| !secret.is_empty())
        .map(str::to_string)
        .or_else(|| {
            managed_registration_secret_entry()
                .ok()
                .and_then(|entry| entry.get_password().ok())
                .map(|secret| secret.trim().to_string())
                .filter(|secret| !secret.is_empty())
        })
}

fn map_db_error(e: sqlx::Error, context: &str) -> String {
    let err_msg = e.to_string();
    log::error!("Database Error during {context}: {err_msg}");
    format!("Erreur BDD ({context}): {err_msg}")
}
