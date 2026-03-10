use serde_json::Value;
use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::state::AppState;

/// POST /channels
#[tauri::command]
pub async fn channel_create(
    app: AppHandle,
    state: State<'_, AppState>,
    body: Value,
) -> Result<Value, AppError> {
    state.http.post(&app, "/channels", &body).await
}

/// GET /channels/:id
#[tauri::command]
pub async fn channel_get_by_id(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<Value, AppError> {
    state.http.get(&app, &format!("/channels/{}", id)).await
}

/// PUT /channels/:id
#[tauri::command]
pub async fn channel_update(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    body: Value,
) -> Result<Value, AppError> {
    state
        .http
        .put(&app, &format!("/channels/{}", id), &body)
        .await
}

/// PATCH /channels/reorder/:serverId
#[tauri::command]
pub async fn channel_reorder(
    app: AppHandle,
    state: State<'_, AppState>,
    server_id: String,
    body: Value,
) -> Result<(), AppError> {
    state
        .http
        .patch_no_content(
            &app,
            &format!("/channels/reorder/{}", server_id),
            &body,
        )
        .await
}

/// DELETE /channels/:id
#[tauri::command]
pub async fn channel_delete(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<Value, AppError> {
    state.http.delete(&app, &format!("/channels/{}", id)).await
}

/// POST /channels/:id/messages
#[tauri::command]
pub async fn channel_send_message(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    body: Value,
) -> Result<Value, AppError> {
    state
        .http
        .post(&app, &format!("/channels/{}/messages", id), &body)
        .await
}

/// GET /channels/:id/messages?before=&limit=
#[tauri::command]
pub async fn channel_get_messages(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    before: Option<String>,
    limit: Option<u32>,
    around: Option<String>,
) -> Result<Value, AppError> {
    let mut query: Vec<(String, String)> = Vec::new();
    if let Some(b) = before {
        query.push(("before".into(), b));
    }
    if let Some(l) = limit {
        query.push(("limit".into(), l.to_string()));
    }
    if let Some(a) = around {
        query.push(("around".into(), a));
    }
    state
        .http
        .get_with_query(&app, &format!("/channels/{}/messages", id), &query)
        .await
}

/// GET /channels/:id/messages/search?q=
#[tauri::command]
pub async fn channel_search_messages(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    q: String,
) -> Result<Value, AppError> {
    state
        .http
        .get_with_query(
            &app,
            &format!("/channels/{}/messages/search", id),
            &[("q".to_string(), q)],
        )
        .await
}

/// GET /channels/:id/rules
#[tauri::command]
pub async fn channel_get_rules(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<Value, AppError> {
    state
        .http
        .get(&app, &format!("/channels/{}/rules", id))
        .await
}

/// PUT /channels/:id/rules
#[tauri::command]
pub async fn channel_upsert_rule(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    body: Value,
) -> Result<Value, AppError> {
    state
        .http
        .put(&app, &format!("/channels/{}/rules", id), &body)
        .await
}

/// DELETE /channels/:id/rules (with body)
#[tauri::command]
pub async fn channel_delete_rule(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    body: Value,
) -> Result<Value, AppError> {
    state
        .http
        .delete_with_body(&app, &format!("/channels/{}/rules", id), &body)
        .await
}

/// POST /channels/:id/pins
#[tauri::command]
pub async fn channel_pin_message(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    body: Value,
) -> Result<Value, AppError> {
    state
        .http
        .post(&app, &format!("/channels/{}/pins", id), &body)
        .await
}

/// DELETE /channels/:id/pins (with body, 204 response)
#[tauri::command]
pub async fn channel_unpin_message(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    body: Value,
) -> Result<(), AppError> {
    state
        .http
        .delete_no_content_with_body(&app, &format!("/channels/{}/pins", id), &body)
        .await
}

/// GET /channels/:id/pins
#[tauri::command]
pub async fn channel_get_pins(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<Value, AppError> {
    state
        .http
        .get(&app, &format!("/channels/{}/pins", id))
        .await
}

/// GET /channels/:id/read
#[tauri::command]
pub async fn channel_get_read_state(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<Value, AppError> {
    state
        .http
        .get(&app, &format!("/channels/{}/read", id))
        .await
}

/// POST /channels/:id/read
#[tauri::command]
pub async fn channel_update_read_state(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    body: Value,
) -> Result<Value, AppError> {
    state
        .http
        .post(&app, &format!("/channels/{}/read", id), &body)
        .await
}
