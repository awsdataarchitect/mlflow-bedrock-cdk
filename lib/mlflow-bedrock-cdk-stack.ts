import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import { aws_servicediscovery as cloudmap } from 'aws-cdk-lib';


export class MlflowBedrockStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Define project name
    const projectName = 'mlflow-bedrock';

    // Create VPC
    const vpc = new ec2.Vpc(this, 'MLflowVPC', {
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: 'public-subnet',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        }
      ],
      natGateways: 0,
    });

    // Create ECS Cluster
    const cluster = new ecs.Cluster(this, 'MLflowCluster', {
      vpc,
      clusterName: 'mlflow-cluster',
      defaultCloudMapNamespace: {
        name: 'mlflow-ns',
        type: cloudmap.NamespaceType.DNS_PRIVATE,
        vpc: vpc
      }
    });

    // Create S3 bucket for MLflow artifacts
    const artifactBucket = new s3.Bucket(this, 'MLflowArtifacts', {
      bucketName: `${projectName}-artifacts-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // Create task execution role with required permissions
    const executionRole = new iam.Role(this, 'EcsTaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    executionRole.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "ssmmessages:CreateDataChannel",
        "ssmmessages:OpenDataChannel",
        "ssmmessages:OpenControlChannel",
        "ssmmessages:CreateControlChannel",
      ],
      resources: ["*"] //adjust as per your need
    }));

    // Create IAM role for MLflow task
    const taskRole = new iam.Role(this, 'MLflowTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      roleName: `${projectName}-task-role`
    });

    // Add permissions to access S3 bucket
    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
        's3:ListBucket'
      ],
      resources: [
        artifactBucket.bucketArn,
        `${artifactBucket.bucketArn}/*`
      ]
    }));

    // Add permissions for CloudWatch Logs and Metrics
    taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
        "logs:DescribeLogStreams",
        "logs:DescribeLogGroups",
        'cloudwatch:PutMetricData',
        'servicediscovery:DiscoverInstances',
        'servicediscovery:GetNamespace',
        'servicediscovery:GetService'
      ],
      resources: ['*'],
    }));


    // Add permissions for Bedrock
    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
        'bedrock:Converse',
        'bedrock:ConverseStream'
      ],
      resources: ['*']
    }));

    // Add permissions for ECR
    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetRepositoryPolicy',
        'ecr:DescribeRepositories',
        'ecr:ListImages',
        'ecr:DescribeImages',
        'ecr:GetAuthorizationToken'
      ],
      resources: ['*']
    }));

    // Create a security group for PostgreSQL
    const postgresSecurityGroup = new ec2.SecurityGroup(this, 'PostgresSecurityGroup', {
      vpc,
      description: 'Security group for PostgreSQL container',
      allowAllOutbound: true
    });

    // Create task definition for PostgreSQL
    const postgresTaskDefinition = new ecs.FargateTaskDefinition(this, 'PostgresTaskDef', {
      memoryLimitMiB: 1024,
      family: `${projectName}-postgres-task-family`,
      cpu: 512,
      taskRole: taskRole,
      executionRole: executionRole
    });

    const postgresContainer = postgresTaskDefinition.addContainer('PostgresContainer', {
      image: ecs.ContainerImage.fromRegistry('postgres:13'),
      environment: {
        'POSTGRES_USER': 'mlflow',
        'POSTGRES_PASSWORD': 'mlflow123',
        'POSTGRES_DB': 'mlflow'
      },
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'postgres' })
    });

    postgresContainer.addPortMappings({
      containerPort: 5432,
      hostPort: 5432
    });

    // Deploy PostgreSQL as a service
    const postgresService = new ecs.FargateService(this, 'PostgresService', {
      cluster,
      serviceName: 'postgres-service',
      taskDefinition: postgresTaskDefinition,
      desiredCount: 1,
      securityGroups: [postgresSecurityGroup],
      minHealthyPercent: 0,
      maxHealthyPercent: 200,
      assignPublicIp: true,
      cloudMapOptions: {
        name: 'postgres', // Explicit service name
        dnsRecordType: cloudmap.DnsRecordType.A,
        dnsTtl: cdk.Duration.seconds(60)
      }
    });

    // Create MLflow task definition
    const mlflowTaskDef = new ecs.FargateTaskDefinition(this, 'MLflowTaskDef', {
      taskRole: taskRole,
      executionRole: executionRole,
      family: `${projectName}-mlflow-task-family`,
      memoryLimitMiB: 2048,
      cpu: 1024
    });

    const mlflowContainer = mlflowTaskDef.addContainer('MLflowContainer', {
      image: ecs.ContainerImage.fromAsset('./lib/mlflow-container'),
      environment: {
        'MLFLOW_S3_ENDPOINT_URL': 'https://s3.amazonaws.com',
        'AWS_DEFAULT_REGION': this.region,
        'MLFLOW_TRACKING_URI': `postgresql://mlflow:mlflow123@postgres.mlflow-ns:5432/mlflow`,
        'MLFLOW_S3_ARTIFACT_URI': `s3://${artifactBucket.bucketName}`
      },
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'mlflow' })
    });

    mlflowContainer.addPortMappings({
      containerPort: 5000,
      hostPort: 5000
    });

    // Deploy MLflow as a load-balanced service with Application Load Balancer
    const mlflowService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'MLflowService', {
      cluster,
      serviceName: 'mlflow-service',
      taskDefinition: mlflowTaskDef,
      desiredCount: 1,
      publicLoadBalancer: true,
      minHealthyPercent: 0,
      maxHealthyPercent: 200,
      assignPublicIp: true,
      listenerPort: 80,
    });
    mlflowService.targetGroup.configureHealthCheck({
      path: '/',
      interval: cdk.Duration.seconds(25),
      timeout: cdk.Duration.seconds(15),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 2,
      healthyHttpCodes: '200,302'
    });
    // Allow MLflow service to connect to PostgreSQL
    postgresSecurityGroup.addIngressRule(
      mlflowService.service.connections.securityGroups[0],
      ec2.Port.tcp(5432),
      'Allow MLflow to connect to PostgreSQL'
    );

    // Outputs
    new cdk.CfnOutput(this, 'MLflowURL', {
      value: mlflowService.loadBalancer.loadBalancerDnsName,
      description: 'URL for MLflow Tracking Server'
    });

    new cdk.CfnOutput(this, 'ArtifactBucketName', {
      value: artifactBucket.bucketName,
      description: 'S3 bucket for MLflow artifacts'
    });
  }
}
