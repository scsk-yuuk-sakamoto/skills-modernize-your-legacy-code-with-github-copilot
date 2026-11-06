const readline = require('node:readline');

const INITIAL_BALANCE_CENTS = 100_000;
const MAX_AMOUNT_CENTS = 99_999_999;

function formatBalance(cents) {
  const dollars = Math.floor(cents / 100);
  const remainder = cents % 100;
  return `${dollars}.${String(remainder).padStart(2, '0')}`;
}

function parseAmount(input) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) {
    return null;
  }

  const whole = Number(match[1]);
  const fractional = Number((match[2] ?? '').padEnd(2, '0'));
  const cents = whole * 100 + fractional;
  return Number.isSafeInteger(cents) && cents <= MAX_AMOUNT_CENTS ? cents : null;
}

async function runAccountingApp({ input = process.stdin, output = process.stdout } = {}) {
  const terminal = readline.createInterface({ input, crlfDelay: Infinity });
  const lines = terminal[Symbol.asyncIterator]();
  let balance = INITIAL_BALANCE_CENTS;
  let shouldExit = false;

  async function prompt(message) {
    output.write(`${message}\n`);
    const result = await lines.next();
    return result.done ? null : result.value;
  }

  try {
    while (!shouldExit) {
      output.write('--------------------------------\n');
      output.write('Account Management System\n');
      output.write('1. View Balance\n');
      output.write('2. Credit Account\n');
      output.write('3. Debit Account\n');
      output.write('4. Exit\n');
      output.write('--------------------------------\n');

      const choice = await prompt('Enter your choice (1-4): ');
      if (choice === null) {
        break;
      }

      switch (choice.trim()) {
        case '1':
          output.write(`Current balance: ${formatBalance(balance)}\n`);
          break;
        case '2':
        case '3': {
          const isCredit = choice.trim() === '2';
          const amountInput = await prompt(`Enter ${isCredit ? 'credit' : 'debit'} amount: `);
          if (amountInput === null) {
            shouldExit = true;
            break;
          }

          const amount = parseAmount(amountInput);
          if (amount === null) {
            output.write('Invalid amount. Enter a non-negative amount with up to two decimal places (maximum 999999.99).\n');
            break;
          }

          if (isCredit) {
            if (balance + amount > MAX_AMOUNT_CENTS) {
              output.write('Credit would exceed the maximum balance of 999999.99.\n');
              break;
            }
            balance += amount;
            output.write(`Amount credited. New balance: ${formatBalance(balance)}\n`);
          } else if (balance >= amount) {
            balance -= amount;
            output.write(`Amount debited. New balance: ${formatBalance(balance)}\n`);
          } else {
            output.write('Insufficient funds for this debit.\n');
          }
          break;
        }
        case '4':
          shouldExit = true;
          break;
        default:
          output.write('Invalid choice, please select 1-4.\n');
      }
    }
  } finally {
    terminal.close();
  }

  output.write('Exiting the program. Goodbye!\n');
}

if (require.main === module) {
  runAccountingApp();
}

module.exports = { formatBalance, parseAmount, runAccountingApp };
