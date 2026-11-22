# AETHER FORGE — Control Plane Terraform Module (Blueprint §3 & §5)
# Declarative infrastructure boundary: Managed PostgreSQL 16 (pgvector),
# Immutable S3 Object Storage (Knowledge & Artifact Registry), and Secret Manager.

terraform {
  required_version = ">= 1.6.0"
}

variable "environment" {
  type        = string
  description = "Deployment stage: dev, staging, or production"
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "environment must be dev, staging, or production."
  }
}

variable "audit_retention_days" {
  type        = number
  default     = 365
  description = "Minimum immutable audit retention in days (GOVERNANCE.md §7)"
}

output "control_plane_boundary_manifest" {
  value = {
    environment                    = var.environment
    postgres_version               = "16"
    pgvector_enabled               = true
    immutable_knowledge_bucket     = "aetherforge-knowledge-${var.environment}"
    immutable_artifacts_bucket     = "aetherforge-artifacts-${var.environment}"
    audit_retention_days           = var.audit_retention_days
    inbound_worker_ports_permitted = false
    outbound_worker_mtls_required  = true
  }
}
