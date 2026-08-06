#!/usr/bin/env node
// Generates a bcrypt hash of an admin passcode for ADMIN_PASSCODE_HASH in .env.
// The raw passcode is never stored anywhere — only this hash. Run it, paste the
// output into .env, and don't leave the passcode sitting in shell history either
// (most shells skip history for a line that starts with a leading space).
//
// Usage:
//   node scripts/hash-admin-passcode.js "your-new-passcode"
//
// If you don't pass an argument, it prompts interactively instead (safer — never
// lands in shell history at all).
const bcrypt = require('bcryptjs');
const readline = require('readline');

async function main() {
    let passcode = process.argv[2];

    if (!passcode) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        passcode = await new Promise(resolve => rl.question('Admin passcode to hash: ', answer => {
            rl.close();
            resolve(answer);
        }));
    }

    if (!passcode || passcode.length < 4) {
        console.error('Passcode must be at least 4 characters.');
        process.exit(1);
    }

    const hash = await bcrypt.hash(passcode, 12);
    console.log('\nADMIN_PASSCODE_HASH=' + hash + '\n');
    console.log('Paste the line above into vse-backend/.env — do not commit it, and do not keep the raw passcode anywhere else.');
}

main();
