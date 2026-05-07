FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=10s --start-period=30s --retries=5 \
  CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Shell form so $PORT is expanded at runtime (Cloud Run injects PORT)
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
