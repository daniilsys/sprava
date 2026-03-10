use serde_json::Value;
use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::state::AppState;

/// POST /servers
#[tauri::command]
pub async fn server_create(
    app: AppHandle,
    state: State<'_, AppState>,
    body: Value,
) -> Result<Value, AppError> {
    state.http.post(&app, "/servers", &body).await
}

/// GET /servers/:id
#[tauri::command]
pub async fn server_get_by_id(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<Value, AppError> {
    state.http.get(&app, &format!("/servers/{}", id)).await
}

/// PUT /servers/:id
#[tauri::command]
pub async fn server_update(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    body: Value,
) -> Result<Value, AppError> {
    state
        .http
        .put(&app, &format!("/servers/{}", id), &body)
        .await
}

/// DELETE /servers/:id
#[tauri::command]
pub async fn server_delete(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), AppError> {
    state
        .http
        .delete_no_content(&app, &format!("/servers/{}", id))
        .await
}

/// GET /servers/:id/channels
#[tauri::command]
pub async fn server_get_channels(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<Value, AppError> {
    state
        .http
        .get(&app, &format!("/servers/{}/channels", id))
        .await
}

/// GET /servers/:id/members?cursor=...&limit=...
#[tauri::command]
pub async fn server_get_members(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    cursor: Option<String>,
    limit: Option<u32>,
) -> Result<Value, AppError> {
    let mut query: Vec<(String, String)> = Vec::new();
    if let Some(c) = cursor {
        query.push(("cursor".into(), c));
    }
    if let Some(l) = limit {
        query.push(("limit".into(), l.to_string()));
    }
    if query.is_empty() {
        state.http.get(&app, &format!("/servers/{}/members", id)).await
    } else {
        state
            .http
            .get_with_query(&app, &format!("/servers/{}/members", id), &query)
            .await
    }
}

/// GET /servers/:id/bans?cursor=...&limit=...
#[tauri::command]
pub async fn server_get_bans(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    cursor: Option<String>,
    limit: Option<u32>,
) -> Result<Value, AppError> {
    let mut query: Vec<(String, String)> = Vec::new();
    if let Some(c) = cursor {
        query.push(("cursor".into(), c));
    }
    if let Some(l) = limit {
        query.push(("limit".into(), l.to_string()));
    }
    if query.is_empty() {
        state.http.get(&app, &format!("/servers/{}/bans", id)).await
    } else {
        state
            .http
            .get_with_query(&app, &format!("/servers/{}/bans", id), &query)
            .await
    }
}

/// DELETE /servers/:serverId/members/:userId (kick member)
#[tauri::command]
pub async fn server_kick_member(
    app: AppHandle,
    state: State<'_, AppState>,
    server_id: String,
    user_id: String,
) -> Result<(), AppError> {
    state
        .http
        .delete_no_content(
            &app,
            &format!("/servers/{}/members/{}", server_id, user_id),
        )
        .await
}

/// POST /servers/:serverId/bans/:userId (ban member)
#[tauri::command]
pub async fn server_ban_member(
    app: AppHandle,
    state: State<'_, AppState>,
    server_id: String,
    user_id: String,
    body: Value,
) -> Result<(), AppError> {
    state
        .http
        .post_no_content(
            &app,
            &format!("/servers/{}/bans/{}", server_id, user_id),
            &body,
        )
        .await
}

/// DELETE /servers/:serverId/bans/:userId (unban member)
#[tauri::command]
pub async fn server_unban_member(
    app: AppHandle,
    state: State<'_, AppState>,
    server_id: String,
    user_id: String,
) -> Result<(), AppError> {
    state
        .http
        .delete_no_content(
            &app,
            &format!("/servers/{}/bans/{}", server_id, user_id),
        )
        .await
}

/// GET /servers/preview/:code (no auth required)
#[tauri::command]
pub async fn server_preview(
    app: AppHandle,
    state: State<'_, AppState>,
    code: String,
) -> Result<Value, AppError> {
    state
        .http
        .get(&app, &format!("/servers/preview/{}", code))
        .await
}

/// POST /servers/join/:code (hcaptcha)
#[tauri::command]
pub async fn server_join(
    app: AppHandle,
    state: State<'_, AppState>,
    code: String,
    body: Value,
) -> Result<Value, AppError> {
    state
        .http
        .post(&app, &format!("/servers/join/{}", code), &body)
        .await
}

/// DELETE /servers/leave/:id
#[tauri::command]
pub async fn server_leave(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), AppError> {
    state
        .http
        .delete_no_content(&app, &format!("/servers/leave/{}", id))
        .await
}

/// GET /servers/:id/audit-log?cursor=...&limit=...&actionType=...
#[tauri::command]
pub async fn server_get_audit_log(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    cursor: Option<String>,
    limit: Option<u32>,
    action_type: Option<String>,
) -> Result<Value, AppError> {
    let mut query: Vec<(String, String)> = Vec::new();
    if let Some(c) = cursor {
        query.push(("cursor".into(), c));
    }
    if let Some(l) = limit {
        query.push(("limit".into(), l.to_string()));
    }
    if let Some(a) = action_type {
        query.push(("actionType".into(), a));
    }
    if query.is_empty() {
        state
            .http
            .get(&app, &format!("/servers/{}/audit-log", id))
            .await
    } else {
        state
            .http
            .get_with_query(&app, &format!("/servers/{}/audit-log", id), &query)
            .await
    }
}

/// POST /servers/:id/regenerate-invite
#[tauri::command]
pub async fn server_regenerate_invite(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<Value, AppError> {
    state
        .http
        .post(
            &app,
            &format!("/servers/{}/regenerate-invite", id),
            &serde_json::json!({}),
        )
        .await
}

/// PATCH /servers/:id/owner (hcaptcha)
#[tauri::command]
pub async fn server_transfer_ownership(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    body: Value,
) -> Result<Value, AppError> {
    state
        .http
        .patch(&app, &format!("/servers/{}/owner", id), &body)
        .await
}
