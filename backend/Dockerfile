FROM python:3.12-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ANONYMIZED_TELEMETRY=false \
    BROWSER_USE_CONFIG_DIR=/app/.browseruse \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY requirements.txt .
# Installing Chromium through the pinned playwright package guarantees the
# browser build matches the Python library version.
RUN pip install --no-cache-dir -r requirements.txt \
 && playwright install --with-deps chromium \
 && rm -rf /var/lib/apt/lists/*

COPY . .

# Don't run the agent's browser as root.
RUN useradd --create-home app \
 && mkdir -p /app/.browseruse \
 && chown -R app:app /app /ms-playwright
USER app

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
