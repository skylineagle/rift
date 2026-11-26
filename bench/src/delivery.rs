use crate::case::CaseResult;
use crate::flow::{FlowResult, Window, TAIL_DIVISOR};

const MINIMUM_PACED_DELIVERY: f64 = 0.99;
const MINIMUM_PACED_GOODPUT: f64 = 0.95;
const MINIMUM_TAIL_SHARE: f64 = 0.25;

pub fn check(result: &CaseResult) -> Result<f64, String> {
    result
        .flows
        .iter()
        .map(|flow| check_flow(flow, result.rate_mbps))
        .sum()
}

fn check_flow(flow: &FlowResult, rate_mbps: Option<f64>) -> Result<f64, String> {
    let window = flow
        .window
        .ok_or_else(|| format!("{}: no measurement window", flow.name))?;
    check_still_flowing(&window)
        .and_then(|()| match rate_mbps {
            Some(rate) => check_paced(flow, &window, rate),
            None => Ok(()),
        })
        .map_err(|error| format!("{}: delivery failure: {error}", flow.name))?;
    Ok(window.goodput_mbps)
}

fn check_still_flowing(window: &Window) -> Result<(), String> {
    let even_share = window.received_frames as f64 / f64::from(TAIL_DIVISOR);
    if window.tail_frames == 0 || (window.tail_frames as f64) < even_share * MINIMUM_TAIL_SHARE {
        return Err(format!(
            "only {} of {} frames arrived in the final part of the window",
            window.tail_frames, window.received_frames
        ));
    }
    Ok(())
}

fn check_paced(flow: &FlowResult, window: &Window, rate_mbps: f64) -> Result<(), String> {
    let delivery = flow.received_frames as f64 / flow.sent_frames.max(1) as f64;
    if delivery < MINIMUM_PACED_DELIVERY {
        return Err(format!(
            "received {} of {} sent frames",
            flow.received_frames, flow.sent_frames
        ));
    }
    if window.goodput_mbps < rate_mbps * MINIMUM_PACED_GOODPUT {
        return Err(format!(
            "{:.1} MB/s against a target of {rate_mbps:.1} MB/s",
            window.goodput_mbps
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn flow(sent: u64, received: u64, tail: u64, goodput_mbps: f64) -> FlowResult {
        FlowResult {
            sent_frames: sent,
            received_frames: received,
            window: Some(Window {
                goodput_mbps,
                received_frames: received,
                tail_frames: tail,
            }),
            ..FlowResult::default()
        }
    }

    #[test]
    fn a_relay_that_stops_forwarding_fails() {
        assert!(check_flow(&flow(1000, 100, 0, 10.0), None).is_err());
    }

    #[test]
    fn a_lossy_unthrottled_relay_that_keeps_flowing_passes() {
        assert_eq!(check_flow(&flow(1000, 400, 100, 400.0), None), Ok(400.0));
    }

    #[test]
    fn a_paced_flow_needs_delivery_and_target_rate() {
        assert!(check_flow(&flow(1000, 1000, 250, 49.9), Some(50.0)).is_ok());
        assert!(check_flow(&flow(1000, 980, 250, 49.9), Some(50.0)).is_err());
        assert!(check_flow(&flow(1000, 1000, 250, 40.0), Some(50.0)).is_err());
    }
}
