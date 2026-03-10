use reqwest::Client;
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

use crate::error::AppError;
use crate::token_store::TokenStore;

pub struct HttpClient {
    pub client: Client,
    pub base_url: String,
    refresh_lock: Mutex<()>,
}

#[derive(serde::Deserialize)]
struct ApiErrorBody {
    message: String,
    #[serde(default)]
    code: String,
}

#[derive(serde::Deserialize)]
struct RefreshResponse {
    #[serde(rename = "accessToken")]
    access_token: String,
    #[serde(rename = "refreshToken")]
    refresh_token: String,
}

#[allow(dead_code)]
impl HttpClient {
    pub fn new(base_url: String) -> Self {
        Self {
            client: Client::new(),
            base_url,
            refresh_lock: Mutex::new(()),
        }
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    // --- Authenticated requests ---

    pub async fn get(&self, app: &AppHandle, path: &str) -> Result<Value, AppError> {
        self.request_authed(app, reqwest::Method::GET, path, None)
            .await
    }

    pub async fn get_with_query(
        &self,
        app: &AppHandle,
        path: &str,
        query: &[(String, String)],
    ) -> Result<Value, AppError> {
        let token = self.get_token(app)?;
        let resp = self
            .client
            .get(self.url(path))
            .bearer_auth(&token)
            .query(query)
            .send()
            .await?;
        self.handle_response_authed(app, resp, reqwest::Method::GET, path, None, Some(query))
            .await
    }

    pub async fn post(
        &self,
        app: &AppHandle,
        path: &str,
        body: &Value,
    ) -> Result<Value, AppError> {
        self.request_authed(app, reqwest::Method::POST, path, Some(body))
            .await
    }

    pub async fn post_no_content(
        &self,
        app: &AppHandle,
        path: &str,
        body: &Value,
    ) -> Result<(), AppError> {
        self.request_authed_no_content(app, reqwest::Method::POST, path, Some(body))
            .await
    }

    pub async fn put(
        &self,
        app: &AppHandle,
        path: &str,
        body: &Value,
    ) -> Result<Value, AppError> {
        self.request_authed(app, reqwest::Method::PUT, path, Some(body))
            .await
    }

    pub async fn patch(
        &self,
        app: &AppHandle,
        path: &str,
        body: &Value,
    ) -> Result<Value, AppError> {
        self.request_authed(app, reqwest::Method::PATCH, path, Some(body))
            .await
    }

    pub async fn delete(
        &self,
        app: &AppHandle,
        path: &str,
    ) -> Result<Value, AppError> {
        self.request_authed(app, reqwest::Method::DELETE, path, None)
            .await
    }

    pub async fn delete_with_body(
        &self,
        app: &AppHandle,
        path: &str,
        body: &Value,
    ) -> Result<Value, AppError> {
        self.request_authed(app, reqwest::Method::DELETE, path, Some(body))
            .await
    }

    pub async fn delete_no_content(
        &self,
        app: &AppHandle,
        path: &str,
    ) -> Result<(), AppError> {
        self.request_authed_no_content(app, reqwest::Method::DELETE, path, None)
            .await
    }

    pub async fn delete_no_content_with_body(
        &self,
        app: &AppHandle,
        path: &str,
        body: &Value,
    ) -> Result<(), AppError> {
        self.request_authed_no_content(app, reqwest::Method::DELETE, path, Some(body))
            .await
    }

    pub async fn patch_no_content(
        &self,
        app: &AppHandle,
        path: &str,
        body: &Value,
    ) -> Result<(), AppError> {
        self.request_authed_no_content(app, reqwest::Method::PATCH, path, Some(body))
            .await
    }

    // --- Unauthenticated requests ---

    pub async fn post_unauthed(
        &self,
        path: &str,
        body: &Value,
    ) -> Result<Value, AppError> {
        let resp = self
            .client
            .post(self.url(path))
            .json(body)
            .send()
            .await?;
        Self::handle_response_unauthed(resp).await
    }

    pub async fn get_unauthed(&self, path: &str) -> Result<Value, AppError> {
        let resp = self.client.get(self.url(path)).send().await?;
        Self::handle_response_unauthed(resp).await
    }

    pub async fn post_unauthed_no_content(
        &self,
        path: &str,
        body: &Value,
    ) -> Result<(), AppError> {
        let resp = self
            .client
            .post(self.url(path))
            .json(body)
            .send()
            .await?;
        let status = resp.status();
        if status.is_success() {
            Ok(())
        } else {
            Err(Self::parse_api_error(resp).await)
        }
    }

    // --- Multipart upload (authenticated) ---

    pub async fn post_multipart(
        &self,
        app: &AppHandle,
        path: &str,
        form: reqwest::multipart::Form,
    ) -> Result<Value, AppError> {
        let token = self.get_token(app)?;
        let resp = self
            .client
            .post(self.url(path))
            .bearer_auth(&token)
            .multipart(form)
            .send()
            .await?;
        // No auto-refresh for multipart (can't replay the body)
        let status = resp.status();
        if status.is_success() {
            let body = resp.json::<Value>().await?;
            Ok(body)
        } else {
            Err(Self::parse_api_error(resp).await)
        }
    }

    // --- Internal helpers ---

    fn get_token(&self, app: &AppHandle) -> Result<String, AppError> {
        TokenStore::get_access_token(app)?.ok_or(AppError::NotAuthenticated)
    }

    async fn request_authed(
        &self,
        app: &AppHandle,
        method: reqwest::Method,
        path: &str,
        body: Option<&Value>,
    ) -> Result<Value, AppError> {
        let token = self.get_token(app)?;
        let mut req = self.client.request(method.clone(), self.url(path)).bearer_auth(&token);
        if let Some(b) = body {
            req = req.json(b);
        }
        let resp = req.send().await?;
        self.handle_response_authed(app, resp, method, path, body, None)
            .await
    }

    async fn request_authed_no_content(
        &self,
        app: &AppHandle,
        method: reqwest::Method,
        path: &str,
        body: Option<&Value>,
    ) -> Result<(), AppError> {
        let token = self.get_token(app)?;
        let mut req = self.client.request(method.clone(), self.url(path)).bearer_auth(&token);
        if let Some(b) = body {
            req = req.json(b);
        }
        let resp = req.send().await?;
        let status = resp.status();

        if status == reqwest::StatusCode::UNAUTHORIZED {
            if self.try_refresh(app).await? {
                // Retry
                let new_token = self.get_token(app)?;
                let mut req = self
                    .client
                    .request(method, self.url(path))
                    .bearer_auth(&new_token);
                if let Some(b) = body {
                    req = req.json(b);
                }
                let resp = req.send().await?;
                let status = resp.status();
                if status.is_success() {
                    return Ok(());
                }
                return Err(Self::parse_api_error(resp).await);
            }
            return Err(AppError::NotAuthenticated);
        }

        if status.is_success() {
            Ok(())
        } else {
            Err(Self::parse_api_error(resp).await)
        }
    }

    async fn handle_response_authed(
        &self,
        app: &AppHandle,
        resp: reqwest::Response,
        method: reqwest::Method,
        path: &str,
        body: Option<&Value>,
        query: Option<&[(String, String)]>,
    ) -> Result<Value, AppError> {
        let status = resp.status();

        if status == reqwest::StatusCode::UNAUTHORIZED {
            if self.try_refresh(app).await? {
                // Retry the original request
                let new_token = self.get_token(app)?;
                let mut req = self
                    .client
                    .request(method, self.url(path))
                    .bearer_auth(&new_token);
                if let Some(b) = body {
                    req = req.json(b);
                }
                if let Some(q) = query {
                    req = req.query(q);
                }
                let resp = req.send().await?;
                let status = resp.status();
                if status.is_success() {
                    return resp.json::<Value>().await.map_err(AppError::from);
                }
                return Err(Self::parse_api_error(resp).await);
            }
            return Err(AppError::NotAuthenticated);
        }

        if status.is_success() {
            resp.json::<Value>().await.map_err(AppError::from)
        } else {
            Err(Self::parse_api_error(resp).await)
        }
    }

    async fn try_refresh(&self, app: &AppHandle) -> Result<bool, AppError> {
        let _lock = self.refresh_lock.lock().await;

        let refresh_token = match TokenStore::get_refresh_token(app)? {
            Some(t) => t,
            None => {
                let _ = app.emit("auth:session-expired", ());
                return Ok(false);
            }
        };

        let resp = self
            .client
            .post(self.url("/auth/refresh"))
            .json(&serde_json::json!({ "refreshToken": refresh_token }))
            .send()
            .await?;

        if resp.status().is_success() {
            let data = resp.json::<RefreshResponse>().await?;
            TokenStore::set_tokens(app, &data.access_token, &data.refresh_token)?;
            let _ = app.emit("auth:tokens-refreshed", ());
            Ok(true)
        } else {
            TokenStore::clear(app)?;
            let _ = app.emit("auth:session-expired", ());
            Ok(false)
        }
    }

    async fn handle_response_unauthed(resp: reqwest::Response) -> Result<Value, AppError> {
        let status = resp.status();
        if status.is_success() {
            resp.json::<Value>().await.map_err(AppError::from)
        } else {
            Err(Self::parse_api_error(resp).await)
        }
    }

    async fn parse_api_error(resp: reqwest::Response) -> AppError {
        let status = resp.status().as_u16();
        match resp.json::<ApiErrorBody>().await {
            Ok(body) => AppError::Api {
                status,
                code: if body.code.is_empty() {
                    "UNKNOWN".to_string()
                } else {
                    body.code
                },
                message: body.message,
            },
            Err(_) => AppError::Api {
                status,
                code: "UNKNOWN".to_string(),
                message: format!("Request failed with status {}", status),
            },
        }
    }
}
