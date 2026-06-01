use super::*;

pub(super) fn serve_static_asset(app_handle: &AppHandle, path: &str) -> HttpResponse {
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
