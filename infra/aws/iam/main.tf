terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}

data "aws_partition" "current" {}

data "aws_iam_policy_document" "workload_boundary" {
  statement {
    sid    = "DenyIAMAndOrgAdministration"
    effect = "Deny"
    actions = [
      "iam:CreateUser", "iam:CreateAccessKey", "iam:CreateLoginProfile",
      "iam:CreatePolicyVersion", "iam:SetDefaultPolicyVersion",
      "iam:AttachUserPolicy", "iam:AttachRolePolicy", "iam:PutRolePolicy",
      "iam:PutUserPolicy", "iam:UpdateAssumeRolePolicy",
      "organizations:*", "account:*"
    ]
    resources = ["*"]
  }

  statement {
    sid       = "AllowApplicationServices"
    effect    = "Allow"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "sqs:*", "secretsmanager:GetSecretValue", "logs:CreateLogStream", "logs:PutLogEvents", "kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey", "bedrock:InvokeModel"]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "workload_boundary" {
  name   = "${var.project_name}-${var.environment}-workload-boundary"
  policy = data.aws_iam_policy_document.workload_boundary.json
}

resource "aws_iam_role" "api" {
  name                 = "${var.project_name}-${var.environment}-api-role"
  permissions_boundary = aws_iam_policy.workload_boundary.arn
  assume_role_policy   = data.aws_iam_policy_document.ecs_tasks.json
}

resource "aws_iam_role" "worker" {
  name                 = "${var.project_name}-${var.environment}-worker-role"
  permissions_boundary = aws_iam_policy.workload_boundary.arn
  assume_role_policy   = data.aws_iam_policy_document.ecs_tasks.json
}

resource "aws_iam_role" "ai" {
  name                 = "${var.project_name}-${var.environment}-ai-role"
  permissions_boundary = aws_iam_policy.workload_boundary.arn
  assume_role_policy   = data.aws_iam_policy_document.ecs_tasks.json
}

data "aws_iam_policy_document" "ecs_tasks" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role_policy" "api" {
  role = aws_iam_role.api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject"], Resource = "${var.s3_bucket_arn}/uploads/*" },
      { Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = var.secrets_arns },
      { Effect = "Allow", Action = ["sqs:SendMessage"], Resource = var.sqs_queue_arns },
      { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = var.log_group_arns }
    ]
  })
}

resource "aws_iam_role_policy" "worker" {
  role = aws_iam_role.worker.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject"], Resource = "${var.s3_bucket_arn}/*" },
      { Effect = "Allow", Action = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:ChangeMessageVisibility"], Resource = var.sqs_queue_arns },
      { Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = var.secrets_arns },
      { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = var.log_group_arns }
    ]
  })
}

resource "aws_iam_role_policy" "ai" {
  role = aws_iam_role.ai.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["bedrock:InvokeModel"], Resource = var.ai_model_arns },
      { Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject"], Resource = "${var.s3_bucket_arn}/ai/*" },
      { Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = var.secrets_arns },
      { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = var.log_group_arns }
    ]
  })
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_policy_document" "github_deploy_trust" {
  statement {
    effect = "Allow"
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    actions = ["sts:AssumeRoleWithWebIdentity"]
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_org}/${var.github_repo}:ref:refs/heads/${var.github_branch}"]
    }
  }
}

resource "aws_iam_role" "deployer" {
  name               = "${var.project_name}-${var.environment}-deployer-role"
  assume_role_policy = data.aws_iam_policy_document.github_deploy_trust.json
}

resource "aws_iam_role_policy" "deployer" {
  role = aws_iam_role.deployer.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = "*" },
      { Effect = "Allow", Action = ["ecr:BatchCheckLayerAvailability", "ecr:CompleteLayerUpload", "ecr:InitiateLayerUpload", "ecr:PutImage", "ecr:UploadLayerPart"], Resource = "*" },
      { Effect = "Allow", Action = ["ecs:DescribeServices", "ecs:DescribeTaskDefinition", "ecs:UpdateService", "ecs:RegisterTaskDefinition"], Resource = "*" }
    ]
  })
}
