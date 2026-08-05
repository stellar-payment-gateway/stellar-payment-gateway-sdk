/// Converts basis points to a percentage value.
/// 1 bps = 0.01%, so 100 bps = 1%.
pub fn bps_to_percentage(bps: u32) -> u32 {
    bps
}

/// Calculates the fee amount from a value and a basis points rate.
pub fn apply_bps_fee(amount: i128, fee_bps: u32) -> i128 {
    (amount * fee_bps as i128) / 10_000
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bps_to_percentage() {
        assert_eq!(bps_to_percentage(100), 100);
        assert_eq!(bps_to_percentage(50), 50);
        assert_eq!(bps_to_percentage(10000), 10000);
    }

    #[test]
    fn test_apply_bps_fee() {
        assert_eq!(apply_bps_fee(10_000, 100), 100);
        assert_eq!(apply_bps_fee(5_000, 50), 25);
        assert_eq!(apply_bps_fee(1_000_000, 30), 3_000);
    }
}
