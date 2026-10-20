#!/usr/bin/env node
import bcrypt from "bcryptjs";
import readline from "node:readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter the household password: ", async (password) => {
  const trimmed = password.trim();
  if (!trimmed) {
    console.error("Empty password, aborting.");
    rl.close();
    process.exit(1);
  }
  const hash = await bcrypt.hash(trimmed, 12);
  // Each $ must be escaped as \$ in .env.local to avoid Next.js
  // variable-expansion treating $2b, $12, etc. as references.
  const escaped = hash.replaceAll("$", "\\$");
  console.log("\nAdd this line to .env.local (the backslashes are required):\n");
  console.log(`APP_PASSWORD_HASH=${escaped}`);
  console.log("\nFor Vercel env vars, paste the UNESCAPED hash instead:\n");
  console.log(hash);
  console.log();
  rl.close();
});
