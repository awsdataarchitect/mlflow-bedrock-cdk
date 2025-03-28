# MLflow-Powered Generative AI Observability with Amazon Bedrock

## Overview

This repository implements an **MLflow-powered observability framework** for **generative AI** applications using **Amazon Bedrock**. It enables real-time tracking of model interactions, token usage analysis, and cost estimation for inference requests.

For more details on how to deploy the infrastructure and the solution details, please refer to the Blog Post:
* [MLflow-Powered Generative AI Observability with Amazon Bedrock]().

![Alt text](./mlflow.png?raw=true "MLflow-Powered Generative AI Observability with Amazon Bedrock")

## Features

- **MLflow Integration**: Tracks experiment runs, logs parameters, and records token usage and costs.
- **Amazon Bedrock Integration**: Interacts with `amazon.nova-lite-v1:0` for generating responses.
- **Token Cost Calculation**: Computes input/output token counts and associated costs using `tiktoken`.
- **Structured Inference Requests**: Uses a well-defined message format for consistency.
- **Automated Metrics Logging**: Logs prompt tokens, response tokens, and cost breakdowns to MLflow.

## Prerequisites

- Python 3.8+
- AWS credentials with access to **Amazon Bedrock**
- An MLflow tracking server
- Required Python libraries:
  ```sh
  pip install boto3 mlflow tiktoken
  ```

## Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/awsdataarchitect/mlflow-bedrock-cdk.git
   cd mlflow-bedrock-cdk
   cdk bootstrap && cdk deploy
   ```
2. Set up your MLflow tracking URI in the script:
   ```python
   mlflow.set_tracking_uri("http://your-mlflow-server.com")
   ```
3. Configure AWS credentials for **Amazon Bedrock** access.

## Usage

1. Define the input prompt:
   ```python
   prompt = "Explain machine learning observability in one paragraph"
   ```
2. Run the script:
   ```sh
   python scripts/bedrock_tracing.py
   ```
3. View logs and metrics in **MLflow UI**.

## Example Output

```
2025/03/28 12:35:42 INFO mlflow.bedrock: Enabled auto-tracing for Bedrock. Note that MLflow can only trace boto3 service clients that are created after this call. If you have already created one, please recreate the client by calling `boto3.client`.
2025/03/28 12:35:44 INFO mlflow.tracking.fluent: Experiment with name 'Bedrock-Token-Cost-Demo' does not exist. Creating a new experiment.
Response: Machine learning observability refers to the ability to monitor, diagnose, and understand the behavior and performance of machine learning models in real-time and throughout their lifecycle. It involves collecting and analyzing various metrics, logs, and traces to gain insights into model performance, data quality, and operational health. Observability helps in identifying issues such as data drift, model drift, and performance degradation, enabling data scientists and engineers to make informed decisions, ensure model reliability, and maintain the overall health of machine learning systems. This practice is crucial for maintaining model accuracy, ensuring compliance, and facilitating continuous improvement in machine learning deployments.
Cost: $0.02934000
🏃 View run rambunctious-koi-880 at: http://Mlflow-MLflo-cXfL3g06yBhj-966380976.us-east-1.elb.amazonaws.com/#/experiments/1/runs/cabc0132b4164555bab2e6e7d0e5fb04
🧪 View experiment at: http://Mlflow-MLflo-cXfL3g06yBhj-966380976.us-east-1.elb.amazonaws.com/#/experiments/1
```

## License

This project is licensed under the MIT License.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
