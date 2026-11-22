# AETHER FORGE — Staging Environment Terraform Configuration

module "aether_forge_control_plane" {
  source               = "../../modules/control-plane"
  environment          = "staging"
  audit_retention_days = 365
}
