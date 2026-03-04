# /end - Session Completion & Documentation Update

Updates HOWTO.md with significant changes completed during the session, then provides session summary.

---

## Instructions

When the user types `/end`, you should:

1. **Review the session** - Identify all significant changes made:
   - New API endpoints created
   - New features implemented
   - Database schema changes
   - New UI components
   - Bug fixes
   - Configuration changes

2. **Update HOWTO.md** - Add or update relevant sections:
   - Add new API endpoints to the API documentation section
   - Update feature descriptions if functionality changed
   - Add new components to component documentation
   - Update database schema section if tables/columns changed
   - Add any new workflows or business logic

3. **Format updates properly**:
   - Use consistent markdown formatting matching existing HOWTO.md style
   - Include code examples where relevant
   - Add clear descriptions of what each feature does
   - Include file paths for new components/endpoints

4. **Provide session summary**:
   - List all files created/modified
   - Summarize key features implemented
   - Note any breaking changes
   - Highlight testing recommendations
   - List any TODO items or future enhancements discussed

5. **Ask for commit approval**:
   - Remind: "DO NOT COMMIT UNTIL TIM EXPLICITLY APPROVES"
   - Ask if Tim wants to commit the changes
   - If yes, create a comprehensive commit message

---

## Example Output Format

```markdown
# Session Summary - [Date]

## 📝 HOWTO.md Updated

Added the following sections:
- [Section name] - [Brief description]
- [Section name] - [Brief description]

## ✅ Features Implemented

1. **Feature Name**
   - API: `POST /api/endpoint`
   - UI: Component location
   - What it does: Brief description

2. **Feature Name**
   - API: `GET /api/endpoint`
   - What it does: Brief description

## 📂 Files Created/Modified

**New Files:**
- `src/pages/api/path/to/file.ts`
- `src/components/ComponentName.tsx`

**Modified Files:**
- `src/pages/admin/members.tsx`
- `src/components/SubscriptionCard.tsx`

## 🧪 Testing Recommendations

1. Test feature X
2. Test feature Y

## 📌 Future Enhancements (Discussed)

- Enhancement idea 1
- Enhancement idea 2

---

**Ready to commit?** (Reminder: DO NOT COMMIT until Tim explicitly approves)
```

---

## Update Guidelines

### What to Include in HOWTO.md

✅ **Always document:**
- New API endpoints (with method, path, purpose)
- New features with user-facing impact
- New database tables or significant column additions
- New reusable components
- Changed business logic or workflows
- New configuration requirements

❌ **Skip documenting:**
- Minor CSS tweaks
- Bug fixes that don't change behavior
- Internal refactoring without functional changes
- Temporary debugging code
- Comments or documentation-only changes

### HOWTO.md Section Guidelines

When updating HOWTO.md, find the most relevant section:

- **API Endpoints** → Add to existing API section or create subsection
- **Features** → Update "Core Systems & Features" section
- **Components** → Update component documentation
- **Database** → Update "Database Schema" section
- **Workflows** → Add to relevant business logic section

Use the existing HOWTO.md structure and formatting style. Keep descriptions concise but complete.

---

## Important Notes

- **NEVER commit without explicit approval** - Always remind Tim
- **Be thorough** - Document all significant changes
- **Be concise** - Don't bloat HOWTO.md with obvious details
- **Use existing patterns** - Match the existing documentation style
- **Include examples** - Show request/response formats for APIs
- **Link related sections** - Reference other parts of HOWTO.md when relevant
