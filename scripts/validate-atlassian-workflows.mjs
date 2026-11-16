#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowsPath = path.join(root, "config/atlassian/enterprise-workflows.json");
const automationsPath = path.join(root, "config/atlassian/automation-blueprints.json");

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (error) { fail(`Cannot parse ${path.relative(root, file)}: ${error.message}`); return null; }
}
const config = readJson(workflowsPath);
const automations = readJson(automationsPath);

if (config) {
  if (config.status !== "DESIGN_ONLY_REQUIRES_ADMIN_REVIEW") fail("Workflow config must remain design-only until approved.");
  if (config.defaults?.automationEnabled !== false) fail("Automation must default to disabled.");
  if (config.defaults?.externalWritesEnabled !== false) fail("External writes must default to disabled.");
  if (config.defaults?.denyByDefault !== true) fail("Policy must deny by default.");
  if (!Array.isArray(config.workflows) || config.workflows.length < 1) fail("At least one workflow is required.");

  const ids = new Set();
  for (const workflow of config.workflows ?? []) {
    if (!workflow.id || ids.has(workflow.id)) fail(`Missing or duplicate workflow ID: ${workflow.id}`);
    ids.add(workflow.id);
    const states = new Set(workflow.states ?? []);
    if (states.size !== (workflow.states ?? []).length || states.size < 2) fail(`${workflow.id}: states must be unique and contain at least two values.`);
    if (!["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(workflow.risk)) fail(`${workflow.id}: invalid risk tier.`);
    for (const transition of workflow.transitions ?? []) {
      if (!Array.isArray(transition) || transition.length !== 2 || !states.has(transition[0]) || !states.has(transition[1])) {
        fail(`${workflow.id}: transition references an unknown state.`);
      }
    }
    for (const gate of workflow.gates ?? []) {
      if (!states.has(gate.from) || !states.has(gate.to)) fail(`${workflow.id}: gate references an unknown state.`);
      if (!workflow.transitions.some(([from, to]) => from === gate.from && to === gate.to)) fail(`${workflow.id}: gate is not attached to a declared transition.`);
      if (gate.type === "approval" && (!Number.isInteger(gate.minimumApprovals) || gate.minimumApprovals < 1 || !Array.isArray(gate.roles) || gate.roles.length === 0)) fail(`${workflow.id}: approval gate requires approvers and roles.`);
    }
    if (["HIGH", "CRITICAL"].includes(workflow.risk) && !(workflow.gates ?? []).length) fail(`${workflow.id}: high-risk workflow requires gates.`);
    if (workflow.risk === "CRITICAL" && !(workflow.gates ?? []).some((gate) => gate.type === "approval" || gate.type === "manual_release_gate")) fail(`${workflow.id}: critical workflow requires approval or manual release gate.`);
  }
  console.log(`Validated ${config.workflows.length} workflows.`);
}
if (automations) {
  if (automations.status !== "BLUEPRINTS_NOT_INSTALLED_OR_ENABLED") fail("Automation blueprints must remain uninstalled and disabled.");
  const ids = new Set();
  for (const rule of automations.rules ?? []) {
    if (!rule.id || ids.has(rule.id)) fail(`Missing or duplicate automation ID: ${rule.id}`);
    ids.add(rule.id);
    if (!Array.isArray(rule.actions) || rule.actions.length === 0) fail(`${rule.id}: actions are required.`);
    const serialized = JSON.stringify(rule).toLowerCase();
    if (/deploy to production|delete user|revoke access automatically|change billing|publish to production/.test(serialized)) fail(`${rule.id}: prohibited live administrative action detected.`);
  }
  console.log(`Validated ${automations.rules.length} automation blueprints.`);
}
if (process.exitCode) process.exit(process.exitCode);
console.log("Atlassian workflow pack is structurally valid; no tenant changes were performed.");
