**CRITICAL:** Never commit without Tim's explicit approval. Read AI_QUICK_START.md and HOWTO.md for full project docs.

Respond: "Initialized. Use /howto for project docs. What would you like to work on?"

---

## 🤖 Specialized Agents

**🔍 Schema Scout** `/schema-scout <table> [--operation=<op>]`
- Auto-invoke BEFORE any DB schema changes
- Analyzes: FK relationships, RLS policies, triggers, code dependencies

**🔎 Pattern Finder** `/pattern-finder <feature>`
- Auto-invoke BEFORE building new features/components
- Finds existing implementations to prevent duplicate work

**⚠️ Conflict Analyzer** `/conflict <changes>`
- Auto-invoke BEFORE significant refactors
- Output: TLDR first (top issues, questions, recommendations)
- Details only when Tim asks "show details"

**🔐 Permission Mapper** `/permission-mapper <feature>`
- Auto-invoke BEFORE data access features
- Audits: roles, RLS policies, authorization checks, security gaps

**🔨 Migration Generator** `/migration-gen <description>`
- Auto-invoke WHEN modifying schema (after Schema Scout)
- Generates: SQL migration, RLS policies, indexes, rollback script

**📱 Mobile Validator** `/mobile-validator <path>`
- Auto-invoke AFTER creating/modifying UI components
- Validates: touch targets (44px min), breakpoints, mobile-first design

**🐛 Debug Logger** `/debug-logger <search|log> <query>`
- Search BEFORE debugging (check known issues)
- Log AFTER solving (document solution)

---

## 🎯 Workflows

**DB Changes:** `/schema-scout` → review → `/migration-gen` → present plan
**New Features:** `/pattern-finder` → recommend approach
**Refactors:** `/conflict` → TLDR → wait for approval
**Data Access:** `/permission-mapper` → verify security
**UI Work:** Build mobile-first → `/mobile-validator` → `/brand`
**Debugging:** `/debug-logger search` → apply fix or solve → log if new

---

## 🚨 Critical Rules

- **DB:** Always use `/schema-scout` before changes; never skip
- **Security:** Always use `/permission-mapper` for member data access
- **Mobile:** Design mobile-first (320px+); 44px touch targets minimum
- **Breaking Changes:** `/conflict` TLDR first; detailed breakdown only when Tim asks
- **Commits:** ONLY when Tim explicitly approves; descriptive messages
