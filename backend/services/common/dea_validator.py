"""
DEA number validation for controlled substance prescribing.
Format: 2 letters + 7 digits (e.g. AB1234563).
Second letter = first letter of doctor's last name.
Checksum: (d1+d3+d5) + 2*(d2+d4+d6); last digit of sum must equal digit 7.
"""
import re
from typing import Tuple


def dea_checksum(dea: str) -> bool:
    """Validate DEA checksum. Digits are positions 2-8 (0-indexed)."""
    if not dea or len(dea) != 9:
        return False
    digits = dea[2:9]
    if not digits.isdigit():
        return False
    d = [int(x) for x in digits]
    total = (d[0] + d[2] + d[4]) + 2 * (d[1] + d[3] + d[5])
    return (total % 10) == d[6]


def dea_format_valid(dea: str) -> bool:
    """Check 2 letters + 7 digits. First letter A/B/M, second any letter."""
    if not dea or len(dea) != 9:
        return False
    return bool(re.match(r"^[ABM][A-Z]\d{7}$", dea.upper()))


def dea_letter_matches_last_name(dea: str, last_name: str) -> bool:
    """Second letter of DEA must be first letter of doctor's last name."""
    if not dea or len(dea) < 2 or not last_name:
        return True
    return dea[1].upper() == last_name.strip()[0].upper()


def validate_dea(dea: str, last_name: str = "") -> Tuple[bool, str]:
    """
    Returns (is_valid, error_message).
    Empty DEA is valid (non-controlled); invalid format/checksum/letter returns (False, reason).
    """
    if not dea or not str(dea).strip():
        return True, ""
    dea = str(dea).strip().upper()
    if not dea_format_valid(dea):
        return False, "Invalid DEA format (expected 2 letters + 7 digits, first letter A/B/M)"
    if not dea_checksum(dea):
        return False, "DEA checksum validation failed"
    if last_name and not dea_letter_matches_last_name(dea, last_name):
        return False, f"DEA second letter must match first letter of last name ({last_name})"
    return True, ""
