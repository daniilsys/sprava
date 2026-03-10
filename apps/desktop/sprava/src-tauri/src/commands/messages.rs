use serde_json::Value;
use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::state::AppState;

/// PUT /messages/:messageId
#[tauri::command]
pub async fn message_edit(
    app: AppHandle,
    state: State<'_, AppState>,
    message_id: String,
    body: Value,
) -> Result<Value, AppError> {
    state
        .http
        .put(&app, &format!("/messages/{}", message_id), &body)
        .await
}

/// DELETE /messages/:messageId
#[tauri::command]
pub async fn message_delete(
    app: AppHandle,
    state: State<'_, AppState>,
    message_id: String,
) -> Result<Value, AppError> {
    state
        .http
        .delete(&app, &format!("/messages/{}", message_id))
        .await
}

/// POST /messages/:messageId/reactions
#[tauri::command]
pub async fn message_add_reaction(
    app: AppHandle,
    state: State<'_, AppState>,
    message_id: String,
    body: Value,
) -> Result<Value, AppError> {
    state
        .http
        .post(
            &app,
            &format!("/messages/{}/reactions", message_id),
            &body,
        )
        .await
}

/// DELETE /messages/:messageId/reactions
#[tauri::command]
pub async fn message_remove_reaction(
    app: AppHandle,
    state: State<'_, AppState>,
    message_id: String,
    body: Value,
) -> Result<Value, AppError> {
    state
        .http
        .delete_with_body(&app, &format!("/messages/{}/reactions", message_id), &body)
        .await
}

/// POST /messages/:messageId/reply
#[tauri::command]
pub async fn message_reply(
    app: AppHandle,
    state: State<'_, AppState>,
    message_id: String,
    body: Value,
) -> Result<Value, AppError> {
    state
        .http
        .post(&app, &format!("/messages/{}/reply", message_id), &body)
        .await
}
