variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "project_name" {
  type    = string
  default = "corleon"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "github_org" {
  type = string
}

variable "github_repo" {
  type = string
}

variable "github_branch" {
  type    = string
  default = "main"
}

variable "s3_bucket_arn" {
  type = string
}

variable "secrets_arns" {
  type    = list(string)
  default = []
}

variable "sqs_queue_arns" {
  type    = list(string)
  default = []
}

variable "log_group_arns" {
  type    = list(string)
  default = []
}

variable "ai_model_arns" {
  type    = list(string)
  default = []
}
