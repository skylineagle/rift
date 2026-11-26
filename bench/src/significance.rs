const TIE_TOLERANCE: f64 = 1e-9;

pub fn probability_of_losses_this_large(losses: &[f64]) -> f64 {
    let observed: f64 = losses.iter().sum();
    let magnitude: f64 = losses.iter().map(|loss| loss.abs()).sum();
    let threshold = observed - magnitude * TIE_TOLERANCE;
    let assignments = 1u64 << losses.len();
    let as_large = (0..assignments)
        .filter(|&signs| signed_sum(losses, signs) >= threshold)
        .count();
    as_large as f64 / assignments as f64
}

fn signed_sum(losses: &[f64], signs: u64) -> f64 {
    losses
        .iter()
        .enumerate()
        .map(|(position, loss)| {
            if signs & (1 << position) == 0 {
                loss.abs()
            } else {
                -loss.abs()
            }
        })
        .sum()
}

pub fn holm_adjusted(probabilities: &[f64]) -> Vec<f64> {
    let count = probabilities.len();
    let mut order: Vec<usize> = (0..count).collect();
    order.sort_by(|left, right| probabilities[*left].total_cmp(&probabilities[*right]));
    let mut adjusted = vec![1.0; count];
    let mut running_maximum: f64 = 0.0;
    for (position, &index) in order.iter().enumerate() {
        let scaled = (probabilities[index] * (count - position) as f64).min(1.0);
        running_maximum = running_maximum.max(scaled);
        adjusted[index] = running_maximum;
    }
    adjusted
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn losing_every_pair_has_the_smallest_probability() {
        let five = probability_of_losses_this_large(&[0.1, 0.2, 0.3, 0.4, 0.5]);
        assert_eq!(five, 1.0 / 32.0);
        assert_eq!(probability_of_losses_this_large(&[0.1; 8]), 1.0 / 256.0);
    }

    #[test]
    fn minimum_probability_clears_both_gate_stages() {
        assert!(probability_of_losses_this_large(&[1.0; 5]) < 0.05);
        let confirmation = probability_of_losses_this_large(&[1.0; 10]);
        assert!(holm_adjusted(&[confirmation; 8])[0] < 0.05);
    }

    #[test]
    fn gains_and_identical_pairs_are_not_significant() {
        assert_eq!(probability_of_losses_this_large(&[-1.0, -2.0]), 1.0);
        assert_eq!(probability_of_losses_this_large(&[0.0; 5]), 1.0);
    }

    #[test]
    fn one_small_gain_counts_exactly() {
        let probability = probability_of_losses_this_large(&[-1.0, 2.0, 3.0, 4.0, 5.0]);
        assert_eq!(probability, 2.0 / 32.0);
    }

    #[test]
    fn holm_scales_by_remaining_tests_and_stays_monotone() {
        let adjusted = holm_adjusted(&[0.04, 0.01, 0.03]);
        assert!((adjusted[1] - 0.03).abs() < 1e-12);
        assert!((adjusted[2] - 0.06).abs() < 1e-12);
        assert!((adjusted[0] - 0.06).abs() < 1e-12);
    }
}
