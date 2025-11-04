/**
 * Seed database with invoice mismatch and related scenarios for hybrid search testing
 */

import { Database } from "bun:sqlite";
import { randomUUID } from "crypto";

function nowISO() {
  return new Date().toISOString();
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

export function seedHybridTestData(db: Database) {
  console.log("Seeding hybrid search test data...");

  const tasks = [
    // Invoice mismatch scenarios
    {
      title: "Investigate Pax8 invoice discrepancy",
      body: "Customer reported $500 difference between Pax8 invoice and our billing. Need to reconcile line items and identify root cause.",
      summary: "Pax8 billing mismatch - $500 discrepancy",
      priority: "high",
      state: "open",
      created_ts: daysAgo(2)
    },
    {
      title: "Azure invoice reconciliation Q4",
      body: "Monthly Azure invoice shows unexpected charges for storage. Compare with usage reports and identify any billing errors or misconfigurations.",
      summary: "Azure billing discrepancy in storage costs",
      priority: "high",
      state: "open",
      created_ts: daysAgo(5)
    },
    {
      title: "Resolve Microsoft 365 license count mismatch",
      body: "Invoice shows 150 licenses but we only have 142 active users. Need to audit license assignments and remove unused licenses.",
      summary: "M365 license count doesn't match invoice",
      priority: "med",
      state: "inbox",
      created_ts: daysAgo(1)
    },
    {
      title: "Customer billing error - duplicate charges",
      body: "Client ABC Corp was charged twice for the same service period. Issue refund and update billing system to prevent future duplicates.",
      summary: "Duplicate invoice charges for ABC Corp",
      priority: "high",
      state: "open",
      created_ts: daysAgo(3)
    },
    {
      title: "Quarterly invoice audit findings",
      body: "Finance team identified several discrepancies in Q3 invoices: 1) Incorrect tax calculations, 2) Missing line items, 3) Wrong pricing tiers applied.",
      summary: "Q3 invoice audit revealed multiple billing errors",
      priority: "high",
      state: "open",
      created_ts: daysAgo(7)
    },

    // Related billing/finance tasks
    {
      title: "Update pricing model for enterprise clients",
      body: "Review and update enterprise pricing tiers based on usage patterns. Ensure pricing is competitive and accurately reflects service costs.",
      summary: "Enterprise pricing model review",
      priority: "med",
      state: "inbox",
      created_ts: daysAgo(10)
    },
    {
      title: "Automate monthly billing reconciliation",
      body: "Build script to automatically compare vendor invoices with our billing records. Should flag discrepancies for manual review.",
      summary: "Billing reconciliation automation",
      priority: "med",
      state: "inbox",
      created_ts: daysAgo(14)
    },
    {
      title: "Fix tax calculation bug in billing system",
      body: "Tax rates are not being applied correctly for international customers. Update tax engine to use correct rates based on customer location.",
      summary: "Tax calculation bug affecting international billing",
      priority: "high",
      state: "open",
      created_ts: daysAgo(4)
    },

    // Unrelated tasks for noise
    {
      title: "Deploy new API endpoint for customer portal",
      body: "Implement and deploy REST API endpoint for customer self-service portal. Includes authentication, rate limiting, and documentation.",
      summary: "Customer portal API deployment",
      priority: "med",
      state: "open",
      created_ts: daysAgo(6)
    },
    {
      title: "Update security patches on production servers",
      body: "Apply latest security patches to all production servers. Schedule maintenance window and notify customers of potential downtime.",
      summary: "Production server security updates",
      priority: "high",
      state: "inbox",
      created_ts: daysAgo(1)
    },
    {
      title: "Onboard new team member - Sarah Chen",
      body: "Complete onboarding checklist for new developer: setup accounts, assign equipment, schedule training sessions, add to team channels.",
      summary: "New hire onboarding for Sarah Chen",
      priority: "med",
      state: "open",
      created_ts: daysAgo(8)
    },
    {
      title: "Optimize database query performance",
      body: "Several customer-facing queries are running slowly. Profile queries, add indexes, and optimize joins to improve response times.",
      summary: "Database performance optimization",
      priority: "med",
      state: "inbox",
      created_ts: daysAgo(12)
    },

    // More invoice-related for better semantic matching
    {
      title: "Vendor invoice approval workflow",
      body: "Streamline vendor invoice approval process. Currently takes 2 weeks - need to reduce to 3-5 days. Implement automated routing and notifications.",
      summary: "Improve vendor invoice approval speed",
      priority: "low",
      state: "inbox",
      created_ts: daysAgo(20)
    },
    {
      title: "Payment reconciliation for Q3",
      body: "Reconcile all customer payments received in Q3 with outstanding invoices. Identify any missing payments or overpayments.",
      summary: "Q3 payment reconciliation",
      priority: "med",
      state: "done",
      created_ts: daysAgo(30)
    },
    {
      title: "Invoice template redesign",
      body: "Update invoice template to be more customer-friendly. Include clearer line item descriptions, usage breakdowns, and payment instructions.",
      summary: "Redesign customer invoice template",
      priority: "low",
      state: "inbox",
      created_ts: daysAgo(25)
    }
  ];

  let insertedCount = 0;

  for (const task of tasks) {
    const id = "t_" + randomUUID().slice(0, 8);
    const ts = task.created_ts || nowISO();

    try {
      db.query(`
        INSERT INTO tasks(id, title, body, summary, state, priority, source, created_ts, updated_ts)
        VALUES ($id, $title, $body, $summary, $state, $priority, 'seed', $created_ts, $updated_ts)
      `).run({
        $id: id,
        $title: task.title,
        $body: task.body,
        $summary: task.summary,
        $state: task.state,
        $priority: task.priority,
        $created_ts: ts,
        $updated_ts: ts
      });

      insertedCount++;
    } catch (error) {
      console.error(`Failed to insert task: ${task.title}`, error);
    }
  }

  console.log(`Seeded ${insertedCount} tasks for hybrid search testing`);
  return insertedCount;
}

// CLI entry point
if (import.meta.main) {
  const dbPath = process.env.TASKS_DB_PATH || "tasks.db";
  const db = new Database(dbPath);
  
  const count = seedHybridTestData(db);
  console.log(`\nSeeding complete: ${count} tasks added`);
  
  db.close();
}
