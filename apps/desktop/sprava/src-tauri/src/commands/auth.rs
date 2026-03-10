use serde_json::Value;
use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::state::AppState;
use crate::token_store::TokenStore;

#[derive(serde::Deserialize)]
struct AuthResponse {
    #[serde(rename = "accessToken")]
    access_token: String,
    #[serde(rename = "refreshToken")]
    refresh_token: String,
    user: Value,
}

/// POST /auth/register (unauthed, hcaptcha)
#[tauri::command]
pub async fn auth_register(
    app: AppHandle,
    state: State<'_, AppState>,
    body: Value,
) -> Result<Value, AppError> {
    let resp = state.http.post_unauthed("/auth/register", &body).await?;
    let auth: AuthResponse = serde_json::from_value(resp)?;
    TokenStore::set_tokens(&app, &auth.access_token, &auth.refresh_token)?;
    Ok(auth.user)
}

/// POST /auth/login (unauthed, hcaptcha)
#[tauri::command]
pub async fn auth_login(
    app: AppHandle,
    state: State<'_, AppState>,
    body: Value,
) -> Result<Value, AppError> {
    let resp = state.http.post_unauthed("/auth/login", &body).await?;
    let auth: AuthResponse = serde_json::from_value(resp)?;
    TokenStore::set_tokens(&app, &auth.access_token, &auth.refresh_token)?;
    Ok(auth.user)
}

/// POST /auth/logout (authed)
#[tauri::command]
pub async fn auth_logout(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    // Try to call the server logout, but clear tokens regardless
    let refresh_token = TokenStore::get_refresh_token(&app)?;
    if let Some(rt) = refresh_token {
        let body = serde_json::json!({ "refreshToken": rt });
        let _ = state.http.post_no_content(&app, "/auth/logout", &body).await;
    }
    TokenStore::clear(&app)?;
    Ok(())
}

/// GET /auth/verify-email?token= (unauthed)
#[tauri::command]
pub async fn auth_verify_email(
    state: State<'_, AppState>,
    token: String,
) -> Result<Value, AppError> {
    state
        .http
        .get_unauthed(&format!("/auth/verify-email?token={}", token))
        .await
}

/// POST /auth/resend-verification (authed)
#[tauri::command]
pub async fn auth_resend_verification(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Value, AppError> {
    state
        .http
        .post(&app, "/auth/resend-verification", &serde_json::json!({}))
        .await
}

/// PATCH /auth/change-password (authed)
#[tauri::command]
pub async fn auth_change_password(
    app: AppHandle,
    state: State<'_, AppState>,
    body: Value,
) -> Result<Value, AppError> {
    state.http.patch(&app, "/auth/change-password", &body).await
}

/// POST /auth/forgot-password (unauthed, hcaptcha)
#[tauri::command]
pub async fn auth_forgot_password(
    state: State<'_, AppState>,
    body: Value,
) -> Result<Value, AppError> {
    state.http.post_unauthed("/auth/forgot-password", &body).await
}

/// POST /auth/reset-password (unauthed)
#[tauri::command]
pub async fn auth_reset_password(
    state: State<'_, AppState>,
    body: Value,
) -> Result<Value, AppError> {
    state.http.post_unauthed("/auth/reset-password", &body).await
}
