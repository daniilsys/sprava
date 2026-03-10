use serde_json::Value;
use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::state::AppState;

/// POST /friendships/:username
#[tauri::command]
pub async fn friendship_send_request(
    app: AppHandle,
    state: State<'_, AppState>,
    username: String,
) -> Result<Value, AppError> {
    state
        .http
        .post(
            &app,
            &format!("/friendships/{}", username),
            &serde_json::json!({}),
        )
        .await
}

/// PUT /friendships
#[tauri::command]
pub async fn friendship_update(
    app: AppHandle,
    state: State<'_, AppState>,
    body: Value,
) -> Result<Value, AppError> {
    state.http.put(&app, "/friendships", &body).await
}

/// DELETE /friendships/:receiverId (cancel request)
#[tauri::command]
pub async fn friendship_cancel_request(
    app: AppHandle,
    state: State<'_, AppState>,
    receiver_id: String,
) -> Result<Value, AppError> {
    state
        .http
        .delete(&app, &format!("/friendships/{}", receiver_id))
        .await
}

/// DELETE /friendships/:receiverId/reject
#[tauri::command]
pub async fn friendship_reject_request(
    app: AppHandle,
    state: State<'_, AppState>,
    receiver_id: String,
) -> Result<Value, AppError> {
    state
        .http
        .delete(&app, &format!("/friendships/{}/reject", receiver_id))
        .await
}

/// DELETE /friendships/:receiverId/remove
#[tauri::command]
pub async fn friendship_remove(
    app: AppHandle,
    state: State<'_, AppState>,
    receiver_id: String,
) -> Result<Value, AppError> {
    state
        .http
        .delete(&app, &format!("/friendships/{}/remove", receiver_id))
        .await
}

/// DELETE /friendships/:receiverId/unblock
#[tauri::command]
pub async fn friendship_unblock(
    app: AppHandle,
    state: State<'_, AppState>,
    receiver_id: String,
) -> Result<Value, AppError> {
    state
        .http
        .delete(&app, &format!("/friendships/{}/unblock", receiver_id))
        .await
}

/// GET /friendships/friends
#[tauri::command]
pub async fn friendship_get_friends(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Value, AppError> {
    state.http.get(&app, "/friendships/friends").await
}

/// GET /friendships/blocked
#[tauri::command]
pub async fn friendship_get_blocked(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Value, AppError> {
    state.http.get(&app, "/friendships/blocked").await
}

/// GET /friendships/requests
#[tauri::command]
pub async fn friendship_get_requests(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Value, AppError> {
    state.http.get(&app, "/friendships/requests").await
}

/// GET /friendships/requests/sent
#[tauri::command]
pub async fn friendship_get_sent_requests(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Value, AppError> {
    state.http.get(&app, "/friendships/requests/sent").await
}
