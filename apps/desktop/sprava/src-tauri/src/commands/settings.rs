use serde_json::Value;
use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::state::AppState;

/// GET /settings
#[tauri::command]
pub async fn settings_get(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Value, AppError> {
    state.http.get(&app, "/settings").await
}

/// PATCH /settings (hcaptcha)
#[tauri::command]
pub async fn settings_update(
    app: AppHandle,
    state: State<'_, AppState>,
    body: Value,
) -> Result<Value, AppError> {
    state.http.patch(&app, "/settings", &body).await
}
