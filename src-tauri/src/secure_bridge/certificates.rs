use super::*;

#[derive(Debug, Deserialize)]
struct DnsJsonResponse {
    #[serde(rename = "Answer")]
    answer: Option<Vec<DnsJsonAnswer>>,
}

#[derive(Debug, Deserialize)]
struct DnsJsonAnswer {
    data: String,
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
        let local_ip = crate::mobile_companion::detect_local_ip();

        let record_id = match managed_update_dns(&settings, &local_host, &local_ip).await {
            Ok(record_id) => record_id,
            Err(error) if is_missing_managed_secret_error(&error) => {
                provision_managed_device(pool, &settings, true).await?;
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
pub(super) struct CertificatePaths {
    pub(super) dir: PathBuf,
    pub(super) cert: PathBuf,
    pub(super) key: PathBuf,
}

pub(super) fn certificate_paths(
    app_handle: &AppHandle,
    device_id: Option<&str>,
) -> Option<CertificatePaths> {
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
