use tauri::AppHandle;

use crate::error::AppError;
use crate::token_store::TokenStore;

/// Returns the current access token for socket.io auth
#[tauri::command]
pub async fn get_access_token(app: AppHandle) -> Result<Option<String>, AppError> {
    TokenStore::get_access_token(&app)
}

/// Checks if the user has a stored session (refresh token exists)
#[tauri::command]
pub async fn has_session(app: AppHandle) -> Result<bool, AppError> {
    TokenStore::has_session(&app)
}
