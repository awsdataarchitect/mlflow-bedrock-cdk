import boto3
import mlflow
import tiktoken
from mlflow.entities import SpanType

mlflow.set_tracking_uri("http://Mlflow-MLflo-cXfL3g06yBhj-966380976.us-east-1.elb.amazonaws.com")
mlflow.bedrock.autolog()
mlflow.set_experiment("Bedrock-Token-Cost-Demo")

bedrock = boto3.client(service_name="bedrock-runtime", region_name="us-east-1")
model_id = "amazon.nova-lite-v1:0"
encoding = tiktoken.get_encoding("cl100k_base")

@mlflow.trace(span_type=SpanType.TOOL)
def calculate_tokens_and_cost(prompt, response_text):
    prompt_tokens = len(encoding.encode(prompt))
    response_tokens = len(encoding.encode(response_text))
    
    input_price = 60  # $0.00006 per 1K input tokens 
    output_price = 240 # $0.00024 per 1K output tokens
    
    prompt_cost = (prompt_tokens ) * input_price / 1000000
    response_cost = (response_tokens) * output_price / 1000000
    total_cost = prompt_cost + response_cost
    
    return prompt_tokens, response_tokens, prompt_cost, response_cost, total_cost

@mlflow.trace(span_type=SpanType.CHAIN)
def process_prompt(prompt):
    with mlflow.start_span(name="bedrock_converse", span_type=SpanType.LLM) as span:
        span.set_inputs({"prompt": prompt, "model_id": model_id})
        
        response = bedrock.converse(
            modelId=model_id,
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={"maxTokens": 512, "temperature": 0.1, "topP": 0.9}
        )
        
        response_content = response.get('output', {}).get('message', {}).get('content', [])
        response_text = response_content[0].get('text', '') if response_content else ''
        
        span.set_outputs({"response": response_text})
    
    metrics = calculate_tokens_and_cost(prompt, response_text)
    
    with mlflow.start_span(name="log_metrics", span_type=SpanType.UNKNOWN) as span:
        span.set_inputs({"metrics": metrics})
        mlflow.log_metrics({
            "prompt_tokens": metrics[0],
            "response_tokens": metrics[1],
            "prompt_cost": metrics[2],
            "response_cost": metrics[3],
            "total_cost": metrics[4]
        })
    
    return response_text, metrics[4]

with mlflow.start_run():
    prompt = "Explain machine learning observability in one paragraph"
    mlflow.log_param("prompt", prompt)
    
    response, cost = process_prompt(prompt)
    
    print(f"Response: {response}")
    print(f"Cost: ${cost:.8f}")
