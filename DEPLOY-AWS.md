# AWS Production Deployment Guide (Terraform + EKS + RDS)

This guide walks you through deploying the multi-tenant SaaS Billing platform to AWS. 

Infrastructure deployment is fully automated! When you push your code to the `develop` or `main` branches, **GitHub Actions will automatically run Terraform and deploy your Kubernetes pods**.

---

## 🏗️ Overview of Resources
Terraform will provision the following resources in the `ap-south-1` region:
- **VPC** with 2 Public Subnets, 2 Private Subnets, and a **NAT Gateway** (secure outbound routing for private nodes).
- **ECR Registries** to host your frontend and backend Docker images.
- **EKS Cluster (v1.29)** with a worker **Node Group** (`t3.medium` instances) running inside the private subnets.
- **RDS MySQL 8 Instance** (`db.t3.micro`) as the shared platform database.
- **ElastiCache Redis Cluster** (`cache.t3.micro`) for sessions and rate-limiting.
- **SQS Queues** (Onboarding queue and dead-letter queue).
- **AWS Lambda Function** (dynamic tenant onboarding provisioning coordinator).
- **Route53 DNS Zone** (`saas.example.com`).
- **Secrets Manager** to store the RDS database root password.

---

## 🛠️ Step-by-Step Instructions

### Step 1: Install Prerequisites
Make sure you have the following CLI tools installed on your local machine:
1. [AWS CLI](https://aws.amazon.com/cli/)
2. [Terraform CLI](https://developer.hashicorp.com/terraform/downloads)
3. [kubectl](https://kubernetes.io/docs/tasks/tools/)

---

### Step 2: Configure AWS Credentials
Open PowerShell or your command prompt and run the following command to link your AWS account:
```bash
aws configure
```
You will be prompted to enter your:
- **AWS Access Key ID**
- **AWS Secret Access Key**
- **Default region name:** `ap-south-1`
- **Default output format:** `json`

---

### Step 3: Create S3 Remote Backend & DynamoDB for Terraform State
Since Terraform runs automatically in GitHub Actions, you must create the persistent S3 state bucket and DynamoDB locking table first. 

Instead of using the AWS Console, you can create them instantly by running these two commands in your local terminal:

```bash
# 1. Create the S3 Bucket in Mumbai (ap-south-1)
aws s3api create-bucket --bucket saas-billing-tf-state-mumbai-rajbi --region ap-south-1 --create-bucket-configuration LocationConstraint=ap-south-1

# 2. Create the DynamoDB Table for locks
aws dynamodb create-table --table-name saas-billing-tf-locks --attribute-definitions AttributeName=LockID,AttributeType=S --key-schema AttributeName=LockID,KeyType=HASH --billing-mode PAY_PER_REQUEST --region ap-south-1
```

---

### Step 4: Configure GitHub Secrets
To allow GitHub Actions to run Terraform and deploy to EKS, you must configure your AWS credentials. The pipeline is designed to support both standard AWS Access Keys (easiest) and AWS OIDC Role Assumption (recommended).

Go to your GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**, and add:

#### Option A: Using AWS Access Keys (Easiest Setup)
- `AWS_ACCESS_KEY_ID`: Your AWS Access Key ID.
- `AWS_SECRET_ACCESS_KEY`: Your AWS Secret Access Key.
- `AWS_ACCOUNT_ID`: Your 12-digit AWS account ID.

#### Option B: Using AWS OIDC IAM Role (Recommended for production)
- `AWS_ROLE_ARN`: The ARN of the IAM role GitHub Actions will assume (e.g., `arn:aws:iam::<ACCOUNT_ID>:role/saas-github-actions-role`).
- `AWS_ACCOUNT_ID`: Your 12-digit AWS account ID.

*(In both options, you can optionally set `AWS_REGION` to `ap-south-1` and `SLACK_WEBHOOK` for status notifications).*

---

### Step 5: Push to GitHub to Trigger Automatic Deployment
With the S3 backend and secrets set up, you no longer need to run Terraform manually!
1. Stage and commit your changes:
   ```bash
   git add .
   git commit -m "Automate terraform setup in CI/CD pipeline"
   ```
2. Push your changes to the `develop` or `main` branch:
   ```bash
   git push origin main
   ```
3. Go to the **Actions** tab of your GitHub repository. You will see the **Platform CI/CD Pipeline** running:
   - **Quality Check (Lint)** & **Automated Tests** will run.
   - **Terraform Apply** job will trigger to provision or update all AWS resources.
   - **Build & Push to ECR** will build Docker images and push them to ECR.
   - **Trivy Security Scan** will run vulnerability analysis.
   - **Deploy to EKS** will update the running Kubernetes pods with the new images.

---

### Step 6: Connect Local `kubectl` to EKS (Manual Verification)
After the automated pipeline completes, you can connect your local machine to the cluster to monitor the nodes and pods:
```bash
aws eks update-kubeconfig --region ap-south-1 --name saas-cluster-dev
```
Verify the connection:
```bash
kubectl get nodes
kubectl get pods -A
```

---

### Step 7: Database Seeding
Connect to the RDS MySQL instance (from inside the EKS cluster or via a bastion host) and run the seed script to populate default plans:
```bash
# Exec into your backend pod and run:
npm run seed
```
