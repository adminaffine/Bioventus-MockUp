"""Shared PII value generators for seed scripts (synthetic data only)."""
import random
from datetime import datetime, timedelta

try:
    from faker import Faker
    fake = Faker()
    HAS_FAKER = True
except ImportError:
    HAS_FAKER = False

def _ssn_valid():
    return f"{random.randint(100, 999)}-{random.randint(10, 99)}-{random.randint(1000, 9999)}"

def _ssn_invalid():
    return random.choice(["000-00-0000", "123", "xxx-xx-xxxx", "123456789", "SSN-N/A"])

def ssn(invalid_pct=0.10):
    return _ssn_invalid() if random.random() < invalid_pct else _ssn_valid()

def credit_card(valid=True):
    if valid:
        prefix = random.choice(["4111", "5500", "3400"])
        return prefix + "".join(str(random.randint(0, 9)) for _ in range(16 - len(prefix)))[:16 - len(prefix)] + str(random.randint(1000, 9999))
    return "".join(str(random.randint(0, 9)) for _ in range(random.choice([10, 15, 17])))

def bank_account():
    return str(random.randint(10000000, 9999999999))

def insurance_id():
    return f"INS-{random.randint(10000000, 99999999)}"

def ethnicity():
    return random.choice(["White", "Black or African American", "Asian", "Hispanic or Latino", "Other", "Prefer not to say"])

def annual_income():
    return random.randint(35000, 250000)

def ip_address(malformed_pct=0.05):
    if random.random() < malformed_pct:
        return random.choice(["256.1.1.1", "192.168.1", "not-an-ip", "192.168.1.1.1"])
    return f"{random.randint(1, 223)}.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(1, 254)}"

def passport_number():
    return f"P{random.randint(10000000, 99999999)}"

def drivers_license():
    state = random.choice(["CA", "NY", "TX", "FL"])
    return f"{state}{random.randint(1000000, 9999999)}"

def emergency_contact_phone():
    if HAS_FAKER:
        return fake.numerify(text="(###) ###-####")
    return f"({random.randint(200, 999)}) {random.randint(200, 999)}-{random.randint(1000, 9999)}"

def diagnosis_code_icd10():
    return random.choice(["M79.3", "Z96.641", "G56.0", "M25.511", "J06.9", "E11.65", "I10", "K21.0"])

def treatment_notes_with_pii(first_name, last_name, ssn_val, phone_val, email_val, cc_val):
    templates = [
        f"Patient {first_name} {last_name} SSN {ssn_val} reported pain. Contact at {phone_val} or {email_val} for follow up. Credit card {cc_val} on file for billing.",
        f"Patient {first_name} {last_name} (DOB on file) contacted via {phone_val}. SSN {ssn_val} verified. Billing: {email_val}.",
        f"Follow-up: {first_name} {last_name}, SSN {ssn_val[-4:].rjust(4, '*')}... Contact {phone_val}. Card ending 1111 on file.",
    ]
    return random.choice(templates)

def prescribing_physician():
    if HAS_FAKER:
        return fake.name()
    return f"Dr. First{random.randint(1, 99)} Last{random.randint(1, 99)}"

def npi_number():
    return str(random.randint(1000000000, 1999999999))

def patient_dob():
    d = datetime.now() - timedelta(days=random.randint(365 * 18, 365 * 85))
    return d.strftime("%Y-%m-%d")

def home_address():
    if HAS_FAKER:
        return f"{fake.street_address()}, {fake.city()}, {fake.state_abbr()} {fake.zipcode()}"
    return f"{random.randint(1, 9999)} Main St, City, ST {random.randint(10000, 99999)}"

def health_plan_id():
    return f"HP-{random.randint(100000, 999999)}"

def copay_amount():
    return round(random.uniform(0, 150), 2)

def billing_address():
    if HAS_FAKER:
        return f"{fake.street_address()}, {fake.city()}, {fake.state_abbr()} {fake.zipcode()}"
    return f"{random.randint(1, 9999)} Oak Ave, City, ST {random.randint(10000, 99999)}"

def cardholder_name():
    if HAS_FAKER:
        return fake.name()
    return f"First{random.randint(1, 99)} Last{random.randint(1, 99)}"

def card_last_four():
    return str(random.randint(1000, 9999))

def tax_id():
    return f"{random.randint(10, 99)}-{random.randint(1000000, 9999999)}"

def billing_email():
    if HAS_FAKER:
        return fake.email()
    return f"billing{random.randint(1, 999)}@example.com"
