use crate::http_client::HttpClient;

pub struct AppState {
    pub http: HttpClient,
}

impl AppState {
    pub fn new() -> Self {
        let api_url = option_env!("SPRAVA_API_URL")
            .unwrap_or("http://localhost:3000")
            .to_string();
        Self {
            http: HttpClient::new(api_url),
        }
    }
}
