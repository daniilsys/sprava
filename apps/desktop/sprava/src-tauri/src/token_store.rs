use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use crate::error::AppError;

const STORE_FILE: &str = "tokens.json";
const ACCESS_TOKEN_KEY: &str = "accessToken";
const REFRESH_TOKEN_KEY: &str = "refreshToken";

pub struct TokenStore;

impl TokenStore {
    pub fn get_access_token(app: &AppHandle) -> Result<Option<String>, AppError> {
        let store = app
            .store(STORE_FILE)
            .map_err(|e| AppError::Store(e.to_string()))?;
        Ok(store
            .get(ACCESS_TOKEN_KEY)
            .and_then(|v| v.as_str().map(|s| s.to_string())))
    }

    pub fn get_refresh_token(app: &AppHandle) -> Result<Option<String>, AppError> {
        let store = app
            .store(STORE_FILE)
            .map_err(|e| AppError::Store(e.to_string()))?;
        Ok(store
            .get(REFRESH_TOKEN_KEY)
            .and_then(|v| v.as_str().map(|s| s.to_string())))
    }

    pub fn set_tokens(
        app: &AppHandle,
        access_token: &str,
        refresh_token: &str,
    ) -> Result<(), AppError> {
        let store = app
            .store(STORE_FILE)
            .map_err(|e| AppError::Store(e.to_string()))?;
        store.set(
            ACCESS_TOKEN_KEY,
            serde_json::Value::String(access_token.to_string()),
        );
        store.set(
            REFRESH_TOKEN_KEY,
            serde_json::Value::String(refresh_token.to_string()),
        );
        store.save().map_err(|e| AppError::Store(e.to_string()))?;
        Ok(())
    }

    pub fn clear(app: &AppHandle) -> Result<(), AppError> {
        let store = app
            .store(STORE_FILE)
            .map_err(|e| AppError::Store(e.to_string()))?;
        store.delete(ACCESS_TOKEN_KEY);
        store.delete(REFRESH_TOKEN_KEY);
        store.save().map_err(|e| AppError::Store(e.to_string()))?;
        Ok(())
    }

    pub fn has_session(app: &AppHandle) -> Result<bool, AppError> {
        Ok(Self::get_refresh_token(app)?.is_some())
    }
}
