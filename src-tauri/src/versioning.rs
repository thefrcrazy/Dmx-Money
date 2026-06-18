use std::cmp::Ordering;

fn parse_version(value: &str) -> Option<Vec<u64>> {
    let normalized = value
        .trim()
        .trim_start_matches(['v', 'V'])
        .split(['-', '+'])
        .next()?;

    if normalized.is_empty() {
        return None;
    }

    normalized
        .split('.')
        .map(str::parse::<u64>)
        .collect::<Result<Vec<_>, _>>()
        .ok()
}

fn compare_versions(left: &str, right: &str) -> Ordering {
    match (parse_version(left), parse_version(right)) {
        (Some(left), Some(right)) => {
            let length = left.len().max(right.len());
            for index in 0..length {
                match left
                    .get(index)
                    .copied()
                    .unwrap_or_default()
                    .cmp(&right.get(index).copied().unwrap_or_default())
                {
                    Ordering::Equal => continue,
                    ordering => return ordering,
                }
            }
            Ordering::Equal
        }
        (Some(_), None) => Ordering::Greater,
        (None, Some(_)) => Ordering::Less,
        (None, None) => Ordering::Equal,
    }
}

pub(crate) fn newest_seen_version(
    current: Option<String>,
    incoming: Option<String>,
) -> Option<String> {
    match (current, incoming) {
        (Some(current), Some(incoming)) => {
            if compare_versions(&incoming, &current).is_gt() {
                Some(incoming)
            } else {
                Some(current)
            }
        }
        (current @ Some(_), None) => current,
        (None, incoming) => incoming,
    }
}

#[cfg(test)]
mod tests {
    use super::newest_seen_version;

    #[test]
    fn keeps_the_newest_seen_version() {
        assert_eq!(
            newest_seen_version(Some("1.0.13".into()), Some("1.0.12".into())),
            Some("1.0.13".into())
        );
        assert_eq!(
            newest_seen_version(Some("1.9.9".into()), Some("1.10.0".into())),
            Some("1.10.0".into())
        );
    }

    #[test]
    fn does_not_replace_a_valid_version_with_an_invalid_value() {
        assert_eq!(
            newest_seen_version(Some("1.0.13".into()), Some("unknown".into())),
            Some("1.0.13".into())
        );
    }
}
