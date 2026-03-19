# Claude Code Workflow Guidelines

## 🔄 Git Workflow

**CRITICAL: Never push directly to main. Always go through dev first.**

The correct flow:
1. Commit locally
2. Push to a feature/fix branch
3. Create PR
4. Provide GitHub link to branch to Tim for easy access and approval
5. Claude reviews on GitHub
6. Merge after approval → auto-deploy

---

## 📝 Branch Naming

- **Features:** `feature/description`
- **Fixes:** `fix/description`
- **Hotfixes:** `hotfix/description`

---

## ✅ Pre-Commit Checklist

- [ ] Code follows project standards
- [ ] All tests pass
- [ ] No direct commits to main
- [ ] PR created for review
- [ ] Waiting for Claude's GitHub review

---

## 🚫 Never Do

- Push directly to main
- Skip the PR process
- Merge without approval
- Deploy without review
