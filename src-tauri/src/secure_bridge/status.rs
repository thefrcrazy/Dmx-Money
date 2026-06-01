use super::*;

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
