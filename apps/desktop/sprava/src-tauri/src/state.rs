use crate::http_client::HttpClient;

pub struct AppState {
    pub http: HttpClient,
}

impl AppState {
    pub fn new() -> Self {
        let api_url = if cfg!(debug_assertions) {
            "http://localhost:3000".to_string()
        } else {
            "https://api.sprava.top".to_string()
        };
        Self {
            http: HttpClient::new(api_url),
        }
    }
}
