use super::*;

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

    pub(super) async fn status(&self) -> Result<MobileCompanionStatus, String> {
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

    pub(super) async fn set_secure_bridge_enabled(
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

    pub(super) async fn regenerate_secure_pairing_token(
        &self,
    ) -> Result<MobileCompanionStatus, String> {
        secure_bridge::ensure_auto_configuration(&self.pool, &self.app_handle).await?;
        let pairing = secure_bridge::regenerate_pairing_token(&self.pool).await?;
        *self.secure_pairing.lock().map_err(|e| e.to_string())? = Some(pairing);
        self.status().await
    }

    pub(super) async fn revoke_mobile_passkey(
        &self,
        passkey_id: String,
    ) -> Result<MobileCompanionStatus, String> {
        secure_bridge::revoke_passkey(&self.pool, passkey_id).await?;
        self.status().await
    }
}
