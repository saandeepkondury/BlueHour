#!/usr/bin/env node
import webpush from "web-push";

// Prints a pair of VAPID keys to paste into .env.local and Vercel.
const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log(`
Add these to .env.local (and to Vercel's environment variables):

NEXT_PUBLIC_VAPID_PUBLIC_KEY="${publicKey}"
VAPID_PRIVATE_KEY="${privateKey}"
VAPID_SUBJECT="mailto:sandeepkondury@gmail.com"
`);
