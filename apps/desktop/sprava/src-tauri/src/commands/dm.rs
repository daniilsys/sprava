use serde_json::Value;
use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::state::AppState;

/// POST /dm
#[tauri::command]
pub async fn dm_create(
    app: AppHandle,
    state: State<'_, AppState>,
    body: Value,
) -> Result<Value, AppError> {
    state.http.post(&app, "/dm", &body).await
}

/// GET /dm
#[tauri::command]
pub async fn dm_get_conversations(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Value, AppError> {
    state.http.get(&app, "/dm").await
}

/// PATCH /dm/:id
#[tauri::command]
pub async fn dm_update(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    body: Value,
) -> Result<Value, AppError> {
    state.http.patch(&app, &format!("/dm/{}", id), &body).await
}

/// DELETE /dm/:id/leave
#[tauri::command]
pub async fn dm_leave_group(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<Value, AppError> {
    state
        .http
        .delete(&app, &format!("/dm/{}/leave", id))
        .await
}

/// POST /dm/:id/participants/:participantId
#[tauri::command]
pub async fn dm_add_participant(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    participant_id: String,
) -> Result<Value, AppError> {
    state
        .http
        .post(
            &app,
            &format!("/dm/{}/participants/{}", id, participant_id),
            &serde_json::json!({}),
        )
        .await
}

/// DELETE /dm/:id/participants/:participantId
#[tauri::command]
pub async fn dm_remove_participant(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    participant_id: String,
) -> Result<Value, AppError> {
    state
        .http
        .delete(&app, &format!("/dm/{}/participants/{}", id, participant_id))
        .await
}

/// POST /dm/:id/messages
#[tauri::command]
pub async fn dm_send_message(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    body: Value,
) -> Result<Value, AppError> {
    state
        .http
        .post(&app, &format!("/dm/{}/messages", id), &body)
        .await
}

/// GET /dm/:id/messages?before=&limit=&around=
#[tauri::command]
pub async fn dm_get_messages(
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
        .get_with_query(&app, &format!("/dm/{}/messages", id), &query)
        .await
}

/// GET /dm/:id/messages/search?q=
#[tauri::command]
pub async fn dm_search_messages(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    q: String,
) -> Result<Value, AppError> {
    let query = vec![("q".to_string(), q)];
    state
        .http
        .get_with_query(&app, &format!("/dm/{}/messages/search", id), &query)
        .await
}

/// POST /dm/:id/pins
#[tauri::command]
pub async fn dm_pin_message(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    body: Value,
) -> Result<Value, AppError> {
    state
        .http
        .post(&app, &format!("/dm/{}/pins", id), &body)
        .await
}

/// DELETE /dm/:id/pins (with body, 204 response)
#[tauri::command]
pub async fn dm_unpin_message(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    body: Value,
) -> Result<(), AppError> {
    state
        .http
        .delete_no_content_with_body(&app, &format!("/dm/{}/pins", id), &body)
        .await
}

/// GET /dm/:id/pins
#[tauri::command]
pub async fn dm_get_pins(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<Value, AppError> {
    state
        .http
        .get(&app, &format!("/dm/{}/pins", id))
        .await
}

/// GET /dm/:id/read
#[tauri::command]
pub async fn dm_get_read_state(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<Value, AppError> {
    state
        .http
        .get(&app, &format!("/dm/{}/read", id))
        .await
}

/// POST /dm/:id/read
#[tauri::command]
pub async fn dm_update_read_state(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    body: Value,
) -> Result<Value, AppError> {
    state
        .http
        .post(&app, &format!("/dm/{}/read", id), &body)
        .await
}
