"""
PII detection patterns: column name → category map and value regex patterns.
Used by the PII engine for Layer 1 (column) and Layer 2 (value) detection.
"""
import re
from typing import Dict

# Layer 1: Column name (normalized lower) → PII category
COLUMN_TO_PII: Dict[str, str] = {
    "ssn": "SSN",
    "social_security": "SSN",
    "credit_card_number": "CREDIT_CARD",
    "card_number": "CREDIT_CARD",
    "card_last_four": "CREDIT_CARD_PARTIAL",
    "bank_account_number": "BANK_ACCOUNT",
    "email": "EMAIL",
    "billing_email": "EMAIL",
    "phone": "PHONE",
    "emergency_contact_phone": "PHONE",
    "dob": "DATE_OF_BIRTH",
    "patient_dob": "DATE_OF_BIRTH",
    "first_name": "PERSON_NAME",
    "last_name": "PERSON_NAME",
    "cardholder_name": "PERSON_NAME",
    "prescribing_physician": "PERSON_NAME",
    "address": "ADDRESS",
    "home_address": "ADDRESS",
    "billing_address": "ADDRESS",
    "ip_address": "IP_ADDRESS",
    "passport_number": "PASSPORT",
    "drivers_license": "DRIVERS_LICENSE",
    "insurance_id": "INSURANCE_ID",
    "health_plan_id": "HEALTH_PLAN_ID",
    "diagnosis_code": "MEDICAL_CODE",
    "npi_number": "NPI",
    "ethnicity": "DEMOGRAPHIC",
    "annual_income": "FINANCIAL",
    "copay_amount": "FINANCIAL",
    "tax_id": "TAX_ID",
    "zip": "QUASI_IDENTIFIER",
    "state": "QUASI_IDENTIFIER",
    "country": "QUASI_IDENTIFIER",
}

# Layer 2: Value regex by PII type (for cell scanning)
PII_PATTERNS: Dict[str, str] = {
    "SSN": r"\b\d{3}-\d{2}-\d{4}\b",
    "CREDIT_CARD": r"\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14})\b",
    "EMAIL": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
    "PHONE": r"\b(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b",
    "IP_ADDRESS": r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b",
    "DATE_OF_BIRTH": r"\b(19|20)\d{2}[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b",
    "PASSPORT": r"\b[A-Z]\d{8}\b",
    "NPI": r"\b\d{10}\b",
    "ICD10": r"\b[A-Z]\d{2}\.?\d{0,4}\b",
    "IBAN": r"\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b",
}

# Sensitivity level per PII type
SENSITIVITY_BY_TYPE: Dict[str, str] = {
    "SSN": "CRITICAL",
    "CREDIT_CARD": "CRITICAL",
    "CREDIT_CARD_PARTIAL": "HIGH",
    "BANK_ACCOUNT": "CRITICAL",
    "PASSPORT": "CRITICAL",
    "DRIVERS_LICENSE": "CRITICAL",
    "EMAIL": "HIGH",
    "PHONE": "HIGH",
    "DATE_OF_BIRTH": "HIGH",
    "PERSON_NAME": "HIGH",
    "ADDRESS": "HIGH",
    "HEALTH_PLAN_ID": "HIGH",
    "IP_ADDRESS": "MEDIUM",
    "INSURANCE_ID": "MEDIUM",
    "NPI": "MEDIUM",
    "MEDICAL_CODE": "MEDIUM",
    "TAX_ID": "MEDIUM",
    "DEMOGRAPHIC": "MEDIUM",
    "FINANCIAL": "MEDIUM",
    "QUASI_IDENTIFIER": "LOW",
}

# Regulation tags per PII type (list)
REGULATIONS_BY_TYPE: Dict[str, list] = {
    "SSN": ["HIPAA", "GDPR"],
    "CREDIT_CARD": ["PCI-DSS"],
    "CREDIT_CARD_PARTIAL": ["PCI-DSS"],
    "BANK_ACCOUNT": ["PCI-DSS", "SOX"],
    "PASSPORT": ["GDPR"],
    "DRIVERS_LICENSE": ["GDPR", "CCPA"],
    "EMAIL": ["HIPAA", "GDPR", "CCPA"],
    "PHONE": ["HIPAA", "GDPR", "CCPA"],
    "DATE_OF_BIRTH": ["HIPAA", "GDPR", "CCPA"],
    "PERSON_NAME": ["HIPAA", "GDPR", "CCPA"],
    "ADDRESS": ["HIPAA", "GDPR", "CCPA", "PCI-DSS"],
    "HEALTH_PLAN_ID": ["HIPAA"],
    "IP_ADDRESS": ["GDPR", "CCPA"],
    "INSURANCE_ID": ["HIPAA"],
    "NPI": ["HIPAA"],
    "MEDICAL_CODE": ["HIPAA"],
    "TAX_ID": ["SOX"],
    "DEMOGRAPHIC": ["HIPAA", "CCPA"],
    "FINANCIAL": ["CCPA", "SOX"],
    "QUASI_IDENTIFIER": [],
}

# PII type label (human-readable category)
PII_TYPE_LABELS: Dict[str, str] = {
    "SSN": "Direct Identifier",
    "CREDIT_CARD": "Financial Information",
    "CREDIT_CARD_PARTIAL": "Financial Information",
    "BANK_ACCOUNT": "Financial Information",
    "PASSPORT": "Government Identifier",
    "DRIVERS_LICENSE": "Government Identifier",
    "EMAIL": "Contact Information",
    "PHONE": "Contact Information",
    "DATE_OF_BIRTH": "Indirect Identifier / Quasi",
    "PERSON_NAME": "Direct Identifier",
    "ADDRESS": "Contact Information",
    "HEALTH_PLAN_ID": "Health Information",
    "IP_ADDRESS": "Digital Identifier",
    "INSURANCE_ID": "Health Information",
    "NPI": "Health Information",
    "MEDICAL_CODE": "Health Information",
    "TAX_ID": "Government Identifier",
    "DEMOGRAPHIC": "Indirect Identifier / Quasi",
    "FINANCIAL": "Financial Information",
    "QUASI_IDENTIFIER": "Indirect Identifier / Quasi",
}

# Masking strategy per PII type
MASKING_STRATEGIES: Dict[str, str] = {
    "SSN": "partial_mask",
    "CREDIT_CARD": "last4_mask",
    "CREDIT_CARD_PARTIAL": "keep",
    "BANK_ACCOUNT": "full_mask",
    "EMAIL": "domain_preserve",
    "PHONE": "partial_mask",
    "PERSON_NAME": "initials",
    "DATE_OF_BIRTH": "year_only",
    "ADDRESS": "city_only",
    "IP_ADDRESS": "subnet_mask",
    "PASSPORT": "full_mask",
    "DRIVERS_LICENSE": "full_mask",
    "MEDICAL_CODE": "category_only",
    "NPI": "partial_mask",
    "INSURANCE_ID": "partial_mask",
    "TAX_ID": "partial_mask",
    "HEALTH_PLAN_ID": "full_mask",
    "QUASI_IDENTIFIER": "keep",
    "DEMOGRAPHIC": "full_mask",
    "FINANCIAL": "full_mask",
}


def get_column_pii_type(column_name: str) -> str | None:
    """Return PII type for a column name (normalized), or None."""
    key = (column_name or "").strip().lower().replace(" ", "_")
    return COLUMN_TO_PII.get(key)


def get_compiled_patterns() -> Dict[str, re.Pattern]:
    """Return compiled regex patterns for value scanning."""
    return {k: re.compile(v) for k, v in PII_PATTERNS.items()}
