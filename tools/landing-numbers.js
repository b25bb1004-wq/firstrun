#!/usr/bin/env node
// tools/landing-numbers.js — Computes every number on the landing page from data files

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const audit = readJSON(path.join(__dirname, '..', 'audit', 'real-16-v2', 'audit.json'));
const acmeRun = readJSON(path.join(__dirname, '..', 'web', 'public', 'data', 'runs', 'acme-shop-3c0bc2b2', 'f', 'run.json'));

// Audit summary
const total = audit.summary.total; // 16
const noSetupDocs = audit.repos.filter(r => r.verdict === 'NO-SETUP-DOCS').length; // 2
const followable = total - noSetupDocs; // 14
const brokeOnCleanMachine = audit.summary.brokeOnCleanMachine; // 9
const breaksFound = audit.summary.breaksFound; // 22
const breaksFixed = audit.summary.breaksFixed; // 11
const verified = audit.summary.verified; // 6
const partial = audit.summary.partial; // 4
const failed = audit.summary.failed; // 4

// GeekyAnts (express-typescript) from audit
const geeky = audit.repos.find(r => r.slug === 'GeekyAnts__express-typescript');
const geekyBreaksFound = geeky.passport.breaksFound; // 4
const geekyBreaksFixed = geeky.passport.breaksFixed; // 1
const geekyReplaySeconds = geeky.passport.replaySeconds; // 69

// acme-shop from its run folder
const acmeBreaksFound = acmeRun.passport.breaksFound; // 5
const acmeBreaksFixed = acmeRun.passport.breaksFixed; // 5
const acmeReplaySeconds = acmeRun.passport.replaySeconds; // 14
const acmeBobcoins = acmeRun.passport.bobcoins; // 0
const acmeStepsTotal = acmeRun.passport.stepsTotal; // 7
const acmeStepsFromReadme = acmeRun.passport.stepsFromReadme; // 7

console.log('=== LANDING PAGE NUMBERS: DATA SOURCE VERIFICATION ===\n');
console.log('| Claim on page | Value on page | Value from data | Source file |');
console.log('|---|---|---|---|');
console.log(`| Total public repos audited | 16 | ${total} | audit/real-16-v2/audit.json summary.total |`);
console.log(`| Repos with setup docs (followable) | 14 | ${followable} | audit.json (total - NO-SETUP-DOCS) |`);
console.log(`| READMEs with setup docs that broke | 9 of 14 | ${brokeOnCleanMachine} of ${followable} | audit.json summary.brokeOnCleanMachine |`);
console.log(`| Total breaks found across audit | 22 | ${breaksFound} | audit.json summary.breaksFound |`);
console.log(`| Total breaks fixed across audit | 11 | ${breaksFixed} | audit.json summary.breaksFixed |`);
console.log(`| Hero stat: "11 breaks fixed and proven from zero" | 11 | ${breaksFixed} | audit.json summary.breaksFixed |`);
console.log(`| Audit card alt text: "9 of 16 READMEs broke" | 9 of 16 | ${brokeOnCleanMachine} of ${followable} | audit.json summary |`);
console.log(`| Audit card alt text: "22 breaks found, 11 fixed" | 22 found, 11 fixed | ${breaksFound} found, ${breaksFixed} fixed | audit.json summary |`);
console.log(`| GeekyAnts diff slider: "4/4 breaks fixed" | 4/4 | ${geekyBreaksFixed}/${geekyBreaksFound} | audit.json GeekyAnts passport |`);
console.log(`| GeekyAnts diff slider: "53s replay" | 53s | ${geekyReplaySeconds}s | audit.json GeekyAnts passport.replaySeconds |`);
console.log(`| GeekyAnts "AS WRITTEN" meta: "4 breaks on clean machine" | 4 | ${geekyBreaksFound} | audit.json GeekyAnts passport.breaksFound |`);
console.log(`| GeekyAnts proof card: "53s" big number | 53s | ${geekyReplaySeconds}s | audit.json GeekyAnts passport.replaySeconds |`);
console.log(`| GeekyAnts proof card: "4 breaks found, 4 fixed, replayed from zero in 53 seconds" | 4 found, 4 fixed, 53s | ${geekyBreaksFound} found, ${geekyBreaksFixed} fixed, ${geekyReplaySeconds}s | audit.json GeekyAnts passport |`);
console.log(`| acme-shop scrub section: "acme-shop: five breaks, all fixed" | 5/5 | ${acmeBreaksFixed}/${acmeBreaksFound} | web/public/data/runs/acme-shop-3c0bc2b2/f/run.json passport |`);
console.log(`| acme-shop passport breaksFound | 5 | ${acmeBreaksFound} | run.json passport.breaksFound |`);
console.log(`| acme-shop passport breaksFixed | 5 | ${acmeBreaksFixed} | run.json passport.breaksFixed |`);
console.log(`| acme-shop passport replaySeconds | (not on page) | ${acmeReplaySeconds}s | run.json passport.replaySeconds |`);
console.log(`| acme-shop passport bobcoins | (not on page) | ${acmeBobcoins} | run.json passport.bobcoins |`);
console.log(`| acme-shop passport stepsTotal | (not on page) | ${acmeStepsTotal} | run.json passport.stepsTotal |`);
console.log(`| acme-shop passport stepsFromReadme | (not on page) | ${acmeStepsFromReadme} | run.json passport.stepsFromReadme |`);
console.log(`| Verified repos in audit | 6 | ${verified} | audit.json summary.verified |`);
console.log(`| Partial repos in audit | 4 | ${partial} | audit.json summary.partial |`);
console.log(`| Failed repos in audit | 4 | ${failed} | audit.json summary.failed |`);
console.log(`| NO-SETUP-DOCS repos in audit | 2 | ${noSetupDocs} | audit.json (count of NO-SETUP-DOCS) |`);

console.log('\n=== UNVERIFIED CLAIMS (no data file backing) ===');
console.log('| Claim | Context |');
console.log('|---|---|');
console.log('| 72% Cortex statistic | External citation, no data file in repo |');
console.log('| "Six specialized agents · orchestrated by IBM Bob" | Architectural claim, not a measured number |');
console.log('| "LIVE 3D ORBS" | UI label, not a measured number |');