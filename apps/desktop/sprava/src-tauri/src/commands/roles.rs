use serde_json::Value;
use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::state::AppState;

/// GET /servers/:serverId/roles
#[tauri::command]
pub async fn roles_list(
    app: AppHandle,
    state: State<'_, AppState>,
    server_id: String,
) -> Result<Value, AppError> {
    state
        .http
        .get(&app, &format!("/servers/{}/roles", server_id))
        .await
}

/// GET /servers/:serverId/roles/:memberId (get member roles)
#[tauri::command]
pub async fn roles_get_member_roles(
    app: AppHandle,
    state: State<'_, AppState>,
    server_id: String,
    member_id: String,
) -> Result<Value, AppError> {
    state
        .http
        .get(&app, &format!("/servers/{}/roles/{}", server_id, member_id))
        .await
}

/// POST /servers/:serverId/roles
#[tauri::command]
pub async fn roles_create(
    app: AppHandle,
    state: State<'_, AppState>,
    server_id: String,
    body: Value,
) -> Result<Value, AppError> {
    state
        .http
        .post(&app, &format!("/servers/{}/roles", server_id), &body)
        .await
}

/// PATCH /servers/:serverId/roles/:roleId
#[tauri::command]
pub async fn roles_update(
    app: AppHandle,
    state: State<'_, AppState>,
    server_id: String,
    role_id: String,
    body: Value,
) -> Result<Value, AppError> {
    state
        .http
        .patch(
            &app,
            &format!("/servers/{}/roles/{}", server_id, role_id),
            &body,
        )
        .await
}

/// DELETE /servers/:serverId/roles/:roleId
#[tauri::command]
pub async fn roles_delete(
    app: AppHandle,
    state: State<'_, AppState>,
    server_id: String,
    role_id: String,
) -> Result<(), AppError> {
    state
        .http
        .delete_no_content(&app, &format!("/servers/{}/roles/{}", server_id, role_id))
        .await
}

/// PUT /servers/:serverId/roles/:roleId/permissions
#[tauri::command]
pub async fn roles_update_permissions(
    app: AppHandle,
    state: State<'_, AppState>,
    server_id: String,
    role_id: String,
    body: Value,
) -> Result<Value, AppError> {
    state
        .http
        .put(
            &app,
            &format!("/servers/{}/roles/{}/permissions", server_id, role_id),
            &body,
        )
        .await
}

/// POST /servers/:serverId/roles/:roleId/members/:userId
#[tauri::command]
pub async fn roles_assign_to_member(
    app: AppHandle,
    state: State<'_, AppState>,
    server_id: String,
    role_id: String,
    user_id: String,
) -> Result<(), AppError> {
    state
        .http
        .post_no_content(
            &app,
            &format!(
                "/servers/{}/roles/{}/members/{}",
                server_id, role_id, user_id
            ),
            &serde_json::json!({}),
        )
        .await
}

/// DELETE /servers/:serverId/roles/:roleId/members/:userId
#[tauri::command]
pub async fn roles_remove_from_member(
    app: AppHandle,
    state: State<'_, AppState>,
    server_id: String,
    role_id: String,
    user_id: String,
) -> Result<(), AppError> {
    state
        .http
        .delete_no_content(
            &app,
            &format!(
                "/servers/{}/roles/{}/members/{}",
                server_id, role_id, user_id
            ),
        )
        .await
}
