const DEFAULT_LOG_API_URL = "https://log-api.newrelic.com/log/v1";

async function sendLog(attributes) {
  const licenseKey = process.env.NEW_RELIC_LICENSE_KEY;
  if (!licenseKey) return;

  try {
    const response = await fetch(
      process.env.NEW_RELIC_LOG_API_URL || DEFAULT_LOG_API_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": licenseKey,
        },
        body: JSON.stringify({
          ...attributes,
          timestamp: Date.now(),
          message: "Status endpoint responded",
          level: "INFO",
          "service.name": process.env.NEW_RELIC_APP_NAME || "api",
        }),
        signal: AbortSignal.timeout(3000),
      },
    );

    // Consume the response so the HTTP connection can be reused.
    await response.arrayBuffer();
    if (!response.ok) {
      console.warn(`New Relic log delivery failed (HTTP ${response.status})`);
    }
  } catch {
    // Do not expose credentials or let telemetry affect the status endpoint.
    console.warn("New Relic log delivery failed (network error or timeout)");
  }
}

module.exports = { sendLog };
