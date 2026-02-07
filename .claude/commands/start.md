DO NOT COMMIT UNTIL TIM EXPLICITLY APPROVES.

1. Read AI_QUICK_START.md.
2. Use grep with pattern "^## 📋 Summary" on HOWTO.md with -A 185 to read Summary section.
3. Use grep with pattern "^## Table of Contents" on HOWTO.md with -A 25 to read Table of Contents.
4. Use grep with pattern "^## Design System & Brand Guidelines" on HOWTO.md with -A 60 to read core brand principles.
5. Load specialized agent capabilities (listed below).
6. Respond "Initialized. What would you like to work on?"

---

## 🤖 Specialized Agents Available

You have access to specialized agents that automate complex analysis tasks. Invoke them automatically when appropriate:

### 🔍 Schema Scout - Database Impact Analyzer
**Command:** `/schema-scout <table_name> [--operation=<operation>]`

**Purpose:** Analyze database dependencies before schema changes to prevent breaking changes

**Auto-invoke BEFORE:**
- Adding, removing, or modifying database tables or columns
- Changing foreign key relationships or constraints
- Modifying RLS policies or database triggers
- Any database schema modifications

**What it analyzes:**
- Foreign key relationships (incoming and outgoing)
- RLS policies affecting the table
- Database triggers and functions
- Code dependencies (API routes, components querying the table)
- Migration impact and rollback requirements

**Example:**
```
User: "Add a 'notes' column to the members table"
→ You: [Invoke /schema-scout members --operation=add_column]
→ You: [Review findings: 15 API routes use members table, RLS policies need update]
→ You: [Present migration plan with risk assessment]
```

---

### 🔎 Pattern Finder - Duplicate Work Prevention
**Command:** `/pattern-finder <feature_description>`

**Purpose:** Find existing implementations to prevent duplicate work and ensure consistency

**Auto-invoke BEFORE:**
- Starting any new feature development
- Building a new UI component
- Creating new API endpoints
- Implementing similar functionality you suspect already exists

**What it searches:**
- Similar components in `src/components/` and `src/components/member/`
- Similar API routes in `src/pages/api/` and `src/app/api/`
- Utility functions in `src/lib/`
- Similar patterns documented in HOWTO.md
- Reusable hooks and contexts

**Example:**
```
User: "Create a modal for editing member information"
→ You: [Invoke /pattern-finder member modal edit]
→ You: [Find ReservationEditModal.tsx as similar pattern]
→ You: [Recommend cloning and adapting vs building from scratch]
```

---

### ⚠️ Conflict Analyzer - Breaking Change Detector
**Command:** `/conflict <description_of_changes>`

**Purpose:** Identify all dependencies and potential breaking changes before significant refactors

**Auto-invoke BEFORE:**
- Significant code updates affecting multiple files
- Refactoring shared components or utilities
- Changing API response formats or interfaces
- Modifying database query structures
- Renaming files, functions, or components

**What it analyzes:**
- All files importing the component/function being changed
- Type definitions and interfaces
- API contracts (request/response shapes)
- Database query dependencies
- Prop types and component interfaces
- Context providers and consumers

**Output Format:**
1. **TLDR First** (always show):
   - Top 3-5 critical issues
   - Key questions for Tim
   - High-level recommendations
2. **Details on Demand** (only when Tim asks "show details" or "show code"):
   - Complete conflict breakdown by severity (Critical/Moderate/Minor/Surprise)
   - Conflict-resolved code samples
   - Implementation plan with time estimates

**Example:**
```
User: "Refactor the ReservationCard component to use a new prop structure"
→ You: [Invoke /conflict refactor ReservationCard component prop structure]
→ You: [Show TLDR: 12 files affected, 3 prop type mismatches, recommend gradual migration]
→ You: [Wait for Tim to ask for details before showing full breakdown]
```

---

### 🔐 Permission Mapper - Security Auditor
**Command:** `/permission-mapper <feature_description>`

**Purpose:** Audit permission requirements, RLS policies, and security before implementing data access features

**Auto-invoke BEFORE:**
- Implementing new data-access features
- Creating new API routes that access member data
- Adding admin-only functionality
- Modifying existing permission checks
- Implementing member portal features

**What it audits:**
- Required user roles (admin, member, guest)
- RLS policies on affected tables
- Authorization checks in API routes
- Row-level vs table-level access
- Admin override patterns (using `is_member_portal_admin()`)
- Potential security gaps or data leaks

**Example:**
```
User: "Add API endpoint to view all member transaction history"
→ You: [Invoke /permission-mapper view member transactions]
→ You: [Audit: Requires admin role, RLS policy on ledger_entries, check member ownership]
→ You: [Present security requirements and implementation plan]
```

---

### 🔨 Migration Generator - Safe DB Evolution
**Command:** `/migration-gen <description>`

**Purpose:** Generate production-safe migration scripts with RLS policies and rollback strategies

**Auto-invoke WHEN:**
- Creating new database tables
- Modifying existing schema (after Schema Scout analysis)
- Adding columns, indexes, or constraints
- Creating or modifying RLS policies

**What it generates:**
- Complete SQL migration script
- RLS policies for new tables/columns
- Indexes for performance
- Foreign key constraints
- Rollback script (for safe reversal)
- Testing checklist
- Migration instructions

**Example:**
```
User: "Add a member_notes table to track internal notes about members"
→ You: [Invoke /schema-scout member_notes --operation=create]
→ You: [Then invoke /migration-gen create member_notes table]
→ You: [Present complete migration file with RLS policies and rollback]
```

---

### 📱 Mobile Validator - Responsive Design Checker
**Command:** `/mobile-validator <component_or_page_path>`

**Purpose:** Validate mobile-first requirements, touch targets, and responsive layouts

**Auto-invoke AFTER:**
- Creating new UI components
- Modifying existing layouts or pages
- Making responsive design changes

**What it validates:**
- Touch targets (minimum 44px width/height)
- Mobile breakpoints (320px, 768px, 1024px, 1200px+)
- Font sizes for readability on mobile
- Spacing and padding for touch-friendly interfaces
- Horizontal scrolling issues
- Mobile-first CSS media queries
- Responsive images and icons

**Example:**
```
User: "Created the new MemberDashboardCard component"
→ You: [Implement the component]
→ You: [Invoke /mobile-validator src/components/member/MemberDashboardCard.tsx]
→ You: [Review: Touch targets OK, but font size too small at 320px - fix before completing]
```

---

### 🐛 Debug Logger - Issue Tracker
**Command:** `/debug-logger <search|log> <query_or_description>`

**Purpose:** Track recurring issues and search for known solutions

**When to use:**
- **Search mode**: Before debugging a recurring issue (check if it's been solved before)
- **Log mode**: After solving a new issue (document for future sessions)

**What it does:**
- **Search**: Queries `.claude/logs/known-issues.md` for matching issues
- **Log**: Appends new issue + solution to the log with timestamp and unique ID
- Prevents re-solving the same problems
- Builds institutional knowledge over time

**Example:**
```
User: "The dialog is locking up when I close it"
→ You: [Invoke /debug-logger search dialog lock]
→ You: [Find Issue #1: Nested dialogs with uncontrolled dropdowns]
→ You: [Apply known solution: Make dropdown controlled with state]

---

User: "Fixed the new calendar rendering bug with timezone offsets"
→ You: [Task completed successfully]
→ You: [Invoke /debug-logger log calendar timezone rendering offset issue]
→ You: [Issue #5 logged with solution for future reference]
```

---

## 🎯 Agent Invocation Rules

**BEFORE database schema changes:**
1. Invoke `/schema-scout <table>` to analyze impact
2. Review foreign keys, RLS policies, triggers, code dependencies
3. Invoke `/migration-gen` to create safe migration script
4. Present complete plan with risk assessment

**BEFORE building new features:**
1. Invoke `/pattern-finder <feature>` to find existing patterns
2. Check for reusable components, utilities, or similar implementations
3. Present findings and recommend approach (reuse vs. build new)

**BEFORE significant code updates:**
1. Invoke `/conflict <changes>` to identify dependencies
2. Provide TLDR summary (top 3-5 issues, questions, recommendations)
3. Wait for Tim's approval before proceeding
4. Keep full analysis in memory for followup questions

**BEFORE implementing data access features:**
1. Invoke `/permission-mapper <feature>` to audit security
2. Review required roles, RLS policies, permission checks
3. Ensure no security gaps before implementation

**AFTER creating/modifying UI components:**
1. Invoke `/mobile-validator <component>` to check responsiveness
2. Invoke `/brand` to validate brand compliance
3. Fix any issues before marking task complete

**WHEN debugging recurring issues:**
1. Invoke `/debug-logger search <issue>` to check known solutions
2. If found, apply known fix
3. If new issue, solve it and invoke `/debug-logger log` to document

**FOR major refactors:**
1. Use `/pattern-finder` to understand current implementation patterns
2. Use `/conflict` to identify all dependencies and breaking changes
3. Present TLDR first, detailed plan only when Tim asks

---

## 🚨 Critical Protocols

### Database Changes
**For ANY database schema changes**, ALWAYS:
- Use `/schema-scout` BEFORE implementing to analyze impact
- Never skip this step - breaking DB changes are expensive and hard to rollback
- Generate migration scripts with `/migration-gen` after analysis
- Include rollback strategies in all migrations
- Test migration on development database before production

### Security Audit
**When implementing features that access member data**, ALWAYS:
- Activate `/permission-mapper` mode to ensure proper security
- Verify RLS policies are in place and correct
- Check for role-based access control
- Never expose admin-only data to member portal
- Test with different user roles to verify access restrictions

### Mobile-First Design
**For ALL UI work**, ALWAYS:
- Design mobile layout FIRST (320px-768px viewport)
- Use `/mobile-validator` to check touch targets (minimum 44px)
- Test responsive breakpoints (mobile → tablet → desktop)
- Follow Noir brand guidelines for spacing, sizing, typography
- Reference `.claude/commands/brand.md` for design system

### Breaking Changes Prevention
**For significant refactors or updates**, ALWAYS:
- Use `/conflict` FIRST to identify all dependencies
- Present TLDR to Tim (top issues, questions, recommendations)
- Provide detailed breakdown only when Tim asks ("show details", "show code")
- Never proceed with breaking changes without explicit approval
- Consider gradual migration strategies for large refactors

### Commit Protocol
**CRITICAL**: NEVER commit or push changes without Tim's explicit approval
- Only commit when Tim says "commit this" or "push these changes"
- Use descriptive commit messages in imperative style
- Include enough detail for future reference and git log searches
- Example: "Add mobile-responsive dashboard cards with touch-friendly navigation and brand-compliant shadows"

---

DO NOT COMMIT UNTIL TIM EXPLICITLY APPROVES.
