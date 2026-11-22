package aetherforge.governance.v1

import rego.v1

default decision := "deny"
default reason_code := "POLICY_UNKNOWN_ACTION_DENIED"

# Allowlisted tenant-scoped reads (never SECRET_CREDENTIAL)
decision := "allow" if {
  input.actionClass == "read_allowlisted"
  input.classification != "SECRET_CREDENTIAL"
}

# Workspace writes, bounded commands, and offline audio DSP require Owner or Builder approval
decision := "requireApproval" if {
  input.actionClass in {"write_workspace", "command_bounded", "audio_dsp"}
  input.classification != "SECRET_CREDENTIAL"
}

# External upload requires Owner approval and strictly denies SECRET_CREDENTIAL and RESTRICTED_LOCAL
decision := "requireApproval" if {
  input.actionClass == "external_upload"
  input.classification in {"PUBLIC", "INTERNAL", "CONFIDENTIAL"}
}

# Package install requires Owner or WorkerOperator approval
decision := "requireApproval" if {
  input.actionClass == "package_install"
  input.classification != "SECRET_CREDENTIAL"
}

# Release publication requires ReleaseManager or Reviewer approval
decision := "requireApproval" if {
  input.actionClass == "release_publish"
  input.classification != "SECRET_CREDENTIAL"
}

# DAW operations are denied unless empirical qualification flag is true for the active bundle
decision := "allow" if {
  input.actionClass == "daw_inspect"
  input.dawCapabilityQualified == true
}

decision := "requireApproval" if {
  input.actionClass in {"daw_non_destructive_edit", "daw_session_mutation", "daw_render"}
  input.dawCapabilityQualified == true
}
