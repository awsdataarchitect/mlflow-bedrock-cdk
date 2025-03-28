#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MlflowBedrockStack } from '../lib/mlflow-bedrock-cdk-stack';
import { Aspects } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';

const app = new cdk.App();
const stack = new MlflowBedrockStack(app, 'MlflowBedrockStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  },
});

// Create an Aspect to apply removal policy
class ApplyRemovalPolicy implements cdk.IAspect {
  public visit(node: IConstruct): void {  
    if (node instanceof cdk.CfnResource) {
      node.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
    }
  }
}

// Apply the aspect to the entire stack
Aspects.of(stack).add(new ApplyRemovalPolicy());

app.synth();