from dotenv import load_dotenv
load_dotenv()

import os

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL")
DEEPSEEK_URL = "https://api.deepseek.com/"

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "").split(",")

# Redis
REDIS_HOST = os.getenv("REDIS_HOST")
REDIS_PORT = os.getenv("REDIS_PORT")
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")

# Session expiration in seconds
SESSION_EXPIRATION = 60 * 60 * 24