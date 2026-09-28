output "api_role_arn" {
  value = aws_iam_role.api.arn
}

output "worker_role_arn" {
  value = aws_iam_role.worker.arn
}

output "ai_role_arn" {
  value = aws_iam_role.ai.arn
}

output "deployer_role_arn" {
  value = aws_iam_role.deployer.arn
}

output "workload_boundary_arn" {
  value = aws_iam_policy.workload_boundary.arn
}
