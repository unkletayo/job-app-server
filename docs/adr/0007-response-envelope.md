# API-wide response envelope (Monnify-style)

Every API response — success or error — is wrapped in a fixed envelope: `{ requestSuccessful, responseMessage, responseCode, responseBody }`. A `ResponseEnvelopeInterceptor` wraps successful controller returns; a `ResponseEnvelopeFilter` (`@Catch()`, catches everything) wraps thrown exceptions into the same shape.

`responseCode` is a defined business vocabulary (`src/common/response-code.ts`'s `ResponseCode` enum: `SUCCESS`, `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR`), resolved from the exception type — never the raw HTTP status number reused as the code. A future change to which HTTP status an error maps to (e.g. deciding a not-found case should return 400 instead of 404) doesn't change its `responseCode`, and a client branching on `responseCode` doesn't break if that status changes.

This is the user's explicit convention (matching Monnify/Moniepoint's payment-API response shape), applied from the start rather than adopted mid-project — retrofitting every controller and every existing frontend/test call site later would be far more disruptive than starting with it.

Both `main.ts` and the e2e test bootstrap call the same `configureApp()` helper so the pipe/interceptor/filter wiring can't drift apart between production and tests.
