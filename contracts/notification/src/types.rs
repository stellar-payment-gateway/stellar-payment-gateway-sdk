use soroban_sdk::{contracttype, Address, String, Vec};

#[contracttype]
#[derive(Clone)]
pub struct Notification {
    pub recipient: Address,
    pub language: String,
    pub message: String,
}

#[contracttype]
#[derive(Clone)]
pub struct NotificationResult {
    pub recipient: Address,
    pub success: bool,
    /// Per-item failure reason; `0` when the notification was sent. Matches
    /// the error codes in [`crate::NotificationError`].
    pub error_code: u32,
}