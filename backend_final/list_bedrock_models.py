"""
Discovery: list every Anthropic foundation model AND every inference profile
available to this AWS account in ap-southeast-2 (Sydney). Output tells us
exactly which model IDs we can call from boto3.

Run from backend_final/:
    python list_bedrock_models.py
"""
import os
import sys

os.environ["AWS_BEARER_TOKEN_BEDROCK"] = (
    "ABSKQmVkcm9ja0FQSUtleS1kbDN0LWF0LTEzMjIwNTc3NjUxNzpyQWNaRWFlQS85MDF4"
    "VFM1Q3hlR3lTbDJidVRWQzFsbUtNdmFRdmpTUWlPYWptamZjWnRFTXVES0hJbz0="
)
os.environ["AWS_DEFAULT_REGION"] = "ap-southeast-2"

try:
    import boto3
    from botocore.exceptions import ClientError
except ImportError:
    print("boto3 is not installed. Run: pip install -U boto3")
    sys.exit(2)


def list_foundation_models():
    print("=" * 70)
    print("FOUNDATION MODELS (Anthropic) available in ap-southeast-2")
    print("=" * 70)
    client = boto3.client("bedrock", region_name="ap-southeast-2")
    try:
        resp = client.list_foundation_models(byProvider="anthropic")
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        msg = e.response.get("Error", {}).get("Message", str(e))
        print(f"  ClientError [{code}]: {msg}")
        return

    models = resp.get("modelSummaries", [])
    if not models:
        print("  (none returned)")
        return

    for m in models:
        mid = m.get("modelId", "?")
        name = m.get("modelName", "?")
        lifecycle = m.get("modelLifecycle", {}).get("status", "?")
        in_modes = m.get("inferenceTypesSupported", [])
        print(f"  - {mid}")
        print(f"      name={name}  lifecycle={lifecycle}  inference={in_modes}")


def list_inference_profiles():
    print("\n" + "=" * 70)
    print("INFERENCE PROFILES available in ap-southeast-2")
    print("=" * 70)
    client = boto3.client("bedrock", region_name="ap-southeast-2")
    try:
        resp = client.list_inference_profiles()
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        msg = e.response.get("Error", {}).get("Message", str(e))
        print(f"  ClientError [{code}]: {msg}")
        return

    profiles = resp.get("inferenceProfileSummaries", [])
    if not profiles:
        print("  (none returned)")
        return

    for p in profiles:
        # Skip non-Anthropic noise
        name = p.get("inferenceProfileName", "")
        pid = p.get("inferenceProfileId", "")
        if "anthropic" not in (name + pid).lower() and "claude" not in (name + pid).lower():
            continue
        status = p.get("status", "?")
        ptype = p.get("type", "?")
        print(f"  - {pid}")
        print(f"      name={name}  status={status}  type={ptype}")


def main() -> int:
    list_foundation_models()
    list_inference_profiles()
    print("\nDone. Paste the full output back so we can pick the right model IDs.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
