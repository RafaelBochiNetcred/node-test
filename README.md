# Node API

Requires Node.js 22 or newer.

```sh
npm install
cp .env.example .env
npm start
```

Set `NEW_RELIC_LICENSE_KEY` to your New Relic ingest license key and
`NEW_RELIC_APP_NAME` to the service name. Existing environment variables take
precedence over `.env`.

Each `GET /api/status` sends a JSON log to the New Relic Log API after the
response finishes. The log includes the timestamp, service name, HTTP method,
route, response status code, and duration in milliseconds. Query strings and
request headers are not included.

Delivery is asynchronous, with a three-second timeout. Failures are reported
locally and do not change the endpoint response. Without a license key, remote
logging is disabled. Logs are sent once without retries; failed deliveries are
not persisted.

The default API endpoint is for US accounts. For EU accounts, set
`NEW_RELIC_LOG_API_URL=https://log-api.eu.newrelic.com/log/v1`.
See the [New Relic Log API documentation](https://docs.newrelic.com/docs/logs/log-api/introduction-log-api/).

After accessing `http://localhost:3000/api/status`, allow a few minutes for
ingestion and find the logs in New Relic with:

```sql
SELECT * FROM Log WHERE `service.name` = 'api' AND `http.route` = '/api/status' SINCE 30 minutes ago
```

Replace `api` with your configured `NEW_RELIC_APP_NAME`.

Run the tests with `npm test`. Tests mock remote delivery and do not send logs
to New Relic.
