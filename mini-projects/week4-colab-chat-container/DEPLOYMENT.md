# Deployment Guide — collab-chat on AWS ECS Fargate

> **Stack**: Node.js container → Amazon ECR (registry) → Amazon ECS on Fargate (serverless execution)  
> **Prerequisites**: AWS CLI v2 configured, Docker installed, an AWS account.

---

## Architecture Overview

```
Internet
    │
    ▼
┌─────────────────────────────────┐
│   Application Load Balancer     │  ← handles HTTP + WebSocket upgrades
│   (port 80 / 443)               │
└────────────────┬────────────────┘
                 │
    ┌────────────▼───────────────┐
    │   ECS Fargate Service       │  ← serverless; no EC2 to manage
    │   (1–N tasks, auto-scale)   │
    │                             │
    │  ┌─────────┐ ┌─────────┐   │
    │  │ Task 1  │ │ Task 2  │   │  ← each task = 1 container
    │  │:3000    │ │:3000    │   │
    │  └─────────┘ └─────────┘   │
    └────────────────────────────┘
                 │
    ┌────────────▼───────────────┐
    │   Amazon ECR                │  ← your container image lives here
    │   (private registry)        │
    └────────────────────────────┘
```

---

## Part 1 — Local Setup & Build

### 1.1 Install dependencies and test locally

```bash
cd week4-collab-chat
npm install
npm start
# Open http://localhost:3000 — verify chat works
```

### 1.2 Build and test the Docker image locally

```bash
# Build
docker build -t collab-chat:local .

# Run (maps container port 3000 → host port 3000)
docker run -p 3000:3000 collab-chat:local

# Verify health check works
curl -I http://localhost:3000/
```

---

## Part 2 — Amazon ECR (Container Registry)

ECR is AWS's private Docker registry. You push your image here; ECS pulls from here.

### 2.1 Set environment variables

```bash
export AWS_REGION=ap-south-1          # Mumbai — closest to IGDTUW/Delhi
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ECR_REPO=collab-chat
export IMAGE_TAG=latest
```

### 2.2 Create the ECR repository

```bash
aws ecr create-repository \
  --repository-name $ECR_REPO \
  --region $AWS_REGION \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256
```

Expected output snippet:
```json
{
  "repository": {
    "repositoryUri": "123456789012.dkr.ecr.ap-south-1.amazonaws.com/collab-chat"
  }
}
```

Save the URI:
```bash
export ECR_URI=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO
echo $ECR_URI
```

### 2.3 Authenticate Docker to ECR

```bash
aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin $ECR_URI
# Should print: Login Succeeded
```

### 2.4 Tag and push the image

```bash
docker tag collab-chat:local $ECR_URI:$IMAGE_TAG
docker push $ECR_URI:$IMAGE_TAG
```

Verify it's there:
```bash
aws ecr list-images --repository-name $ECR_REPO --region $AWS_REGION
```

---

## Part 3 — IAM Roles

ECS needs two roles: one for the task itself, one for the execution agent.

### 3.1 Task Execution Role (lets Fargate pull the image & write logs)

```bash
# Create trust policy
cat > ecs-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "ecs-tasks.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
EOF

aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document file://ecs-trust-policy.json

aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

---

## Part 4 — Networking (VPC, Subnets, Security Groups)

> Skip if you want to use the default VPC — just note your default VPC ID and subnet IDs.

### 4.1 Get your default VPC

```bash
export VPC_ID=$(aws ec2 describe-vpcs \
  --filters "Name=isDefault,Values=true" \
  --query "Vpcs[0].VpcId" --output text --region $AWS_REGION)

export SUBNET_IDS=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query "Subnets[*].SubnetId" --output text --region $AWS_REGION \
  | tr '\t' ',')

echo "VPC: $VPC_ID"
echo "Subnets: $SUBNET_IDS"
```

### 4.2 Security group for the ECS tasks

```bash
export SG_TASK=$(aws ec2 create-security-group \
  --group-name collab-chat-task-sg \
  --description "collab-chat ECS tasks" \
  --vpc-id $VPC_ID \
  --region $AWS_REGION \
  --query GroupId --output text)

# Allow inbound port 3000 from the ALB only (we'll add ALB SG reference after)
# For now allow from anywhere for testing:
aws ec2 authorize-security-group-ingress \
  --group-id $SG_TASK \
  --protocol tcp --port 3000 --cidr 0.0.0.0/0 \
  --region $AWS_REGION
```

### 4.3 Security group for the ALB

```bash
export SG_ALB=$(aws ec2 create-security-group \
  --group-name collab-chat-alb-sg \
  --description "collab-chat ALB" \
  --vpc-id $VPC_ID \
  --region $AWS_REGION \
  --query GroupId --output text)

aws ec2 authorize-security-group-ingress \
  --group-id $SG_ALB --protocol tcp --port 80 --cidr 0.0.0.0/0 \
  --region $AWS_REGION

aws ec2 authorize-security-group-ingress \
  --group-id $SG_ALB --protocol tcp --port 443 --cidr 0.0.0.0/0 \
  --region $AWS_REGION
```

---

## Part 5 — CloudWatch Logs

```bash
aws logs create-log-group \
  --log-group-name /ecs/collab-chat \
  --region $AWS_REGION
```

---

## Part 6 — ECS Cluster

An ECS cluster is the logical grouping. With Fargate you don't manage any servers inside it.

```bash
aws ecs create-cluster \
  --cluster-name collab-chat-cluster \
  --capacity-providers FARGATE FARGATE_SPOT \
  --region $AWS_REGION
```

---

## Part 7 — Task Definition

The task definition describes your container: image, CPU, memory, ports, env vars, logging.

```bash
cat > task-def.json << EOF
{
  "family": "collab-chat",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "collab-chat",
      "image": "${ECR_URI}:${IMAGE_TAG}",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        { "name": "PORT", "value": "3000" },
        { "name": "NODE_ENV", "value": "production" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/collab-chat",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget -qO- http://localhost:3000/ || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 10
      }
    }
  ]
}
EOF

aws ecs register-task-definition \
  --cli-input-json file://task-def.json \
  --region $AWS_REGION
```

---

## Part 8 — Application Load Balancer

The ALB is needed to:
1. Handle WebSocket connection upgrades (`Upgrade: websocket`)
2. Route HTTP traffic to your Fargate tasks
3. Provide a stable DNS name

### 8.1 Create ALB

```bash
export ALB_ARN=$(aws elbv2 create-load-balancer \
  --name collab-chat-alb \
  --subnets $(echo $SUBNET_IDS | tr ',' ' ') \
  --security-groups $SG_ALB \
  --scheme internet-facing \
  --type application \
  --region $AWS_REGION \
  --query "LoadBalancers[0].LoadBalancerArn" --output text)

export ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --query "LoadBalancers[0].DNSName" --output text \
  --region $AWS_REGION)

echo "ALB DNS: $ALB_DNS"
```

### 8.2 Create Target Group

```bash
export TG_ARN=$(aws elbv2 create-target-group \
  --name collab-chat-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path / \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --region $AWS_REGION \
  --query "TargetGroups[0].TargetGroupArn" --output text)
```

### 8.3 Create HTTP Listener

```bash
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN \
  --region $AWS_REGION
```

> **WebSocket note**: ALB natively supports WebSocket upgrades — no extra config needed. The `Upgrade: websocket` header is passed through automatically.

---

## Part 9 — ECS Service

The service keeps your desired number of tasks running and registers them with the ALB.

```bash
aws ecs create-service \
  --cluster collab-chat-cluster \
  --service-name collab-chat-service \
  --task-definition collab-chat \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={
    subnets=[$(echo $SUBNET_IDS | tr ',' ',')],
    securityGroups=[$SG_TASK],
    assignPublicIp=ENABLED
  }" \
  --load-balancers "targetGroupArn=$TG_ARN,containerName=collab-chat,containerPort=3000" \
  --health-check-grace-period-seconds 30 \
  --region $AWS_REGION
```

### Check service status

```bash
aws ecs describe-services \
  --cluster collab-chat-cluster \
  --services collab-chat-service \
  --region $AWS_REGION \
  --query "services[0].{status:status,running:runningCount,desired:desiredCount}"
```

Wait until `runningCount == desiredCount` (takes ~60–90 seconds).

---

## Part 10 — Access Your App

```bash
echo "http://$ALB_DNS"
```

Open that URL in a browser. The WebSocket client auto-detects `ws://` vs `wss://` from the page protocol.

---

## Part 11 — Auto Scaling (Optional)

Scale tasks up under load, down when idle — you pay only for what runs.

```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/collab-chat-cluster/collab-chat-service \
  --min-capacity 1 \
  --max-capacity 5 \
  --region $AWS_REGION

# Scale out when CPU > 70%
aws application-autoscaling put-scaling-policy \
  --policy-name collab-chat-cpu-scale \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/collab-chat-cluster/collab-chat-service \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    },
    "ScaleInCooldown": 120,
    "ScaleOutCooldown": 60
  }' \
  --region $AWS_REGION
```

> **Multi-task WebSocket caveat**: If you scale to 2+ tasks, WebSocket connections are pinned to one task. Enable ALB sticky sessions (session stickiness) on the target group, or move room state to Redis/ElastiCache for true horizontal scaling.

---

## Part 12 — Redeployment Workflow

When you push new code:

```bash
# 1. Rebuild
docker build -t $ECR_URI:$IMAGE_TAG .

# 2. Push to ECR
docker push $ECR_URI:$IMAGE_TAG

# 3. Force ECS to pull the new image
aws ecs update-service \
  --cluster collab-chat-cluster \
  --service collab-chat-service \
  --force-new-deployment \
  --region $AWS_REGION
```

ECS performs a rolling update: new task starts → health check passes → old task stops.

---

## Part 13 — Teardown (avoid charges)

```bash
# Scale down service
aws ecs update-service \
  --cluster collab-chat-cluster \
  --service collab-chat-service \
  --desired-count 0 \
  --region $AWS_REGION

# Delete service
aws ecs delete-service \
  --cluster collab-chat-cluster \
  --service collab-chat-service \
  --force --region $AWS_REGION

# Delete ALB + target group
aws elbv2 delete-load-balancer --load-balancer-arn $ALB_ARN --region $AWS_REGION
aws elbv2 delete-target-group --target-group-arn $TG_ARN --region $AWS_REGION

# Delete cluster
aws ecs delete-cluster --cluster collab-chat-cluster --region $AWS_REGION

# Delete ECR repo and all images
aws ecr delete-repository \
  --repository-name $ECR_REPO \
  --force --region $AWS_REGION

# Delete log group
aws logs delete-log-group \
  --log-group-name /ecs/collab-chat \
  --region $AWS_REGION

# Cleanup temp files
rm -f task-def.json ecs-trust-policy.json
```

---

## Concept Summary

| Concept | What it does here |
|---|---|
| **Docker** | Packages the Node.js server + `ws` dependency into a portable image |
| **ECR** | AWS-hosted private registry — like Docker Hub but in your VPC |
| **ECS** | Orchestrates running containers (where, how many, health) |
| **Fargate** | Serverless compute layer — no EC2 servers to provision or patch |
| **Task Definition** | Blueprint: which image, how much CPU/RAM, which ports, env vars |
| **Service** | Keeps N tasks running; replaces unhealthy ones automatically |
| **ALB** | Routes HTTP + WebSocket traffic; provides stable DNS |
| **Target Group** | ALB's list of healthy task IPs; health-checked on `GET /` |
| **awsvpc** | Each Fargate task gets its own ENI and private IP |
| **Auto Scaling** | Adds/removes tasks based on CPU — you pay per second of usage |
