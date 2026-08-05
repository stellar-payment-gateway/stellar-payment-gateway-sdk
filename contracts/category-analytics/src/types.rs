use soroban_sdk::{contracttype, Address, Map, Symbol, Vec};

/// Spending metrics for a category
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CategorySpending {
    pub count: u32,
    pub volume: i128,
}

/// Spending entry used for multi-category batch aggregation
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CategorySpend {
    pub category: Symbol,
    pub amount: i128,
}

/// Historical analytics record for a user, category, and month
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MonthlyAnalytics {
    pub user: Address,
    pub category: Symbol,
    pub year: u32,
    pub month: u32,
    pub volume: i128,
    pub count: u32,
    pub last_updated: u64,
}

/// Time filter for analytics queries.
/// Allows filtering by start and end ledger timestamps.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TimeFilter {
    pub start_timestamp: u64,
    pub end_timestamp: u64,
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct TransactionEvent {
    pub tx_id: u64,
    pub from: Address,
    pub to: Address,
    pub amount: i128,
    pub timestamp: u64,
    pub category: Symbol,
    pub currency: Symbol,
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct CategorySpendWindow {
    pub category: Symbol,
    pub total_volume: i128,
    pub tx_count: u32,
    pub currency: Symbol,
}

pub fn aggregate_by_category_window(
    events: &Vec<TransactionEvent>,
    window_start: u64,
    window_end: u64,
) -> Vec<CategorySpendWindow> {
    let mut category_map: Map<Symbol, (i128, u32, Symbol)> = Map::new(events.env());
    for event in events.iter() {
        if event.timestamp >= window_start && event.timestamp <= window_end {
            let entry = category_map.get(event.category.clone());
            let (vol, count, currency) = match entry {
                Some((v, c, cur)) => (v, c, cur),
                None => (0i128, 0u32, event.currency.clone()),
            };
            category_map.set(
                event.category.clone(),
                (
                    vol.checked_add(event.amount).unwrap_or(vol),
                    count.checked_add(1).unwrap_or(count),
                    currency,
                ),
            );
        }
    }
    let mut results: Vec<CategorySpendWindow> = Vec::new(events.env());
    for (category, (total_volume, tx_count, currency)) in category_map.iter() {
        results.push_back(CategorySpendWindow {
            category,
            total_volume,
            tx_count,
            currency,
        });
    }
    results
}

pub fn recategorize_event(
    events_map: &mut Map<u64, TransactionEvent>,
    tx_id: u64,
    new_category: Symbol,
) -> bool {
    if let Some(mut event) = events_map.get(tx_id) {
        event.category = new_category;
        events_map.set(tx_id, event);
        true
    } else {
        false
    }
}

/// Storage keys for the contract
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    // (year, month, user, category) -> MonthlyAnalytics
    MonthlyAnalytics(u32, u32, Address, Symbol),
    // (user, category) -> CategorySpending (current aggregations)
    CurrentSpending(Address, Symbol),
    // Total users tracked
    TotalTrackedUsers,
}
