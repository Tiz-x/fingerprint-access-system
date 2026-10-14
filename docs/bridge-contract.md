# Scanner Bridge Contract

The bridge is a small local C# app that wraps the DigitalPersona SDK.
It runs on http://127.0.0.1:8765 and is called ONLY by the Node API.
It is never exposed to the browser or the internet.

Every request must include header: X-Bridge-Secret: <shared secret>
Every response is JSON.

## POST /capture
Captures one fingerprint scan and returns a template.

Request:  {} (empty body)
Response (success):
{
  "ok": true,
  "fmd": "<base64 string>",
  "quality": 85
}
Response (failure):
{
  "ok": false,
  "error": "NO_FINGER" | "POOR_QUALITY" | "DEVICE_NOT_FOUND" | "TIMEOUT"
}

## POST /enroll
Captures multiple scans of the same finger and merges them into one template.

Request:
{
  "scans": 4
}
Response (success):
{
  "ok": true,
  "fmd": "<base64 string>",
  "scansUsed": 4
}
Response (failure):
{
  "ok": false,
  "error": "POOR_QUALITY" | "SCANS_MISMATCH" | "DEVICE_NOT_FOUND"
}

## POST /identify
Compares one probe template against a list of candidate templates.

Request:
{
  "probe": "<base64 string>",
  "candidates": [
    { "userId": "u1", "fmd": "<base64 string>" },
    { "userId": "u2", "fmd": "<base64 string>" }
  ]
}
Response (success):
{
  "ok": true,
  "match": {
    "userId": "u1",
    "score": 1200
  }
}
If nothing is close enough:
{
  "ok": true,
  "match": null
}
Response (failure):
{
  "ok": false,
  "error": "INVALID_FMD" | "DEVICE_NOT_FOUND"
}

## GET /health
Returns whether the scanner is connected.
Response:
{
  "ok": true,
  "deviceConnected": true,
  "sdkVersion": "2.2.3"
}

## Important notes
- The score is a DISSIMILARITY value. LOWER means a BETTER match.
- The threshold is decided by the Node API, not the bridge.
- The bridge stores nothing. It only captures and compares.
- Only one program can use the scanner at a time.