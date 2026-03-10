use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("API error: {message}")]
    Api {
        status: u16,
        code: String,
        message: String,
    },

    #[error("Network error: {0}")]
    Network(String),

    #[error("Serialization error: {0}")]
    Serde(String),

    #[error("Store error: {0}")]
    Store(String),

    #[error("Not authenticated")]
    NotAuthenticated,
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeMap;

        let mut map = serializer.serialize_map(None)?;
        match self {
            AppError::Api {
                status,
                code,
                message,
            } => {
                map.serialize_entry("type", "api")?;
                map.serialize_entry("status", status)?;
                map.serialize_entry("code", code)?;
                map.serialize_entry("message", message)?;
            }
            AppError::Network(msg) => {
                map.serialize_entry("type", "network")?;
                map.serialize_entry("message", msg)?;
            }
            AppError::Serde(msg) => {
                map.serialize_entry("type", "serde")?;
                map.serialize_entry("message", msg)?;
            }
            AppError::Store(msg) => {
                map.serialize_entry("type", "store")?;
                map.serialize_entry("message", msg)?;
            }
            AppError::NotAuthenticated => {
                map.serialize_entry("type", "not_authenticated")?;
                map.serialize_entry("message", "Not authenticated")?;
            }
        }
        map.end()
    }
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        AppError::Network(e.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Serde(e.to_string())
    }
}
