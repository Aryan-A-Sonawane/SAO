"""
Sanity check: hit Claude Sonnet 4.5 and Claude Opus 4.1 on AWS Bedrock
via the cross-region APAC inference profile, using the Bedrock API key
(bearer token) and the Sydney region.

Run from backend_final/ with your venv active:
    python test_bedrock_claude.py

Prereq: pip install -U boto3
(must be a recent enough boto3 to honor AWS_BEARER_TOKEN_BEDROCK)
"""
import json
import os
import sys

# Set creds + region for this process (so you don't have to set env vars
# in your shell first).
os.environ["AWS_BEARER_TOKEN_BEDROCK"] = (
    "ABSKQmVkcm9ja0FQSUtleS1kbDN0LWF0LTEzMjIwNTc3NjUxNzpyQWNaRWFlQS85MDF4"
    "VFM1Q3hlR3lTbDJidVRWQzFsbUtNdmFRdmpTUWlPYWptamZjWnRFTXVES0hJbz0="
)
os.environ["AWS_DEFAULT_REGION"] = "ap-southeast-2"

try:
    import boto3
    from botocore.exceptions import ClientError, BotoCoreError
except ImportError:
    print("boto3 is not installed. Run: pip install -U boto3")
    sys.exit(2)

# Cross-region APAC inference profile IDs — these auto-route across
# Sydney/Tokyo/Mumbai/Singapore for capacity.
# Sonnet 4 confirmed available in ap-southeast-2 (May 2025 version).
# Opus: trying both 4.1 and 4 — whichever your account has access to will
# return OK; the other will return ValidationException, which is fine.
MODELS = {
    "Sonnet 4":         "apac.anthropic.claude-sonnet-4-20250514-v1:0",
    "Opus 4.1 (try)":   "apac.anthropic.claude-opus-4-1-20250805-v1:0",
    "Opus 4 (try)":     "apac.anthropic.claude-opus-4-20250514-v1:0",
}

PROMPT = "Reply with just the two characters: OK"


def test_model(label: str, model_id: str) -> bool:
    print(f"\n[{label}] model_id = {model_id}")
    client = boto3.client("bedrock-runtime", region_name="ap-southeast-2")

    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 16,
        "messages": [{"role": "user", "content": PROMPT}],
    }

    try:
        resp = client.invoke_model(
            modelId=model_id,
            body=json.dumps(body),
            contentType="application/json",
            accept="application/json",
        )
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        msg = e.response.get("Error", {}).get("Message", str(e))
        print(f"  FAILED  [{code}] {msg}")
        if code == "AccessDeniedException":
            print("  -> Likely: use-case details not submitted yet for this")
            print("     model, OR the API key doesn't have bedrock:InvokeModel.")
            print("     Open the model in Bedrock Playground first.")
        elif code == "ValidationException" and "inference profile" in msg.lower():
            print("  -> The inference profile ID may not exist in this region.")
            print("     Check the Bedrock console -> Cross-region inference.")
        return False
    except BotoCoreError as e:
        print(f"  NETWORK/AUTH ERROR: {e}")
        return False

    payload = json.loads(resp["body"].read())
    try:
        reply = payload["content"][0]["text"].strip()
    except Exception:
        reply = json.dumps(payload)[:200]
    print(f"  OK  -> model said: {reply!r}")
    return True


def main() -> int:
    print("Testing AWS Bedrock (region=ap-southeast-2) with bearer token...")
    results = {label: test_model(label, mid) for label, mid in MODELS.items()}
    print("\n--- Summary ---")
    for label, ok in results.items():
        print(f"  {label}: {'WORKING' if ok else 'FAILED'}")
    return 0 if all(results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
