# AWS Production Deployment Guide (Terraform + EKS + RDS)

This guide walks you through deploying the multi-tenant SaaS Billing platform to AWS using the configured Terraform script.

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

### Step 3: Package the Provisioning Lambda
We have already packaged the Lambda code and dependencies into [terraform/lambda.zip](file:///d:/devops/NEW_PROJECT_FILE/full%20project/saas-billing/terraform/lambda.zip). 
*(If you ever modify the Lambda code under `/lambda/provision-tenant/`, you can repackage it by running: `Compress-Archive -Path "lambda/provision-tenant/*" -DestinationPath "terraform/lambda.zip" -Force` in PowerShell).*

---

### Step 4: Initialize and Apply Terraform
1. Open terminal and navigate to the `terraform/` folder:
   ```bash
   cd terraform
   ```
2. Initialize Terraform providers and backend:
   ```bash
   terraform init
   ```
3. Generate a plan to preview the infrastructure resources:
   ```bash
   terraform plan
   ```
4. Apply the configuration to create the infrastructure:
   ```bash
   terraform apply
   ```
   *Type `yes` when prompted to confirm.*
   
> [!IMPORTANT]
> EKS cluster and node group provisioning takes around **15 to 20 minutes** to complete. Please do not interrupt the process.

---

### Step 5: Connect Kubernetes `kubectl` to EKS
Once `terraform apply` finishes successfully, configure your local `kubectl` to communicate with the new EKS cluster:
```bash
aws eks update-kubeconfig --region ap-south-1 --name saas-cluster-dev
```
Verify the connection by running:
```bash
kubectl get nodes
```
You should see your `t3.medium` worker nodes in the output.

---

### Step 6: Build and Push Docker Images to ECR
Retrieve your AWS account ID (or find it in the ECR repository URLs output by Terraform). Log in to ECR and push your built backend and frontend images:

1. **Log in to ECR:**
   ```bash
   aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com
   ```
2. **Tag and Push Backend:**
   ```bash
   docker tag saas-billing-backend:latest <AWS_ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/saas-billing-backend:latest
   docker push <AWS_ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/saas-billing-backend:latest
   ```
3. **Tag and Push Frontend:**
   ```bash
   docker tag saas-billing-frontend:latest <AWS_ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/saas-billing-frontend:latest
   docker push <AWS_ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/saas-billing-frontend:latest
   ```

---

### Step 7: Deploy Services (Helm or Kubernetes Manifests)
Deploy the application charts using Helm or ArgoCD:
1. Open the [helm/saas-billing/values.yaml](file:///d:/devops/NEW_PROJECT_FILE/full%20project/saas-billing/helm/saas-billing) or Kubernetes config templates.
2. Update the environment database host (using the RDS endpoint output by Terraform) and Redis host (using the ElastiCache endpoint).
3. Apply the helm chart to EKS:
   ```bash
   helm install saas-billing ./helm/saas-billing -n default
   ```

---

### Step 8: Database Seeding
Connect to the RDS MySQL instance (from inside the EKS cluster or via a bastion host) and run the seed script to populate default plans:
```bash
# Exec into your backend pod and run:
npm run seed
```
