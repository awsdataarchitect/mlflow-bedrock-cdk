FROM --platform=amd64 python:3.9-slim

WORKDIR /app

# Install system build dependencies
RUN apt-get update && \
    apt-get install -y gcc python3-dev && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install mlflow==2.21.2 boto3 psycopg2-binary awscli

# Expose MLflow UI port
EXPOSE 5000

# Start MLflow server
CMD mlflow server \
    --host 0.0.0.0 \
    --port 5000 \
    --backend-store-uri ${MLFLOW_TRACKING_URI} \
    --default-artifact-root ${MLFLOW_S3_ARTIFACT_URI}
