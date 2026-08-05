use soroban_sdk::{contracttype, Env, Map, String, Vec};

/// Comprehensive error standardization for Stellar Payment Gateway SDK contracts
///
/// This module provides a unified error handling system across all contracts
/// with standardized error codes, documentation mapping, and helper functions.

#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[contracttype]
pub enum StellarPaymentGatewaySdkError {
    // === Initialization Errors (1000-1099) ===
    NotInitialized = 1000,
    AlreadyInitialized = 1001,
    InvalidInitialization = 1002,

    // === Authorization Errors (1100-1199) ===
    Unauthorized = 1100,
    InvalidSignature = 1101,
    InsufficientPermissions = 1102,
    AdminRequired = 1103,
    MinterRequired = 1104,

    // === Validation Errors (1200-1299) ===
    InvalidInput = 1200,
    InvalidAmount = 1201,
    InvalidAddress = 1202,
    InvalidTimestamp = 1203,
    InvalidParameter = 1204,
    InvalidConfiguration = 1205,
    InvalidTransaction = 1206,
    InvalidSignatureFormat = 1207,

    // === State Errors (1300-1399) ===
    NotFound = 1300,
    AlreadyExists = 1301,
    InvalidState = 1302,
    NotActive = 1303,
    Expired = 1304,
    Locked = 1305,
    Paused = 1306,

    // === Balance/Amount Errors (1400-1499) ===
    InsufficientBalance = 1400,
    InsufficientAllowance = 1401,
    InsufficientLiquidity = 1402,
    AmountExceedsLimit = 1403,
    NegativeAmount = 1404,
    ZeroAmount = 1405,
    AmountTooLarge = 1406,
    AmountTooSmall = 1407,

    // === Limit/Cap Errors (1500-1599) ===
    LimitExceeded = 1500,
    CapExceeded = 1501,
    QuotaExceeded = 1502,
    RateLimitExceeded = 1503,
    MaxUsersExceeded = 1504,
    MaxTransactionsExceeded = 1505,

    // === Arithmetic Errors (1600-1699) ===
    Overflow = 1600,
    Underflow = 1601,
    DivisionByZero = 1602,
    InvalidCalculation = 1603,

    // === Storage Errors (1700-1799) ===
    StorageError = 1700,
    CorruptedData = 1701,
    DataNotFound = 1702,
    WriteFailed = 1703,
    ReadFailed = 1704,

    // === Network/External Errors (1800-1899) ===
    NetworkError = 1800,
    ExternalCallFailed = 1801,
    OracleUnavailable = 1802,
    BridgeError = 1803,

    // === Business Logic Errors (1900-1999) ===
    TransactionFailed = 1900,
    ConditionNotMet = 1901,
    DeadlineExceeded = 1902,
    IncompatibleOperation = 1903,
    InvalidOperation = 1904,

    // === Security Errors (2000-2099) ===
    SecurityViolation = 2000,
    SuspiciousActivity = 2001,
    BlacklistedAddress = 2002,
    FrozenAccount = 2003,
    ComplianceViolation = 2004,

    // === System Errors (2100-2199) ===
    SystemError = 2100,
    InternalError = 2101,
    NotImplemented = 2102,
    MaintenanceMode = 2103,
    UpgradeRequired = 2104,
}

impl StellarPaymentGatewaySdkError {
    /// Get the error code as u32
    pub fn code(&self) -> u32 {
        *self as u32
    }

    /// Get the error category
    pub fn category(&self) -> ErrorCategory {
        match self {
            // Initialization
            StellarPaymentGatewaySdkError::NotInitialized
            | StellarPaymentGatewaySdkError::AlreadyInitialized
            | StellarPaymentGatewaySdkError::InvalidInitialization => ErrorCategory::Initialization,

            // Authorization
            StellarPaymentGatewaySdkError::Unauthorized
            | StellarPaymentGatewaySdkError::InvalidSignature
            | StellarPaymentGatewaySdkError::InsufficientPermissions
            | StellarPaymentGatewaySdkError::AdminRequired
            | StellarPaymentGatewaySdkError::MinterRequired => ErrorCategory::Authorization,

            // Validation
            StellarPaymentGatewaySdkError::InvalidInput
            | StellarPaymentGatewaySdkError::InvalidAmount
            | StellarPaymentGatewaySdkError::InvalidAddress
            | StellarPaymentGatewaySdkError::InvalidTimestamp
            | StellarPaymentGatewaySdkError::InvalidParameter
            | StellarPaymentGatewaySdkError::InvalidConfiguration
            | StellarPaymentGatewaySdkError::InvalidTransaction
            | StellarPaymentGatewaySdkError::InvalidSignatureFormat => ErrorCategory::Validation,

            // State
            StellarPaymentGatewaySdkError::NotFound
            | StellarPaymentGatewaySdkError::AlreadyExists
            | StellarPaymentGatewaySdkError::InvalidState
            | StellarPaymentGatewaySdkError::NotActive
            | StellarPaymentGatewaySdkError::Expired
            | StellarPaymentGatewaySdkError::Locked
            | StellarPaymentGatewaySdkError::Paused => ErrorCategory::State,

            // Balance/Amount
            StellarPaymentGatewaySdkError::InsufficientBalance
            | StellarPaymentGatewaySdkError::InsufficientAllowance
            | StellarPaymentGatewaySdkError::InsufficientLiquidity
            | StellarPaymentGatewaySdkError::AmountExceedsLimit
            | StellarPaymentGatewaySdkError::NegativeAmount
            | StellarPaymentGatewaySdkError::ZeroAmount
            | StellarPaymentGatewaySdkError::AmountTooLarge
            | StellarPaymentGatewaySdkError::AmountTooSmall => ErrorCategory::Balance,

            // Limit/Cap
            StellarPaymentGatewaySdkError::LimitExceeded
            | StellarPaymentGatewaySdkError::CapExceeded
            | StellarPaymentGatewaySdkError::QuotaExceeded
            | StellarPaymentGatewaySdkError::RateLimitExceeded
            | StellarPaymentGatewaySdkError::MaxUsersExceeded
            | StellarPaymentGatewaySdkError::MaxTransactionsExceeded => ErrorCategory::Limit,

            // Arithmetic
            StellarPaymentGatewaySdkError::Overflow
            | StellarPaymentGatewaySdkError::Underflow
            | StellarPaymentGatewaySdkError::DivisionByZero
            | StellarPaymentGatewaySdkError::InvalidCalculation => ErrorCategory::Arithmetic,

            // Storage
            StellarPaymentGatewaySdkError::StorageError
            | StellarPaymentGatewaySdkError::CorruptedData
            | StellarPaymentGatewaySdkError::DataNotFound
            | StellarPaymentGatewaySdkError::WriteFailed
            | StellarPaymentGatewaySdkError::ReadFailed => ErrorCategory::Storage,

            // Network/External
            StellarPaymentGatewaySdkError::NetworkError
            | StellarPaymentGatewaySdkError::ExternalCallFailed
            | StellarPaymentGatewaySdkError::OracleUnavailable
            | StellarPaymentGatewaySdkError::BridgeError => ErrorCategory::External,

            // Business Logic
            StellarPaymentGatewaySdkError::TransactionFailed
            | StellarPaymentGatewaySdkError::ConditionNotMet
            | StellarPaymentGatewaySdkError::DeadlineExceeded
            | StellarPaymentGatewaySdkError::IncompatibleOperation
            | StellarPaymentGatewaySdkError::InvalidOperation => ErrorCategory::BusinessLogic,

            // Security
            StellarPaymentGatewaySdkError::SecurityViolation
            | StellarPaymentGatewaySdkError::SuspiciousActivity
            | StellarPaymentGatewaySdkError::BlacklistedAddress
            | StellarPaymentGatewaySdkError::FrozenAccount
            | StellarPaymentGatewaySdkError::ComplianceViolation => ErrorCategory::Security,

            // System
            StellarPaymentGatewaySdkError::SystemError
            | StellarPaymentGatewaySdkError::InternalError
            | StellarPaymentGatewaySdkError::NotImplemented
            | StellarPaymentGatewaySdkError::MaintenanceMode
            | StellarPaymentGatewaySdkError::UpgradeRequired => ErrorCategory::System,
        }
    }

    /// Get the severity level of this error
    pub fn severity(&self) -> ErrorSeverity {
        match self {
            // Critical errors that require immediate attention
            StellarPaymentGatewaySdkError::SecurityViolation
            | StellarPaymentGatewaySdkError::SystemError
            | StellarPaymentGatewaySdkError::InternalError
            | StellarPaymentGatewaySdkError::CorruptedData => ErrorSeverity::Critical,

            // High severity errors
            StellarPaymentGatewaySdkError::Unauthorized
            | StellarPaymentGatewaySdkError::InsufficientBalance
            | StellarPaymentGatewaySdkError::Overflow
            | StellarPaymentGatewaySdkError::Underflow
            | StellarPaymentGatewaySdkError::StorageError => ErrorSeverity::High,

            // Medium severity errors
            StellarPaymentGatewaySdkError::InvalidInput
            | StellarPaymentGatewaySdkError::InvalidAmount
            | StellarPaymentGatewaySdkError::LimitExceeded
            | StellarPaymentGatewaySdkError::CapExceeded
            | StellarPaymentGatewaySdkError::RateLimitExceeded => ErrorSeverity::Medium,

            // Low severity errors
            StellarPaymentGatewaySdkError::NotFound
            | StellarPaymentGatewaySdkError::Expired
            | StellarPaymentGatewaySdkError::NotActive
            | StellarPaymentGatewaySdkError::Paused => ErrorSeverity::Low,

            // Informational errors
            _ => ErrorSeverity::Info,
        }
    }

    /// Check if this error is recoverable
    pub fn is_recoverable(&self) -> bool {
        match self {
            // Recoverable errors
            StellarPaymentGatewaySdkError::InsufficientBalance
            | StellarPaymentGatewaySdkError::InsufficientAllowance
            | StellarPaymentGatewaySdkError::RateLimitExceeded
            | StellarPaymentGatewaySdkError::Paused
            | StellarPaymentGatewaySdkError::Expired
            | StellarPaymentGatewaySdkError::NotActive => true,

            // Non-recoverable errors
            StellarPaymentGatewaySdkError::SecurityViolation
            | StellarPaymentGatewaySdkError::SystemError
            | StellarPaymentGatewaySdkError::CorruptedData
            | StellarPaymentGatewaySdkError::Unauthorized => false,

            // Context dependent
            _ => false,
        }
    }

    /// Get suggested retry delay in seconds (if applicable)
    pub fn retry_delay(&self) -> Option<u64> {
        match self {
            StellarPaymentGatewaySdkError::RateLimitExceeded => Some(60),
            StellarPaymentGatewaySdkError::NetworkError => Some(30),
            StellarPaymentGatewaySdkError::OracleUnavailable => Some(120),
            StellarPaymentGatewaySdkError::MaintenanceMode => Some(300),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracttype]
pub enum ErrorCategory {
    Initialization = 1000,
    Authorization = 1100,
    Validation = 1200,
    State = 1300,
    Balance = 1400,
    Limit = 1500,
    Arithmetic = 1600,
    Storage = 1700,
    External = 1800,
    BusinessLogic = 1900,
    Security = 2000,
    System = 2100,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracttype]
pub enum ErrorSeverity {
    Critical = 4,
    High = 3,
    Medium = 2,
    Low = 1,
    Info = 0,
}

#[derive(Clone)]
#[contracttype]
pub struct ErrorDocumentation {
    pub code: u32,
    pub name: String,
    pub category: ErrorCategory,
    pub severity: ErrorSeverity,
    pub description: String,
    pub causes: Vec<String>,
    pub solutions: Vec<String>,
    pub recoverable: bool,
    pub retry_delay: Option<u64>,
}

#[derive(Clone)]
#[contracttype]
pub struct ErrorContext {
    pub error_code: u32,
    pub contract_name: String,
    pub function_name: String,
    pub parameters: Vec<String>,
    pub timestamp: u64,
    pub additional_info: Map<String, String>,
}

/// Error documentation and helper functions
pub struct ErrorDocumentation;

impl ErrorDocumentation {
    /// Get comprehensive documentation for an error code
    pub fn get_documentation(env: &Env, error_code: u32) -> Option<ErrorDocumentation> {
        let error = Self::code_to_error(error_code)?;

        Some(ErrorDocumentation {
            code: error_code,
            name: Self::error_name(&error),
            category: error.category(),
            severity: error.severity(),
            description: Self::error_description(&error),
            causes: Self::error_causes(&error),
            solutions: Self::error_solutions(&error),
            recoverable: error.is_recoverable(),
            retry_delay: error.retry_delay(),
        })
    }

    /// Convert error code to StellarPaymentGatewaySdkError enum
    pub fn code_to_error(code: u32) -> Option<StellarPaymentGatewaySdkError> {
        match code {
            // Initialization
            1000 => Some(StellarPaymentGatewaySdkError::NotInitialized),
            1001 => Some(StellarPaymentGatewaySdkError::AlreadyInitialized),
            1002 => Some(StellarPaymentGatewaySdkError::InvalidInitialization),

            // Authorization
            1100 => Some(StellarPaymentGatewaySdkError::Unauthorized),
            1101 => Some(StellarPaymentGatewaySdkError::InvalidSignature),
            1102 => Some(StellarPaymentGatewaySdkError::InsufficientPermissions),
            1103 => Some(StellarPaymentGatewaySdkError::AdminRequired),
            1104 => Some(StellarPaymentGatewaySdkError::MinterRequired),

            // Validation
            1200 => Some(StellarPaymentGatewaySdkError::InvalidInput),
            1201 => Some(StellarPaymentGatewaySdkError::InvalidAmount),
            1202 => Some(StellarPaymentGatewaySdkError::InvalidAddress),
            1203 => Some(StellarPaymentGatewaySdkError::InvalidTimestamp),
            1204 => Some(StellarPaymentGatewaySdkError::InvalidParameter),
            1205 => Some(StellarPaymentGatewaySdkError::InvalidConfiguration),
            1206 => Some(StellarPaymentGatewaySdkError::InvalidTransaction),
            1207 => Some(StellarPaymentGatewaySdkError::InvalidSignatureFormat),

            // State
            1300 => Some(StellarPaymentGatewaySdkError::NotFound),
            1301 => Some(StellarPaymentGatewaySdkError::AlreadyExists),
            1302 => Some(StellarPaymentGatewaySdkError::InvalidState),
            1303 => Some(StellarPaymentGatewaySdkError::NotActive),
            1304 => Some(StellarPaymentGatewaySdkError::Expired),
            1305 => Some(StellarPaymentGatewaySdkError::Locked),
            1306 => Some(StellarPaymentGatewaySdkError::Paused),

            // Balance/Amount
            1400 => Some(StellarPaymentGatewaySdkError::InsufficientBalance),
            1401 => Some(StellarPaymentGatewaySdkError::InsufficientAllowance),
            1402 => Some(StellarPaymentGatewaySdkError::InsufficientLiquidity),
            1403 => Some(StellarPaymentGatewaySdkError::AmountExceedsLimit),
            1404 => Some(StellarPaymentGatewaySdkError::NegativeAmount),
            1405 => Some(StellarPaymentGatewaySdkError::ZeroAmount),
            1406 => Some(StellarPaymentGatewaySdkError::AmountTooLarge),
            1407 => Some(StellarPaymentGatewaySdkError::AmountTooSmall),

            // Limit/Cap
            1500 => Some(StellarPaymentGatewaySdkError::LimitExceeded),
            1501 => Some(StellarPaymentGatewaySdkError::CapExceeded),
            1502 => Some(StellarPaymentGatewaySdkError::QuotaExceeded),
            1503 => Some(StellarPaymentGatewaySdkError::RateLimitExceeded),
            1504 => Some(StellarPaymentGatewaySdkError::MaxUsersExceeded),
            1505 => Some(StellarPaymentGatewaySdkError::MaxTransactionsExceeded),

            // Arithmetic
            1600 => Some(StellarPaymentGatewaySdkError::Overflow),
            1601 => Some(StellarPaymentGatewaySdkError::Underflow),
            1602 => Some(StellarPaymentGatewaySdkError::DivisionByZero),
            1603 => Some(StellarPaymentGatewaySdkError::InvalidCalculation),

            // Storage
            1700 => Some(StellarPaymentGatewaySdkError::StorageError),
            1701 => Some(StellarPaymentGatewaySdkError::CorruptedData),
            1702 => Some(StellarPaymentGatewaySdkError::DataNotFound),
            1703 => Some(StellarPaymentGatewaySdkError::WriteFailed),
            1704 => Some(StellarPaymentGatewaySdkError::ReadFailed),

            // Network/External
            1800 => Some(StellarPaymentGatewaySdkError::NetworkError),
            1801 => Some(StellarPaymentGatewaySdkError::ExternalCallFailed),
            1802 => Some(StellarPaymentGatewaySdkError::OracleUnavailable),
            1803 => Some(StellarPaymentGatewaySdkError::BridgeError),

            // Business Logic
            1900 => Some(StellarPaymentGatewaySdkError::TransactionFailed),
            1901 => Some(StellarPaymentGatewaySdkError::ConditionNotMet),
            1902 => Some(StellarPaymentGatewaySdkError::DeadlineExceeded),
            1903 => Some(StellarPaymentGatewaySdkError::IncompatibleOperation),
            1904 => Some(StellarPaymentGatewaySdkError::InvalidOperation),

            // Security
            2000 => Some(StellarPaymentGatewaySdkError::SecurityViolation),
            2001 => Some(StellarPaymentGatewaySdkError::SuspiciousActivity),
            2002 => Some(StellarPaymentGatewaySdkError::BlacklistedAddress),
            2003 => Some(StellarPaymentGatewaySdkError::FrozenAccount),
            2004 => Some(StellarPaymentGatewaySdkError::ComplianceViolation),

            // System
            2100 => Some(StellarPaymentGatewaySdkError::SystemError),
            2101 => Some(StellarPaymentGatewaySdkError::InternalError),
            2102 => Some(StellarPaymentGatewaySdkError::NotImplemented),
            2103 => Some(StellarPaymentGatewaySdkError::MaintenanceMode),
            2104 => Some(StellarPaymentGatewaySdkError::UpgradeRequired),

            _ => None,
        }
    }

    /// Get human-readable error name
    fn error_name(error: &StellarPaymentGatewaySdkError) -> String {
        match error {
            StellarPaymentGatewaySdkError::NotInitialized => "NotInitialized".into(),
            StellarPaymentGatewaySdkError::AlreadyInitialized => "AlreadyInitialized".into(),
            StellarPaymentGatewaySdkError::InvalidInitialization => "InvalidInitialization".into(),
            StellarPaymentGatewaySdkError::Unauthorized => "Unauthorized".into(),
            StellarPaymentGatewaySdkError::InvalidSignature => "InvalidSignature".into(),
            StellarPaymentGatewaySdkError::InsufficientPermissions => "InsufficientPermissions".into(),
            StellarPaymentGatewaySdkError::AdminRequired => "AdminRequired".into(),
            StellarPaymentGatewaySdkError::MinterRequired => "MinterRequired".into(),
            StellarPaymentGatewaySdkError::InvalidInput => "InvalidInput".into(),
            StellarPaymentGatewaySdkError::InvalidAmount => "InvalidAmount".into(),
            StellarPaymentGatewaySdkError::InvalidAddress => "InvalidAddress".into(),
            StellarPaymentGatewaySdkError::InvalidTimestamp => "InvalidTimestamp".into(),
            StellarPaymentGatewaySdkError::InvalidParameter => "InvalidParameter".into(),
            StellarPaymentGatewaySdkError::InvalidConfiguration => "InvalidConfiguration".into(),
            StellarPaymentGatewaySdkError::InvalidTransaction => "InvalidTransaction".into(),
            StellarPaymentGatewaySdkError::InvalidSignatureFormat => "InvalidSignatureFormat".into(),
            StellarPaymentGatewaySdkError::NotFound => "NotFound".into(),
            StellarPaymentGatewaySdkError::AlreadyExists => "AlreadyExists".into(),
            StellarPaymentGatewaySdkError::InvalidState => "InvalidState".into(),
            StellarPaymentGatewaySdkError::NotActive => "NotActive".into(),
            StellarPaymentGatewaySdkError::Expired => "Expired".into(),
            StellarPaymentGatewaySdkError::Locked => "Locked".into(),
            StellarPaymentGatewaySdkError::Paused => "Paused".into(),
            StellarPaymentGatewaySdkError::InsufficientBalance => "InsufficientBalance".into(),
            StellarPaymentGatewaySdkError::InsufficientAllowance => "InsufficientAllowance".into(),
            StellarPaymentGatewaySdkError::InsufficientLiquidity => "InsufficientLiquidity".into(),
            StellarPaymentGatewaySdkError::AmountExceedsLimit => "AmountExceedsLimit".into(),
            StellarPaymentGatewaySdkError::NegativeAmount => "NegativeAmount".into(),
            StellarPaymentGatewaySdkError::ZeroAmount => "ZeroAmount".into(),
            StellarPaymentGatewaySdkError::AmountTooLarge => "AmountTooLarge".into(),
            StellarPaymentGatewaySdkError::AmountTooSmall => "AmountTooSmall".into(),
            StellarPaymentGatewaySdkError::LimitExceeded => "LimitExceeded".into(),
            StellarPaymentGatewaySdkError::CapExceeded => "CapExceeded".into(),
            StellarPaymentGatewaySdkError::QuotaExceeded => "QuotaExceeded".into(),
            StellarPaymentGatewaySdkError::RateLimitExceeded => "RateLimitExceeded".into(),
            StellarPaymentGatewaySdkError::MaxUsersExceeded => "MaxUsersExceeded".into(),
            StellarPaymentGatewaySdkError::MaxTransactionsExceeded => "MaxTransactionsExceeded".into(),
            StellarPaymentGatewaySdkError::Overflow => "Overflow".into(),
            StellarPaymentGatewaySdkError::Underflow => "Underflow".into(),
            StellarPaymentGatewaySdkError::DivisionByZero => "DivisionByZero".into(),
            StellarPaymentGatewaySdkError::InvalidCalculation => "InvalidCalculation".into(),
            StellarPaymentGatewaySdkError::StorageError => "StorageError".into(),
            StellarPaymentGatewaySdkError::CorruptedData => "CorruptedData".into(),
            StellarPaymentGatewaySdkError::DataNotFound => "DataNotFound".into(),
            StellarPaymentGatewaySdkError::WriteFailed => "WriteFailed".into(),
            StellarPaymentGatewaySdkError::ReadFailed => "ReadFailed".into(),
            StellarPaymentGatewaySdkError::NetworkError => "NetworkError".into(),
            StellarPaymentGatewaySdkError::ExternalCallFailed => "ExternalCallFailed".into(),
            StellarPaymentGatewaySdkError::OracleUnavailable => "OracleUnavailable".into(),
            StellarPaymentGatewaySdkError::BridgeError => "BridgeError".into(),
            StellarPaymentGatewaySdkError::TransactionFailed => "TransactionFailed".into(),
            StellarPaymentGatewaySdkError::ConditionNotMet => "ConditionNotMet".into(),
            StellarPaymentGatewaySdkError::DeadlineExceeded => "DeadlineExceeded".into(),
            StellarPaymentGatewaySdkError::IncompatibleOperation => "IncompatibleOperation".into(),
            StellarPaymentGatewaySdkError::InvalidOperation => "InvalidOperation".into(),
            StellarPaymentGatewaySdkError::SecurityViolation => "SecurityViolation".into(),
            StellarPaymentGatewaySdkError::SuspiciousActivity => "SuspiciousActivity".into(),
            StellarPaymentGatewaySdkError::BlacklistedAddress => "BlacklistedAddress".into(),
            StellarPaymentGatewaySdkError::FrozenAccount => "FrozenAccount".into(),
            StellarPaymentGatewaySdkError::ComplianceViolation => "ComplianceViolation".into(),
            StellarPaymentGatewaySdkError::SystemError => "SystemError".into(),
            StellarPaymentGatewaySdkError::InternalError => "InternalError".into(),
            StellarPaymentGatewaySdkError::NotImplemented => "NotImplemented".into(),
            StellarPaymentGatewaySdkError::MaintenanceMode => "MaintenanceMode".into(),
            StellarPaymentGatewaySdkError::UpgradeRequired => "UpgradeRequired".into(),
        }
    }

    /// Get detailed error description
    fn error_description(error: &StellarPaymentGatewaySdkError) -> String {
        match error {
            StellarPaymentGatewaySdkError::NotInitialized => "Contract has not been initialized".into(),
            StellarPaymentGatewaySdkError::AlreadyInitialized => "Contract has already been initialized".into(),
            StellarPaymentGatewaySdkError::InvalidInitialization => {
                "Invalid initialization parameters provided".into()
            }
            StellarPaymentGatewaySdkError::Unauthorized => {
                "Caller is not authorized to perform this operation".into()
            }
            StellarPaymentGatewaySdkError::InvalidSignature => "Provided signature is invalid".into(),
            StellarPaymentGatewaySdkError::InsufficientPermissions => {
                "Insufficient permissions for this operation".into()
            }
            StellarPaymentGatewaySdkError::AdminRequired => {
                "Admin privileges required for this operation".into()
            }
            StellarPaymentGatewaySdkError::MinterRequired => {
                "Minter privileges required for this operation".into()
            }
            StellarPaymentGatewaySdkError::InvalidInput => "Invalid input provided".into(),
            StellarPaymentGatewaySdkError::InvalidAmount => "Invalid amount provided".into(),
            StellarPaymentGatewaySdkError::InvalidAddress => "Invalid address provided".into(),
            StellarPaymentGatewaySdkError::InvalidTimestamp => "Invalid timestamp provided".into(),
            StellarPaymentGatewaySdkError::InvalidParameter => "Invalid parameter provided".into(),
            StellarPaymentGatewaySdkError::InvalidConfiguration => "Invalid configuration provided".into(),
            StellarPaymentGatewaySdkError::InvalidTransaction => "Invalid transaction provided".into(),
            StellarPaymentGatewaySdkError::InvalidSignatureFormat => "Invalid signature format".into(),
            StellarPaymentGatewaySdkError::NotFound => "Requested resource not found".into(),
            StellarPaymentGatewaySdkError::AlreadyExists => "Resource already exists".into(),
            StellarPaymentGatewaySdkError::InvalidState => {
                "Contract is in invalid state for this operation".into()
            }
            StellarPaymentGatewaySdkError::NotActive => "Contract or resource is not active".into(),
            StellarPaymentGatewaySdkError::Expired => "Resource has expired".into(),
            StellarPaymentGatewaySdkError::Locked => "Resource is currently locked".into(),
            StellarPaymentGatewaySdkError::Paused => "Contract is currently paused".into(),
            StellarPaymentGatewaySdkError::InsufficientBalance => {
                "Insufficient balance for this operation".into()
            }
            StellarPaymentGatewaySdkError::InsufficientAllowance => {
                "Insufficient allowance for this operation".into()
            }
            StellarPaymentGatewaySdkError::InsufficientLiquidity => "Insufficient liquidity available".into(),
            StellarPaymentGatewaySdkError::AmountExceedsLimit => "Amount exceeds allowed limit".into(),
            StellarPaymentGatewaySdkError::NegativeAmount => "Negative amount provided".into(),
            StellarPaymentGatewaySdkError::ZeroAmount => "Zero amount provided".into(),
            StellarPaymentGatewaySdkError::AmountTooLarge => "Amount is too large".into(),
            StellarPaymentGatewaySdkError::AmountTooSmall => "Amount is too small".into(),
            StellarPaymentGatewaySdkError::LimitExceeded => "Operation limit exceeded".into(),
            StellarPaymentGatewaySdkError::CapExceeded => "Cap limit exceeded".into(),
            StellarPaymentGatewaySdkError::QuotaExceeded => "Quota limit exceeded".into(),
            StellarPaymentGatewaySdkError::RateLimitExceeded => "Rate limit exceeded".into(),
            StellarPaymentGatewaySdkError::MaxUsersExceeded => "Maximum users exceeded".into(),
            StellarPaymentGatewaySdkError::MaxTransactionsExceeded => "Maximum transactions exceeded".into(),
            StellarPaymentGatewaySdkError::Overflow => "Arithmetic overflow detected".into(),
            StellarPaymentGatewaySdkError::Underflow => "Arithmetic underflow detected".into(),
            StellarPaymentGatewaySdkError::DivisionByZero => "Division by zero attempted".into(),
            StellarPaymentGatewaySdkError::InvalidCalculation => "Invalid calculation performed".into(),
            StellarPaymentGatewaySdkError::StorageError => "Storage operation failed".into(),
            StellarPaymentGatewaySdkError::CorruptedData => "Data corruption detected".into(),
            StellarPaymentGatewaySdkError::DataNotFound => "Requested data not found in storage".into(),
            StellarPaymentGatewaySdkError::WriteFailed => "Failed to write to storage".into(),
            StellarPaymentGatewaySdkError::ReadFailed => "Failed to read from storage".into(),
            StellarPaymentGatewaySdkError::NetworkError => "Network operation failed".into(),
            StellarPaymentGatewaySdkError::ExternalCallFailed => "External contract call failed".into(),
            StellarPaymentGatewaySdkError::OracleUnavailable => "Oracle service is unavailable".into(),
            StellarPaymentGatewaySdkError::BridgeError => "Bridge operation failed".into(),
            StellarPaymentGatewaySdkError::TransactionFailed => "Transaction execution failed".into(),
            StellarPaymentGatewaySdkError::ConditionNotMet => "Required condition not met".into(),
            StellarPaymentGatewaySdkError::DeadlineExceeded => "Operation deadline exceeded".into(),
            StellarPaymentGatewaySdkError::IncompatibleOperation => "Incompatible operation attempted".into(),
            StellarPaymentGatewaySdkError::InvalidOperation => "Invalid operation attempted".into(),
            StellarPaymentGatewaySdkError::SecurityViolation => "Security violation detected".into(),
            StellarPaymentGatewaySdkError::SuspiciousActivity => "Suspicious activity detected".into(),
            StellarPaymentGatewaySdkError::BlacklistedAddress => "Address is blacklisted".into(),
            StellarPaymentGatewaySdkError::FrozenAccount => "Account is frozen".into(),
            StellarPaymentGatewaySdkError::ComplianceViolation => "Compliance rule violation".into(),
            StellarPaymentGatewaySdkError::SystemError => "System error occurred".into(),
            StellarPaymentGatewaySdkError::InternalError => "Internal error occurred".into(),
            StellarPaymentGatewaySdkError::NotImplemented => "Feature not implemented".into(),
            StellarPaymentGatewaySdkError::MaintenanceMode => "System is in maintenance mode".into(),
            StellarPaymentGatewaySdkError::UpgradeRequired => "Contract upgrade required".into(),
        }
    }

    /// Get common causes for this error
    fn error_causes(error: &StellarPaymentGatewaySdkError) -> Vec<String> {
        let env = &soroban_sdk::Env::default(); // This would be passed in real usage
        let mut causes = Vec::new(env);

        match error {
            StellarPaymentGatewaySdkError::NotInitialized => {
                causes.push_back("Contract initialization not completed".into());
                causes.push_back("Admin setup not performed".into());
            }
            StellarPaymentGatewaySdkError::Unauthorized => {
                causes.push_back("Caller lacks required permissions".into());
                causes.push_back("Invalid authentication provided".into());
            }
            StellarPaymentGatewaySdkError::InsufficientBalance => {
                causes.push_back("Account balance too low".into());
                causes.push_back("Recent transactions reduced balance".into());
            }
            StellarPaymentGatewaySdkError::RateLimitExceeded => {
                causes.push_back("Too many requests in time window".into());
                causes.push_back("Rate limit quota exceeded".into());
            }
            _ => {
                causes.push_back("Unknown specific cause".into());
            }
        }

        causes
    }

    /// Get suggested solutions for this error
    fn error_solutions(error: &StellarPaymentGatewaySdkError) -> Vec<String> {
        let env = &soroban_sdk::Env::default(); // This would be passed in real usage
        let mut solutions = Vec::new(env);

        match error {
            StellarPaymentGatewaySdkError::NotInitialized => {
                solutions.push_back("Initialize the contract first".into());
                solutions.push_back("Contact contract administrator".into());
            }
            StellarPaymentGatewaySdkError::Unauthorized => {
                solutions.push_back("Check your permissions".into());
                solutions.push_back("Use authorized account".into());
            }
            StellarPaymentGatewaySdkError::InsufficientBalance => {
                solutions.push_back("Add funds to your account".into());
                solutions.push_back("Reduce transaction amount".into());
            }
            StellarPaymentGatewaySdkError::RateLimitExceeded => {
                solutions.push_back("Wait before retrying".into());
                solutions.push_back("Reduce request frequency".into());
            }
            _ => {
                solutions.push_back("Contact support for assistance".into());
                solutions.push_back("Check error documentation".into());
            }
        }

        solutions
    }
}

/// Helper functions for error handling
pub struct ErrorHelpers;

impl ErrorHelpers {
    /// Create error context for logging
    pub fn create_context(
        env: &Env,
        error_code: u32,
        contract_name: &str,
        function_name: &str,
        parameters: Vec<String>,
        additional_info: Map<String, String>,
    ) -> ErrorContext {
        ErrorContext {
            error_code,
            contract_name: contract_name.into(),
            function_name: function_name.into(),
            parameters,
            timestamp: env.ledger().timestamp(),
            additional_info,
        }
    }

    /// Check if error should be logged
    pub fn should_log(error_code: u32) -> bool {
        match error_code {
            // Always log critical and high severity errors
            2000..=2199 => true, // System and Security
            1600..=1699 => true, // Arithmetic
            1700..=1799 => true, // Storage

            // Log medium severity errors selectively
            1100..=1199 => true, // Authorization
            1400..=1499 => true, // Balance/Amount

            // Don't log low severity informational errors
            _ => false,
        }
    }

    /// Get suggested retry strategy
    pub fn retry_strategy(error_code: u32) -> RetryStrategy {
        match error_code {
            // Immediate retry for transient errors
            1800 | 1802 => RetryStrategy::Immediate,

            // Exponential backoff for rate limits
            1503 => RetryStrategy::ExponentialBackoff,

            // Fixed delay for maintenance
            2103 => RetryStrategy::FixedDelay,

            // No retry for permanent errors
            1100 | 2000 | 1400 => RetryStrategy::NoRetry,

            // Default to exponential backoff
            _ => RetryStrategy::ExponentialBackoff,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracttype]
pub enum RetryStrategy {
    NoRetry = 0,
    Immediate = 1,
    FixedDelay = 2,
    ExponentialBackoff = 3,
}
