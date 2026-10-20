#!/usr/bin/env node
import { randomBytes } from "node:crypto";

const secret = randomBytes(48).toString("base64");
console.log("\nAdd this to .env.local as AUTH_SECRET:\n");
console.log(secret);
console.log();
