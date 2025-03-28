import boto3
import mlflow

# Set tracking URI to your deployed MLflow server
mlflow.set_tracking_uri("http://Mlflow-MLflo-cXfL3g06yBhj-966380976.us-east-1.elb.amazonaws.com")  # Replace with your actual URL

# Enable auto-tracing for Amazon Bedrock
mlflow.bedrock.autolog()
mlflow.set_experiment("Bedrock-Streaming")

# Create a boto3 client for Bedrock
bedrock = boto3.client(
    service_name="bedrock-runtime",
    region_name="us-east-1",  # Replace with your region
)

# Call Bedrock streaming API
response = bedrock.converse_stream(
    modelId = "amazon.nova-lite-v1:0", # Or any Bedrock model you are using
    messages=[
        {
            "role": "user",
            "content": [
                {"text": "Write a short poem about machine learning observability."}
            ]
        }
    ],
    inferenceConfig={
        "maxTokens": 300,
        "temperature": 0.1,
        "topP": 0.9,
    }
)

# Process streaming response
for chunk in response["stream"]:
    if "message" in chunk:
        message_content = chunk["message"]["content"]
        if message_content:
            print(message_content[0]["text"], end="", flush=True)
