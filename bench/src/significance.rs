pub fn probability_of_ranking_this_low(lower: &[f64], higher: &[f64]) -> f64 {
    let pooled: Vec<f64> = lower.iter().chain(higher).copied().collect();
    let ranks = doubled_midranks(&pooled);
    let observed: usize = ranks[..lower.len()].iter().sum();
    let counts = subset_sum_counts(&ranks, lower.len());
    let as_low: f64 = counts[..=observed].iter().sum();
    as_low / counts.iter().sum::<f64>()
}

fn doubled_midranks(values: &[f64]) -> Vec<usize> {
    values
        .iter()
        .map(|value| {
            let below = values.iter().filter(|other| *other < value).count();
            let tied = values.iter().filter(|other| *other == value).count();
            2 * below + tied + 1
        })
        .collect()
}

fn subset_sum_counts(ranks: &[usize], size: usize) -> Vec<f64> {
    let total: usize = ranks.iter().sum();
    let mut counts = vec![vec![0.0; total + 1]; size + 1];
    counts[0][0] = 1.0;
    for &rank in ranks {
        for chosen in (1..=size).rev() {
            for sum in (rank..=total).rev() {
                counts[chosen][sum] += counts[chosen - 1][sum - rank];
            }
        }
    }
    counts.swap_remove(size)
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
    fn completely_separated_samples_have_the_smallest_probability() {
        let probability = probability_of_ranking_this_low(
            &[1.0, 2.0, 3.0, 4.0, 5.0],
            &[6.0, 7.0, 8.0, 9.0, 10.0],
        );
        assert!((probability - 1.0 / 252.0).abs() < 1e-12);
    }

    #[test]
    fn reversed_and_identical_samples_are_not_significant() {
        assert_eq!(
            probability_of_ranking_this_low(&[3.0, 4.0], &[1.0, 2.0]),
            1.0
        );
        assert_eq!(probability_of_ranking_this_low(&[1.0; 5], &[1.0; 5]), 1.0);
    }

    #[test]
    fn holm_scales_by_remaining_tests_and_stays_monotone() {
        let adjusted = holm_adjusted(&[0.04, 0.01, 0.03]);
        assert!((adjusted[1] - 0.03).abs() < 1e-12);
        assert!((adjusted[2] - 0.06).abs() < 1e-12);
        assert!((adjusted[0] - 0.06).abs() < 1e-12);
    }
}
