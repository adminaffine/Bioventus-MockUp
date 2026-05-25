"""
Specialty scope and drug category maps for RxIntegrity.
Used to detect out-of-specialty prescribing and duplicate-doctor misrouting.
"""

SPECIALTY_DRUG_MAP = {
    "Cardiology": {
        "allowed_categories": ["Cardiovascular", "Anticoagulant", "Antihypertensive", "Statin", "Diuretic", "Antiarrhythmic"],
        "forbidden_categories": ["Chemotherapy", "Antipsychotic", "Pediatric_Only", "Opioid_Strong"],
        "max_controlled_schedule": "III",
    },
    "Orthopedics": {
        "allowed_categories": ["NSAID", "Opioid", "Muscle_Relaxant", "Corticosteroid", "Local_Anesthetic", "Bone_Health"],
        "forbidden_categories": ["Chemotherapy", "Cardiac", "Antipsychotic", "Antidiabetic"],
        "max_controlled_schedule": "II",
    },
    "Neurology": {
        "allowed_categories": ["Anticonvulsant", "Antidepressant", "Dopaminergic", "Migraine", "Muscle_Relaxant", "Anticoagulant"],
        "forbidden_categories": ["Chemotherapy", "Pediatric_Only"],
        "max_controlled_schedule": "II",
    },
    "Psychiatry": {
        "allowed_categories": ["Antidepressant", "Antipsychotic", "Anxiolytic", "Mood_Stabilizer", "Stimulant", "Controlled_Substance"],
        "forbidden_categories": ["Chemotherapy", "Cardiac", "Antidiabetic"],
        "max_controlled_schedule": "II",
    },
    "Pediatrics": {
        "allowed_categories": ["Pediatric_Antibiotic", "Pediatric_NSAID", "Pediatric_Respiratory", "Pediatric_Antihistamine"],
        "forbidden_categories": ["Adult_Cardiac", "Chemotherapy", "Strong_Opioid", "Adult_Psychiatric"],
        "max_patient_age": 17,
        "max_controlled_schedule": "IV",
    },
    "Oncology": {
        "allowed_categories": ["Chemotherapy", "Immunosuppressant", "Antiemetic", "Pain_management", "Growth_factor"],
        "forbidden_categories": ["Pediatric_Only"],
        "max_controlled_schedule": "II",
    },
    "Endocrinology": {
        "allowed_categories": ["Antidiabetic", "Thyroid", "Hormone", "Osteoporosis", "Insulin"],
        "forbidden_categories": ["Chemotherapy", "Antipsychotic", "Strong_Opioid"],
        "max_controlled_schedule": "III",
    },
    "Dermatology": {
        "allowed_categories": ["Topical", "Retinoid", "Antifungal", "Biologic", "Antibiotic_skin"],
        "forbidden_categories": ["Chemotherapy", "Adult_Cardiac", "Strong_Opioid"],
        "max_controlled_schedule": "III",
    },
    "General Practice": {
        "allowed_categories": ["Antibiotic", "NSAID", "Antidiabetic", "Basic_analgesic"],
        "forbidden_categories": ["Chemotherapy", "Strong_Opioid", "Antipsychotic"],
        "max_controlled_schedule": "IV",
    },
}

# Map drug_name -> category, schedule, allowed_specialties, optional min_patient_age
DRUG_CATEGORY_MAP = {
    "Oxycodone": {"category": "Opioid", "schedule": "II", "allowed_specialties": ["Orthopedics", "Oncology", "Neurology"], "min_patient_age": 16},
    "Warfarin": {"category": "Anticoagulant", "schedule": None, "allowed_specialties": ["Cardiology", "Neurology"], "min_patient_age": 18},
    "Methotrexate": {"category": "Chemotherapy", "schedule": None, "allowed_specialties": ["Oncology", "Dermatology"]},
    "Adderall": {"category": "Stimulant", "schedule": "II", "allowed_specialties": ["Psychiatry", "Pediatrics"]},
    "Insulin Glargine": {"category": "Antidiabetic", "schedule": None, "allowed_specialties": ["Endocrinology", "General Practice"]},
    "Lisinopril": {"category": "Antihypertensive", "schedule": None, "allowed_specialties": ["Cardiology", "General Practice"]},
    "Metoprolol": {"category": "Cardiovascular", "schedule": None, "allowed_specialties": ["Cardiology"]},
    "Atorvastatin": {"category": "Statin", "schedule": None, "allowed_specialties": ["Cardiology", "General Practice"]},
    "Amlodipine": {"category": "Antihypertensive", "schedule": None, "allowed_specialties": ["Cardiology"]},
    "Digoxin": {"category": "Cardiovascular", "schedule": None, "allowed_specialties": ["Cardiology"]},
    "Furosemide": {"category": "Diuretic", "schedule": None, "allowed_specialties": ["Cardiology"]},
    "Spironolactone": {"category": "Diuretic", "schedule": None, "allowed_specialties": ["Cardiology"]},
    "Naproxen": {"category": "NSAID", "schedule": None, "allowed_specialties": ["Orthopedics", "General Practice"]},
    "Tramadol": {"category": "Opioid", "schedule": "IV", "allowed_specialties": ["Orthopedics", "Neurology"]},
    "Cyclobenzaprine": {"category": "Muscle_Relaxant", "schedule": None, "allowed_specialties": ["Orthopedics", "Neurology"]},
    "Methylprednisolone": {"category": "Corticosteroid", "schedule": None, "allowed_specialties": ["Orthopedics", "Neurology"]},
    "Celecoxib": {"category": "NSAID", "schedule": None, "allowed_specialties": ["Orthopedics"]},
    "Baclofen": {"category": "Muscle_Relaxant", "schedule": None, "allowed_specialties": ["Orthopedics", "Neurology"]},
    "Gabapentin": {"category": "Anticonvulsant", "schedule": None, "allowed_specialties": ["Neurology"]},
    "Levetiracetam": {"category": "Anticonvulsant", "schedule": None, "allowed_specialties": ["Neurology"]},
    "Topiramate": {"category": "Anticonvulsant", "schedule": None, "allowed_specialties": ["Neurology"]},
    "Sumatriptan": {"category": "Migraine", "schedule": None, "allowed_specialties": ["Neurology"]},
    "Donepezil": {"category": "Neurology", "schedule": None, "allowed_specialties": ["Neurology"]},
    "Amitriptyline": {"category": "Antidepressant", "schedule": None, "allowed_specialties": ["Neurology", "Psychiatry"]},
    "Carbidopa-Levodopa": {"category": "Dopaminergic", "schedule": None, "allowed_specialties": ["Neurology"]},
    "Sertraline": {"category": "Antidepressant", "schedule": None, "allowed_specialties": ["Psychiatry"]},
    "Quetiapine": {"category": "Antipsychotic", "schedule": None, "allowed_specialties": ["Psychiatry"]},
    "Lithium": {"category": "Mood_Stabilizer", "schedule": None, "allowed_specialties": ["Psychiatry"]},
    "Alprazolam": {"category": "Anxiolytic", "schedule": "IV", "allowed_specialties": ["Psychiatry"]},
    "Clonazepam": {"category": "Anxiolytic", "schedule": "IV", "allowed_specialties": ["Psychiatry", "Neurology"]},
    "Aripiprazole": {"category": "Antipsychotic", "schedule": None, "allowed_specialties": ["Psychiatry"]},
    "Venlafaxine": {"category": "Antidepressant", "schedule": None, "allowed_specialties": ["Psychiatry"]},
    "Amoxicillin": {"category": "Pediatric_Antibiotic", "schedule": None, "allowed_specialties": ["Pediatrics", "General Practice"]},
    "Azithromycin": {"category": "Pediatric_Antibiotic", "schedule": None, "allowed_specialties": ["Pediatrics", "General Practice"]},
    "Ibuprofen": {"category": "Pediatric_NSAID", "schedule": None, "allowed_specialties": ["Pediatrics", "General Practice"]},
    "Albuterol": {"category": "Pediatric_Respiratory", "schedule": None, "allowed_specialties": ["Pediatrics"]},
    "Cetirizine": {"category": "Pediatric_Antihistamine", "schedule": None, "allowed_specialties": ["Pediatrics"]},
    "Ondansetron": {"category": "Antiemetic", "schedule": None, "allowed_specialties": ["Oncology"]},
    "Filgrastim": {"category": "Growth_factor", "schedule": None, "allowed_specialties": ["Oncology"]},
    "Dexamethasone": {"category": "Corticosteroid", "schedule": None, "allowed_specialties": ["Oncology", "Neurology"]},
    "Morphine": {"category": "Opioid", "schedule": "II", "allowed_specialties": ["Oncology", "Neurology"], "min_patient_age": 16},
    "Aprepitant": {"category": "Antiemetic", "schedule": None, "allowed_specialties": ["Oncology"]},
    "Leucovorin": {"category": "Chemotherapy", "schedule": None, "allowed_specialties": ["Oncology"]},
    "Metformin": {"category": "Antidiabetic", "schedule": None, "allowed_specialties": ["Endocrinology", "General Practice"]},
    "Levothyroxine": {"category": "Thyroid", "schedule": None, "allowed_specialties": ["Endocrinology"]},
    "Alendronate": {"category": "Osteoporosis", "schedule": None, "allowed_specialties": ["Endocrinology"]},
    "Liraglutide": {"category": "Antidiabetic", "schedule": None, "allowed_specialties": ["Endocrinology"]},
    "Semaglutide": {"category": "Antidiabetic", "schedule": None, "allowed_specialties": ["Endocrinology"]},
    "Hydrocortisone": {"category": "Hormone", "schedule": None, "allowed_specialties": ["Endocrinology"]},
    "Tretinoin": {"category": "Retinoid", "schedule": None, "allowed_specialties": ["Dermatology"]},
    "Clobetasol": {"category": "Topical", "schedule": None, "allowed_specialties": ["Dermatology"]},
    "Doxycycline": {"category": "Antibiotic_skin", "schedule": None, "allowed_specialties": ["Dermatology", "General Practice"]},
    "Dupilumab": {"category": "Biologic", "schedule": None, "allowed_specialties": ["Dermatology"]},
    "Terbinafine": {"category": "Antifungal", "schedule": None, "allowed_specialties": ["Dermatology"]},
    "Benzoyl Peroxide": {"category": "Topical", "schedule": None, "allowed_specialties": ["Dermatology"]},
    "Isotretinoin": {"category": "Retinoid", "schedule": None, "allowed_specialties": ["Dermatology"]},
    # Aliases / categories from seed data
    "Opioid/Muscle Relaxant": {"category": "Opioid", "schedule": "II", "allowed_specialties": ["Orthopedics", "Oncology", "Neurology"]},
    "Cardiovascular": {"category": "Cardiovascular", "schedule": None, "allowed_specialties": ["Cardiology", "General Practice"]},
    "Anticoagulant": {"category": "Anticoagulant", "schedule": None, "allowed_specialties": ["Cardiology", "Neurology"], "min_patient_age": 18},
    "Chemotherapy": {"category": "Chemotherapy", "schedule": None, "allowed_specialties": ["Oncology", "Dermatology"]},
    "Stimulant": {"category": "Stimulant", "schedule": "II", "allowed_specialties": ["Psychiatry", "Pediatrics"]},
    "Opioid": {"category": "Opioid", "schedule": "II", "allowed_specialties": ["Orthopedics", "Oncology", "Neurology"], "min_patient_age": 16},
    "Anxiolytic": {"category": "Anxiolytic", "schedule": "IV", "allowed_specialties": ["Psychiatry"]},
}


def get_drug_info(drug_name: str, drug_category: str = "") -> dict:
    """Return drug info from DRUG_CATEGORY_MAP; fallback to category if drug not found."""
    info = DRUG_CATEGORY_MAP.get(drug_name) or DRUG_CATEGORY_MAP.get(drug_category)
    if info:
        return info.copy()
    # Infer from category string
    cat_lower = (drug_category or "").lower()
    if "opioid" in cat_lower or "muscle relaxant" in cat_lower:
        return {"category": "Opioid", "schedule": "II", "allowed_specialties": ["Orthopedics", "Oncology", "Neurology"], "min_patient_age": 16}
    if "chemo" in cat_lower:
        return {"category": "Chemotherapy", "schedule": None, "allowed_specialties": ["Oncology", "Dermatology"]}
    if "anticoagulant" in cat_lower:
        return {"category": "Anticoagulant", "schedule": None, "allowed_specialties": ["Cardiology", "Neurology"], "min_patient_age": 18}
    if "cardiovascular" in cat_lower or "antihypertensive" in cat_lower:
        return {"category": "Cardiovascular", "schedule": None, "allowed_specialties": ["Cardiology", "General Practice"]}
    return {"category": drug_category or "Unknown", "schedule": None, "allowed_specialties": []}
