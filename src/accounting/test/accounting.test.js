const assert = require('node:assert/strict');
const { Readable, Writable } = require('node:stream');
const test = require('node:test');
const { formatBalance, parseAmount, runAccountingApp } = require('../index');

async function runWithInput(input) {
  let output = '';
  const writable = new Writable({
    write(chunk, encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });
  await runAccountingApp({ input: Readable.from([input]), output: writable });
  return output;
}

function countOccurrences(text, expression) {
  return (text.match(expression) ?? []).length;
}

test('TC-001: initializes a new balance and returns to the menu after viewing', async () => {
  const output = await runWithInput('1\n4\n');
  assert.match(output, /Current balance: 1000\.00/);
  assert.equal(countOccurrences(output, /Account Management System/g), 2);
});

test('TC-002: viewing the balance twice does not change it', async () => {
  const output = await runWithInput('1\n1\n4\n');
  assert.equal(countOccurrences(output, /Current balance: 1000\.00/g), 2);
});

test('TC-003: credits one cent and shows the updated balance on the next view', async () => {
  const output = await runWithInput('2\n0.01\n1\n4\n');
  assert.match(output, /Amount credited\. New balance: 1000\.01/);
  assert.match(output, /Current balance: 1000\.01/);
});

test('TC-004: credits a whole-dollar amount', async () => {
  const output = await runWithInput('2\n250.00\n1\n4\n');
  assert.match(output, /Amount credited\. New balance: 1250\.00/);
  assert.match(output, /Current balance: 1250\.00/);
});

test('TC-005: accumulates multiple credits using the latest balance', async () => {
  const output = await runWithInput('2\n10.25\n2\n4.75\n1\n4\n');
  assert.match(output, /Amount credited\. New balance: 1010\.25/);
  assert.match(output, /Amount credited\. New balance: 1015\.00/);
  assert.match(output, /Current balance: 1015\.00/);
});

test('TC-006: debits one cent', async () => {
  const output = await runWithInput('3\n0.01\n1\n4\n');
  assert.match(output, /Amount debited\. New balance: 999\.99/);
  assert.match(output, /Current balance: 999\.99/);
});

test('TC-007: debits an amount less than the available balance', async () => {
  const output = await runWithInput('3\n250.00\n1\n4\n');
  assert.match(output, /Amount debited\. New balance: 750\.00/);
  assert.match(output, /Current balance: 750\.00/);
});

test('TC-008: allows debiting the exact available balance', async () => {
  const output = await runWithInput('3\n1000.00\n1\n4\n');
  assert.match(output, /Amount debited\. New balance: 0\.00/);
  assert.match(output, /Current balance: 0\.00/);
});

test('TC-009: rejects a debit greater than the balance without changing it', async () => {
  const output = await runWithInput('3\n1000.01\n1\n4\n');
  assert.match(output, /Insufficient funds for this debit\./);
  assert.match(output, /Current balance: 1000\.00/);
});

test('TC-010: accepts a zero debit without changing the balance', async () => {
  const output = await runWithInput('3\n0.00\n1\n4\n');
  assert.match(output, /Amount debited\. New balance: 1000\.00/);
  assert.match(output, /Current balance: 1000\.00/);
});

test('TC-011: accepts a zero credit without changing the balance', async () => {
  const output = await runWithInput('2\n0.00\n1\n4\n');
  assert.match(output, /Amount credited\. New balance: 1000\.00/);
  assert.match(output, /Current balance: 1000\.00/);
});

test('TC-012: rejects unsupported numeric choices and continues to the menu', async () => {
  const output = await runWithInput('5\n0\n1\n4\n');
  assert.equal(countOccurrences(output, /Invalid choice, please select 1-4\./g), 2);
  assert.match(output, /Current balance: 1000\.00/);
  assert.equal(countOccurrences(output, /Account Management System/g), 4);
});

test('TC-013: exits the menu loop and displays the goodbye message', async () => {
  const output = await runWithInput('4\n');
  assert.match(output, /Exiting the program\. Goodbye!/);
  assert.equal(countOccurrences(output, /Account Management System/g), 1);
});

test('TC-014: starts each run with a fresh in-memory balance', async () => {
  const firstRun = await runWithInput('2\n1.00\n4\n');
  const secondRun = await runWithInput('1\n4\n');
  assert.match(firstRun, /Amount credited\. New balance: 1001\.00/);
  assert.match(secondRun, /Current balance: 1000\.00/);
});

test('TC-015: accepts a credit that brings the balance to the maximum capacity', async () => {
  const output = await runWithInput('2\n998999.99\n1\n4\n');
  assert.match(output, /Amount credited\. New balance: 999999\.99/);
  assert.match(output, /Current balance: 999999\.99/);
  assert.equal(formatBalance(99_999_999), '999999.99');
});

test('TC-016: rejects a credit that would exceed maximum balance without changing it', async () => {
  const output = await runWithInput('2\n999000.00\n1\n4\n');
  assert.match(output, /Credit would exceed the maximum balance of 999999\.99\./);
  assert.match(output, /Current balance: 1000\.00/);
});

test('TC-017: rejects an amount with more than two fractional digits without changing balance', async () => {
  const output = await runWithInput('2\n1.239\n1\n4\n');
  assert.match(output, /Invalid amount\./);
  assert.match(output, /Current balance: 1000\.00/);
  assert.equal(parseAmount('1.239'), null);
});

test('TC-018: rejects malformed and out-of-range amounts without changing balance', async () => {
  const malformedOutput = await runWithInput('2\nnot-a-number\n1\n4\n');
  const outOfRangeOutput = await runWithInput('2\n1000000.00\n1\n4\n');
  assert.match(malformedOutput, /Invalid amount\./);
  assert.match(malformedOutput, /Current balance: 1000\.00/);
  assert.match(outOfRangeOutput, /Invalid amount\./);
  assert.match(outOfRangeOutput, /Current balance: 1000\.00/);
});

test('TC-019: rejects nonnumeric menu input and allows the user to continue', async () => {
  const output = await runWithInput('letters\n1\n4\n');
  assert.match(output, /Invalid choice, please select 1-4\./);
  assert.match(output, /Current balance: 1000\.00/);
  assert.equal(countOccurrences(output, /Account Management System/g), 3);
});

test('TC-020: a rejected debit leaves the balance available for a later credit', async () => {
  const output = await runWithInput('3\n1000.01\n2\n10.00\n1\n4\n');
  assert.match(output, /Insufficient funds for this debit\./);
  assert.match(output, /Amount credited\. New balance: 1010\.00/);
  assert.match(output, /Current balance: 1010\.00/);
});
