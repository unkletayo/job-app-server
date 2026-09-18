# API-wide response envelope (Monnify-style)

Every API response — success or error — is wrapped in a fixed envelope: `{ requestSuccessful, responseMessage, responseCode, responseBody }`. A `ResponseEnvelopeInterceptor` wraps successful controller returns; a `ResponseEnvelopeFilter` (`@Catch()`, catches everything) wraps thrown exceptions into the same shape, translating the HTTP status into `responseCode` and the exception message into `responseMessage`.

This is the user's explicit convention (matching Monnify/Moniepoint's payment-API response shape), applied from the start rather than adopted mid-project — retrofitting every controller and every existing frontend/test call site later would be far more disruptive than starting with it.

Both `main.ts` and the e2e test bootstrap call the same `configureApp()` helper so the pipe/interceptor/filter wiring can't drift apart between production and tests.
