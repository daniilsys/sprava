mod audio_session;
mod commands;
mod error;
mod http_client;
mod noise_suppression;
mod state;
mod token_store;

use noise_suppression::NoiseSuppressionState;
use state::AppState;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_localhost::Builder::new(3749).build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .manage(AppState::new())
        .manage(NoiseSuppressionState::new())
        .invoke_handler(tauri::generate_handler![
            // auth
            commands::auth::auth_register,
            commands::auth::auth_login,
            commands::auth::auth_logout,
            commands::auth::auth_verify_email,
            commands::auth::auth_resend_verification,
            commands::auth::auth_change_email,
            commands::auth::auth_change_password,
            commands::auth::auth_forgot_password,
            commands::auth::auth_reset_password,
            // token
            commands::token::get_access_token,
            commands::token::has_session,
            // users
            commands::users::users_get_me,
            commands::users::users_update_account,
            commands::users::users_update_profile,
            commands::users::users_search,
            commands::users::users_get_by_username,
            // servers
            commands::servers::server_create,
            commands::servers::server_get_by_id,
            commands::servers::server_update,
            commands::servers::server_delete,
            commands::servers::server_get_channels,
            commands::servers::server_get_members,
            commands::servers::server_get_bans,
            commands::servers::server_kick_member,
            commands::servers::server_ban_member,
            commands::servers::server_unban_member,
            commands::servers::server_preview,
            commands::servers::server_join,
            commands::servers::server_leave,
            commands::servers::server_regenerate_invite,
            commands::servers::server_transfer_ownership,
            commands::servers::server_get_audit_log,
            // roles
            commands::roles::roles_list,
            commands::roles::roles_get_member_roles,
            commands::roles::roles_create,
            commands::roles::roles_update,
            commands::roles::roles_delete,
            commands::roles::roles_update_permissions,
            commands::roles::roles_assign_to_member,
            commands::roles::roles_remove_from_member,
            // channels
            commands::channels::channel_create,
            commands::channels::channel_get_by_id,
            commands::channels::channel_update,
            commands::channels::channel_reorder,
            commands::channels::channel_delete,
            commands::channels::channel_send_message,
            commands::channels::channel_get_messages,
            commands::channels::channel_search_messages,
            commands::channels::channel_get_rules,
            commands::channels::channel_upsert_rule,
            commands::channels::channel_delete_rule,
            commands::channels::channel_pin_message,
            commands::channels::channel_unpin_message,
            commands::channels::channel_get_pins,
            commands::channels::channel_get_read_state,
            commands::channels::channel_update_read_state,
            // dm
            commands::dm::dm_create,
            commands::dm::dm_get_conversations,
            commands::dm::dm_update,
            commands::dm::dm_leave_group,
            commands::dm::dm_add_participant,
            commands::dm::dm_remove_participant,
            commands::dm::dm_send_message,
            commands::dm::dm_get_messages,
            commands::dm::dm_search_messages,
            commands::dm::dm_pin_message,
            commands::dm::dm_unpin_message,
            commands::dm::dm_get_pins,
            commands::dm::dm_get_read_state,
            commands::dm::dm_update_read_state,
            // messages
            commands::messages::message_edit,
            commands::messages::message_delete,
            commands::messages::message_add_reaction,
            commands::messages::message_remove_reaction,
            commands::messages::message_reply,
            // friendships
            commands::friendships::friendship_send_request,
            commands::friendships::friendship_update,
            commands::friendships::friendship_cancel_request,
            commands::friendships::friendship_reject_request,
            commands::friendships::friendship_remove,
            commands::friendships::friendship_unblock,
            commands::friendships::friendship_get_friends,
            commands::friendships::friendship_get_blocked,
            commands::friendships::friendship_get_requests,
            commands::friendships::friendship_get_sent_requests,
            // uploads
            commands::uploads::upload_presign_avatar,
            commands::uploads::upload_presign_attachment,
            commands::uploads::upload_presign_server_icon,
            commands::uploads::upload_presign_group_icon,
            // settings
            commands::settings::settings_get,
            commands::settings::settings_update,
            // noise suppression
            commands::noise_suppression::noise_suppress_init,
            commands::noise_suppression::noise_suppress_process,
            commands::noise_suppression::noise_suppress_cleanup,
            // audio session
            commands::audio_session::audio_session_configure,
            commands::audio_session::audio_session_reset,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
