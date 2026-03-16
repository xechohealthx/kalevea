#!/usr/bin/env bash
set -euo pipefail

# Refresh local machine access to Kalevea RDS Postgres.
# Usage:
#   bash scripts/refresh-rds-allowlist.sh
# Optional overrides:
#   RDS_SECURITY_GROUP_ID=sg-xxxx AWS_REGION=us-east-1 PORT=5432 bash scripts/refresh-rds-allowlist.sh

RDS_SECURITY_GROUP_ID="${RDS_SECURITY_GROUP_ID:-sg-05fcb4d14ecea8e85}"
AWS_REGION="${AWS_REGION:-us-east-1}"
PORT="${PORT:-5432}"
RULE_DESCRIPTION="${RULE_DESCRIPTION:-Kalevea local admin}"
RDS_HOST="${RDS_HOST:-kalevea-postgres.co3c0q28k1cx.us-east-1.rds.amazonaws.com}"

if ! command -v aws >/dev/null 2>&1; then
  echo "ERROR: aws CLI is required."
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl is required."
  exit 1
fi

echo "Checking AWS identity..."
aws sts get-caller-identity --region "${AWS_REGION}" >/dev/null

PUBLIC_IP="$(curl -s https://checkip.amazonaws.com | tr -d '[:space:]')"
if [[ -z "${PUBLIC_IP}" ]]; then
  echo "ERROR: could not determine public IP."
  exit 1
fi
CIDR="${PUBLIC_IP}/32"

echo "Current public IP: ${PUBLIC_IP}"
echo "Security group: ${RDS_SECURITY_GROUP_ID} (region ${AWS_REGION})"

EXISTING_CIDRS="$(
  aws ec2 describe-security-groups \
    --group-ids "${RDS_SECURITY_GROUP_ID}" \
    --region "${AWS_REGION}" \
    --query "SecurityGroups[0].IpPermissions[?FromPort==\`${PORT}\` && ToPort==\`${PORT}\`].IpRanges[].CidrIp" \
    --output text
)"
EXISTING_CIDRS_NORMALIZED="$(echo "${EXISTING_CIDRS}" | tr '\t' ' ' | tr '\n' ' ')"

if [[ " ${EXISTING_CIDRS_NORMALIZED} " == *" ${CIDR} "* ]]; then
  echo "Ingress already present for ${CIDR} on port ${PORT}."
else
  echo "Authorizing ingress ${CIDR}:${PORT}..."
  set +e
  AUTH_OUTPUT="$(
    aws ec2 authorize-security-group-ingress \
    --group-id "${RDS_SECURITY_GROUP_ID}" \
    --region "${AWS_REGION}" \
    --ip-permissions "[{\"IpProtocol\":\"tcp\",\"FromPort\":${PORT},\"ToPort\":${PORT},\"IpRanges\":[{\"CidrIp\":\"${CIDR}\",\"Description\":\"${RULE_DESCRIPTION}\"}]}]" \
      2>&1
  )"
  AUTH_EXIT=$?
  set -e
  if [[ ${AUTH_EXIT} -eq 0 ]]; then
    echo "Ingress added for ${CIDR}."
  elif [[ "${AUTH_OUTPUT}" == *"InvalidPermission.Duplicate"* ]]; then
    echo "Ingress already present for ${CIDR} on port ${PORT}."
  else
    echo "ERROR: failed to authorize ingress."
    echo "${AUTH_OUTPUT}"
    exit ${AUTH_EXIT}
  fi
fi

echo "Testing TCP connectivity to ${RDS_HOST}:${PORT}..."
python3 - <<PY
import socket
host="${RDS_HOST}"
port=${PORT}
s=socket.socket()
s.settimeout(5)
try:
    s.connect((host, port))
    print("TCP connectivity OK")
except Exception as e:
    print(f"TCP connectivity FAILED: {type(e).__name__}: {e}")
    raise SystemExit(1)
finally:
    s.close()
PY

echo "Done. You can now run: npx prisma db push"
