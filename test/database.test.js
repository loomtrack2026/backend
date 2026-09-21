const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const requireDatabase = require("../middleware/database");

test("database readiness, shared connection attempts, failure and retry", async (t) => {
  const originalUri = process.env.MONGO_URI;
  const originalConnect = mongoose.connect;
  t.after(() => {
    mongoose.connect = originalConnect;
    if (originalUri === undefined) delete process.env.MONGO_URI;
    else process.env.MONGO_URI = originalUri;
  });

  delete process.env.MONGO_URI;
  assert.equal(await connectDB(), false);
  process.env.MONGO_URI = "mongodb://test.invalid/test";

  let calls = 0;
  let resolveConnection;
  mongoose.connect = () => {
    calls++;
    return new Promise((resolve) => { resolveConnection = resolve; });
  };
  let nextCalled = false;
  const request = requireDatabase({}, {}, () => { nextCalled = true; });
  const concurrent = connectDB();
  assert.equal(nextCalled, false);
  assert.equal(calls, 1);
  resolveConnection();
  await request;
  assert.equal(await concurrent, true);
  assert.equal(nextCalled, true);

  mongoose.connect = async () => { throw new Error("unreachable"); };
  let status;
  let body;
  await requireDatabase({}, {
    status(value) { status = value; return this; },
    json(value) { body = value; },
  }, () => assert.fail("must not query a disconnected database"));
  assert.equal(status, 503);
  assert.equal(body.success, false);
  assert.match(body.message, /temporarily unavailable/);

  mongoose.connect = async () => {};
  assert.equal(await connectDB(), true, "a failed connection can be retried");
});
