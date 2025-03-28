import boto3
import mlflow
import tiktoken
from mlflow.entities import SpanType

# Set tracking URI 
mlflow.set_tracking_uri("http://Mlflow-MLflo-cXfL3g06yBhj-966380976.us-east-1.elb.amazonaws.com")

# Enable auto-tracing
mlflow.bedrock.autolog()

# Create experiment
mlflow.set_experiment("Bedrock-Token-Cost-Demo")

# Initialize Bedrock client
bedrock = boto3.client(
    service_name="bedrock-runtime",
    region_name="us-east-1"
)

model_id = "amazon.nova-lite-v1:0"
encoding = tiktoken.get_encoding("cl100k_base")

@mlflow.trace
def calculate_tokens_and_cost(prompt, response_text):
    prompt_tokens = len(encoding.encode(prompt))
    response_tokens = len(encoding.encode(response_text))
    
    # Current Nova Lite pricing (as of 2025-03-27)
    input_price = 60  # $0.00006 per 1K input tokens 
    output_price = 240 # $0.00024 per 1K output tokens
    
    return (
        prompt_tokens,
        response_tokens,
        (prompt_tokens / 1_000_000) * input_price,
        (response_tokens / 1_000_000) * output_price,
        ((prompt_tokens * input_price) + (response_tokens * output_price)) / 1_000_000
    )

prompt = "Explain machine learning observability in one paragraph"

with mlflow.start_run():
    mlflow.log_param("prompt", prompt)
    
    # Fixed message structure
    response = bedrock.converse(
        modelId=model_id,
        messages=[{
            "role": "user",
            "content": [{
                "text": prompt  # Content must be list of content blocks
            }]
        }],
        inferenceConfig={
            "maxTokens": 512,
            "temperature": 0.1,
            "topP": 0.9
        }
    )
    
    # Extract response safely
    response_content = response.get('output', {}).get('message', {}).get('content', [])
    response_text = response_content[0].get('text', '') if response_content else ''
    
    # Calculate and log metrics
    metrics = calculate_tokens_and_cost(prompt, response_text)
    mlflow.log_metrics({
        "prompt_tokens": metrics[0],
        "response_tokens": metrics[1],
        "prompt_cost": metrics[2],
        "response_cost": metrics[3],
        "total_cost": metrics[4]
    })
    
    print(f"Response: {response_text}")
    print(f"Cost: ${metrics[4]:.8f}")
