use super::*;

pub async fn ensure_auto_configuration(
    pool: &DbPool,
    _app_handle: &AppHandle,
) -> Result<(), String> {
    let current = load_settings(pool).await?;
    let has_secret = has_managed_device_secret();
    let has_bridge_identity = current
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
            .unwrap_or(false);
    let has_valid_certificate = current
        .certificate_expires_at
        .as_deref()
        .map(|value| !is_past(value))
        .unwrap_or(false);
    let has_config = has_bridge_identity && (has_secret || has_valid_certificate);

    if has_config {
        return Ok(());
    }

    if has_secret
        && current
            .device_id
            .as_deref()
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false)
    {
        repair_managed_configuration(pool, &current).await?;
        return Ok(());
    }

    provision_managed_device(pool, &current, true).await?;

    Ok(())
}

async fn repair_managed_configuration(
    pool: &DbPool,
    current: &SecureBridgeSettings,
) -> Result<(), String> {
    let device_id = current
        .device_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Device ID DmxMoney Bridge manquant.".to_string())?;
    let domain = current
        .domain
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(normalize_domain)
        .transpose()?
        .unwrap_or_else(|| DEFAULT_BRIDGE_DOMAIN.to_string());
    let app_url = current
        .app_url
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(normalize_url)
        .transpose()?
        .unwrap_or_else(|| {
            format!(
                "{}/mobile",
                managed_service_base_url(current.managed_service_url.as_deref())
            )
        });
    let local_host = current
        .local_host
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(normalize_host)
        .transpose()?
        .unwrap_or_else(|| format!("{DEFAULT_DEVICE_PREFIX}-{device_id}.sync.{domain}"));

    sqlx::query(
        "UPDATE settings SET
            \"secureBridgeDomain\" = $1,
            \"secureBridgeAppUrl\" = $2,
            \"secureBridgeLocalHost\" = $3,
            \"secureBridgeManagedServiceUrl\" = $4,
            \"secureBridgeLastError\" = NULL
         WHERE id = 1",
    )
    .bind(domain)
    .bind(app_url)
    .bind(local_host)
    .bind(managed_service_base_url(
        current.managed_service_url.as_deref(),
    ))
    .execute(pool)
    .await
    .map_err(|e| map_db_error(e, "réparation du pont sécurisé"))?;

    Ok(())
}

pub(super) async fn provision_managed_device(
    pool: &DbPool,
    current: &SecureBridgeSettings,
    preserve_existing_device: bool,
) -> Result<(), String> {
    let registration = managed_register_device(if preserve_existing_device {
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
        .map_err(|error| {
            format!("Secret DmxMoney Bridge non sauvegardé dans le trousseau: {error}")
        })?;

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
