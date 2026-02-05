# Financial Tests - Pass/Fail Report Format

Generate a machine-readable pass/fail report using Jest's JSON reporter:

Run tests and output JSON:

```bash
cd backend
npx jest __tests__/financial.test.js --json --outputFile=financial-report.json --runInBand
```

Report fields (JSON):
- `numTotalTests` (int)
- `numPassedTests` (int)
- `numFailedTests` (int)
- `testResults` (array): each item contains:
  - `name` (string): test name
  - `status` ("passed" | "failed")
  - `failureMessages` (array)
  - `duration` (ms)

Example (abridged):

```json
{
  "numTotalTests": 4,
  "numPassedTests": 4,
  "numFailedTests": 0,
  "testResults": [
    { "name": "Ledger entries are immutable (cannot update or delete)", "status": "passed", "failureMessages": [] },
    { "name": "Balance equals sum of ledger entries", "status": "passed", "failureMessages": [] }
  ]
}
```

If you prefer a concise console report, use `jq` to extract summary:

```bash
cat financial-report.json | jq '{total: .numTotalTests, passed: .numPassedTests, failed: .numFailedTests}'
```
