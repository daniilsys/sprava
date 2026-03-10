use serde_json::Value;
use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::state::AppState;

/// POST /uploads/avatar
#[tauri::command]
pub async fn upload_presign_avatar(
    app: AppHandle,
    state: State<'_, AppState>,
    body: Value,
) -> Result<Value, AppError> {
    state.http.post(&app, "/uploads/avatar", &body).await
}

/// POST /uploads/attachment
#[tauri::command]
pub async fn upload_presign_attachment(
    app: AppHandle,
    state: State<'_, AppState>,
    body: Value,
) -> Result<Value, AppError> {
    state.http.post(&app, "/uploads/attachment", &body).await
}

/// POST /uploads/server-icon
#[tauri::command]
pub async fn upload_presign_server_icon(
    app: AppHandle,
    state: State<'_, AppState>,
    body: Value,
) -> Result<Value, AppError> {
    state.http.post(&app, "/uploads/server-icon", &body).await
}

/// POST /uploads/group-icon
#[tauri::command]
pub async fn upload_presign_group_icon(
    app: AppHandle,
    state: State<'_, AppState>,
    body: Value,
) -> Result<Value, AppError> {
    state.http.post(&app, "/uploads/group-icon", &body).await
}
