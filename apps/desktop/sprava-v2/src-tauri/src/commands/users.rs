use serde_json::Value;
use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::state::AppState;

/// GET /users/me
#[tauri::command]
pub async fn users_get_me(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Value, AppError> {
    state.http.get(&app, "/users/me").await
}

/// PATCH /users/me
#[tauri::command]
pub async fn users_update_account(
    app: AppHandle,
    state: State<'_, AppState>,
    body: Value,
) -> Result<Value, AppError> {
    state.http.patch(&app, "/users/me", &body).await
}

/// PATCH /users/me/profile
#[tauri::command]
pub async fn users_update_profile(
    app: AppHandle,
    state: State<'_, AppState>,
    body: Value,
) -> Result<Value, AppError> {
    state.http.patch(&app, "/users/me/profile", &body).await
}

/// GET /users/search?q=
#[tauri::command]
pub async fn users_search(
    app: AppHandle,
    state: State<'_, AppState>,
    query: String,
) -> Result<Value, AppError> {
    state
        .http
        .get_with_query(&app, "/users/search", &[("q".into(), query)])
        .await
}

/// GET /users/:username
#[tauri::command]
pub async fn users_get_by_username(
    app: AppHandle,
    state: State<'_, AppState>,
    username: String,
) -> Result<Value, AppError> {
    state
        .http
        .get(&app, &format!("/users/{}", username))
        .await
}
