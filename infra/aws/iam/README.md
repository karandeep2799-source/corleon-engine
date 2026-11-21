# Corleon production IAM

This stack creates the application workload roles and GitHub OIDC deployment role used by the production platform.

## Roles

- `corleon-prod-api-role`: S3 uploads, SQS enqueue, Secrets Manager reads, CloudWatch log writes.
- `corleon-prod-worker-role`: S3 processing, SQS consume/delete, Secrets Manager reads, CloudWatch log writes.
- `corleon-prod-ai-role`: Bedrock model invocation, AI S3 prefix access, Secrets Manager reads, CloudWatch log writes.
- `corleon-prod-deployer-role`: GitHub OIDC deployment permissions for ECR/ECS.

## Bootstrap

1. Use an authenticated administrative/bootstrap session only for the initial infrastructure deployment.
2. Create the production S3 bucket, SQS queue, log groups, secrets and (if used) KMS key.
3. Copy `prod.tfvars.example` to a private `prod.tfvars` and replace every `REPLACE_*` value.
4. Configure a remote Terraform backend with state locking before production use.
5. Run `terraform init`, `terraform fmt -check -recursive`, `terraform validate`, and `terraform plan -var-file=prod.tfvars`.
6. Apply only after reviewing the plan.
7. Store the resulting `deployer_role_arn` as the GitHub Actions production environment secret `AWS_ROLE_TO_ASSUME`.

## Important

- Never commit `prod.tfvars` or credentials.
- The GitHub trust policy is restricted to the configured repository and branch.
- Keep the API, worker and AI roles separate so compromise of one workload does not grant the permissions of another.
- Add organization SCPs and IAM Identity Center permission sets at the AWS Organization level; those are intentionally not created by this account-local module.
- Before enabling automated deployment, validate the policies with IAM Access Analyzer and tighten resource ARNs to exact resources.
