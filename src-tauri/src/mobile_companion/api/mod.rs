use super::*;

mod accounts;
mod budgets;
mod categories;
mod scheduled;
mod settings;
mod transactions;

use self::accounts::{delete_account, insert_account, list_accounts, update_account};
use self::budgets::{delete_budget, insert_budget, list_budgets, update_budget};
use self::categories::{delete_category, insert_category, list_categories, update_category};
use self::scheduled::{
    delete_scheduled, insert_scheduled, list_scheduled, process_due_scheduled, update_scheduled,
};
use self::settings::{get_settings_record, save_settings_record};
use self::transactions::{
    delete_transaction, insert_transaction, insert_transfer, list_transactions, update_transaction,
    TransferPayload,
};

pub(super) async fn route_api_request(
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
