# Project API contract

## Shared HTTP response format

All JSON HTTP endpoints use the following envelopes. Controllers return domain
data without wrapping it; a global Nest interceptor wraps successful responses.
A global exception filter formats errors. HTTP status codes remain meaningful
(200/201 success, 400 validation, 401 unauthenticated, 403 forbidden, 404 missing,
409 conflict, 500 unexpected failure, 503 temporary dependency outage).

### Success

```json
{ "success": true, "data": { "accessToken": "...", "user": {} } }
```

An undefined result becomes `data: null`. HEAD/204/304 responses have no body.
Cookies and HTTP headers are not moved into the JSON body. Streams, downloads,
and handlers writing their own response must not be wrapped as JSON.

### Error

```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Kết nối dịch vụ tạm thời gián đoạn. Vui lòng thử lại sau.",
    "details": null
  }
}
```

Codes are stable identifiers: `BAD_REQUEST`, `VALIDATION_ERROR`, `UNAUTHORIZED`,
`FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `TOO_MANY_REQUESTS`, `INTERNAL_SERVER_ERROR`,
`SERVICE_UNAVAILABLE`; other statuses use `HTTP_ERROR`. Do not expose SQL,
request parameters, stack traces, credentials, or provider responses.

### Validation

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ.",
    "details": [{ "field": "email", "message": "Email không hợp lệ." }]
  }
}
```

Nested fields use dot-separated paths. Only field names and validation messages
are returned; never the submitted values or validation targets.

## Frontend integration

`orange-social-ui/src/lib/api-client.ts` unwraps `data` centrally. Feature API
functions continue returning domain types. Failed requests throw `ApiError` with
HTTP `status`, machine-readable `code`, validation `details`, and display
`message`. Update the BE and UI together: this changes the previous raw-response
contract. Responses without the envelope are rejected rather than accepted as
authenticated session data.

## Logging and temporary outages

Log method, path (without query), status, and duration. Error logs must not dump
raw database/provider errors. Connection failures return 503 with `Retry-After`.
An auth refresh outage must not invalidate cookies or discard a valid client
session; only an authentication failure (401) does that.
