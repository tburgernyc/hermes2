An inline status / error message banner.

```jsx
<Alert>Invalid email or password.</Alert>
<Alert variant="success" role="status">Inquiry received — we'll follow up.</Alert>
<Alert variant="info" role="status">Sourcing is in progress.</Alert>
```

Variants: `error` (default, `role="alert"`), `success`, `info`. Pass `role="status"` for non-interrupting messages.
