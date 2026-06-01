use super::*;

const MAX_BODY_BYTES: usize = 8 * 1024 * 1024;

pub(super) fn server_loop(
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
            (handle_request(request, pool, app_handle), origin)
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
pub(super) struct HttpRequest {
    pub(super) method: String,
    pub(super) path: String,
    pub(super) headers: HashMap<String, String>,
    pub(super) body: Vec<u8>,
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

fn handle_request(request: HttpRequest, pool: DbPool, app_handle: AppHandle) -> HttpResponse {
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
