// backend/loadtest.cjs
const autocannon = require("autocannon");

console.log("Starting Load Test on UniMessenger Auth Module...");

const instance = autocannon(
  {
    url: "http://localhost:7007/api/auth/login",
    connections: 50,
    duration: 10,
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: "test_load@example.com",
      password: "Password123!",
    }),
  },
  finishedBench
);

autocannon.track(instance, { renderProgressBar: true });

function finishedBench(err, res) {
  console.log("Load Test Finished!");
  console.log("-----------------------");
  console.log(`Duration: ${res.duration}s`);
  console.log(`Requests/Sec (Avg): ${res.requests.average}`);
  console.log(`Latency (Avg): ${res.latency.average} ms`);
  console.log(`Total Requests: ${res.requests.total}`);
  console.log("-----------------------");
}
