const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const auth = require('../middleware/auth');
const Report = require('../models/Report');
const Machine = require('../models/Machine');
const ActivityLog = require('../models/ActivityLog');
const { errorHandler } = require('../middleware/errorHandler');

test('report routes download PDFs and enforce employee record ownership', async (t) => {
  t.mock.method(auth, 'protect', (req, res, next) => {
    req.user = { _id: 'employee-user', role: 'employee' }; next();
  });
  let capturedQuery;
  let removed = false;
  t.mock.method(Report, 'findOne', (query) => {
    capturedQuery = query;
    const record = query._id === 'owned' ? {
      _id: 'owned', machine: { machineName: 'Loom', machineNumber: '1' },
      dateRangeStart: new Date('2026-09-01'), dateRangeEnd: new Date('2026-10-01'),
      historySnapshot: { maintenance: [], jobs: [], oilChanges: [], spareParts: [] },
      deleteOne: async () => { removed = true; },
    } : null;
    return { populate: async () => record, then: (resolve) => Promise.resolve(record).then(resolve) };
  });
  const app = express();
  app.use(express.json());
  app.use('/api/reports', require('../routes/reportRoutes'));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.on('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/reports`;
  const download = await fetch(`${base}/owned/download`);
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-type'), /application\/pdf/);
  assert.match(await download.text(), /^%PDF-/);
  assert.deepEqual(capturedQuery, { _id: 'owned', generatedBy: 'employee-user' });
  const forbidden = await fetch(`${base}/other/download`);
  assert.equal(forbidden.status, 404);
  const removal = await fetch(`${base}/owned`, { method: 'DELETE' });
  assert.equal(removal.status, 200);
  assert.equal(removed, true);
});

test('only admins can edit machines, including machines in an owner company', async (t) => {
  const { updateMachine } = require('../controllers/machineController');
  let saves = 0;
  let lookups = 0;
  const machine = { _id: 'machine', company: 'Mill A', machineName: 'Old',
    save: async () => { saves++; } };
  t.mock.method(Machine, 'findOne', async () => { lookups++; return machine; });
  t.mock.method(ActivityLog, 'create', async () => {});
  for (const role of ['owner', 'general_manager', 'employee']) {
    const res = { code: 200, status(code) { this.code = code; return this; } };
    let error;
    await updateMachine({ params: { id: 'machine' },
      user: { role, companyName: 'Mill A' }, body: { machineName: 'Changed' } },
      res, (e) => { error = e; });
    assert.equal(res.code, 403);
    assert.match(error.message, /Only admin/);
  }
  assert.equal(lookups, 0);
  assert.equal(saves, 0);
  assert.equal(machine.machineName, 'Old');
  const res = { json(data) { this.body = data; } };
  await updateMachine({ params: { id: 'machine' }, user: { role: 'admin' },
    body: { machineName: 'Updated' } }, res, (e) => { throw e; });
  assert.equal(saves, 1);
  assert.equal(machine.machineName, 'Updated');
  assert.equal(res.body.success, true);
});

test('machine lists apply assetType and search by equipment ID', async (t) => {
  const { getMachines } = require('../controllers/machineController');
  let query;
  const chain = { populate() { return this; }, sort() { return this; }, skip() { return this; }, limit: async () => [] };
  t.mock.method(Machine, 'find', (q) => { query = q; return chain; });
  t.mock.method(Machine, 'countDocuments', async () => 0);
  const res = { json() {} };
  await getMachines({ query:{assetType:'Compressor',search:'COMP-001'},user:{role:'admin'} }, res, (e) => { throw e; });
  assert.equal(query.assetType, 'Compressor');
  assert.ok(query.$or.some((filter) => filter.machineId));
});
