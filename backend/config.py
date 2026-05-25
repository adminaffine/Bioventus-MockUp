import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "luminos_demo.db"

def get_db_path():
    return str(DB_PATH)

def get_openai_api_key():
    return os.getenv("OPENAI_API_KEY", "")
