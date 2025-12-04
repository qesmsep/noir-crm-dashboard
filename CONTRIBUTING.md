# Contributing to Noir CRM Dashboard

Thank you for your interest in contributing to the Noir CRM Dashboard! This document provides guidelines and best practices for contributing to this project.

## 🚀 Getting Started

### Prerequisites
- Node.js 22.x
- npm or yarn
- Git
- Supabase account (for database access)
- Access to required API keys (Stripe, OpenPhone, Toast)

### Setup
1. Clone the repository
2. Copy `.env.example` to `.env.local`
3. Fill in the required environment variables
4. Install dependencies: `npm install`
5. Run development server: `npm run dev`

## 📋 Development Workflow

### Branch Strategy
- `main`: Production-ready code (protected)
- `dev`: Development branch for integration
- `feature/*`: Feature development branches
- `fix/*`: Bug fix branches
- `hotfix/*`: Critical production fixes

### Workflow
1. Create a new branch from `dev`: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Test thoroughly (manual + automated)
4. Commit with descriptive messages
5. Push and create a Pull Request to `dev`
6. Request code review
7. Address feedback
8. Merge after approval

## 💻 Code Standards

### TypeScript
- **Always use TypeScript** for new files (.ts/.tsx)
- **No `any` type** - use proper typing or `unknown` if necessary
- **Strict mode**: Follow strict TypeScript rules
- **Interfaces over types** for object shapes
- **Use explicit return types** for functions

Example:
```typescript
// ✅ Good
interface User {
  id: string;
  name: string;
  email: string;
}

async function getUser(id: string): Promise<User> {
  // implementation
}

// ❌ Bad
function getUser(id: any): any {
  // implementation
}
```

### React Components
- **Functional components** with TypeScript
- **Props interface** for every component
- **Descriptive prop names** that explain purpose
- **Use hooks** instead of class components
- **Keep components focused** - one responsibility

Example:
```typescript
interface UserCardProps {
  user: User;
  onEdit: (userId: string) => void;
  isLoading?: boolean;
}

export const UserCard: React.FC<UserCardProps> = ({ user, onEdit, isLoading = false }) => {
  // implementation
};
```

### API Routes
- **Validate all inputs** using Zod schemas
- **Handle errors properly** - no silent failures
- **Use try-catch blocks** for async operations
- **Return consistent response format**
- **Log errors** with context
- **Implement rate limiting** for public endpoints

Example:
```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { ApiResponse } from '@/lib/api-response';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      return ApiResponse.methodNotAllowed(res);
    }

    const validated = schema.parse(req.body);

    // Your logic here

    return ApiResponse.success(res, { message: 'Success' });
  } catch (error) {
    logger.error('API Error', { error, path: req.url });
    return ApiResponse.error(res, error);
  }
}
```

### Naming Conventions
- **Files**: kebab-case (`user-profile.tsx`)
- **Components**: PascalCase (`UserProfile`)
- **Functions**: camelCase (`getUserById`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`)
- **Interfaces/Types**: PascalCase (`UserProfile`)
- **Hooks**: camelCase starting with 'use' (`useUserData`)

### File Organization
```
src/
├── app/                    # Next.js App Router pages
├── pages/                  # Next.js Pages Router (legacy)
├── components/
│   ├── common/            # Shared components
│   ├── features/          # Feature-specific components
│   └── layouts/           # Layout components
├── lib/                   # Shared utilities and configs
│   ├── api-client.ts     # API client
│   ├── logger.ts         # Logging
│   └── supabase.ts       # Database client
├── types/                 # TypeScript type definitions
├── utils/                 # Helper functions
├── hooks/                 # Custom React hooks
└── context/              # React context providers
```

## 🧪 Testing

### When to Write Tests
- **All new features** must have tests
- **Bug fixes** should include regression tests
- **Critical paths** (auth, payments, reservations) require high coverage
- **Utility functions** should be 100% tested

### Testing Standards
- Use Jest for unit tests
- Use React Testing Library for component tests
- Mock external dependencies (API calls, Stripe, etc.)
- Test both success and error cases
- Aim for 80%+ coverage on new code

Example:
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { UserCard } from './UserCard';

describe('UserCard', () => {
  it('should render user information', () => {
    const user = { id: '1', name: 'John Doe', email: 'john@example.com' };
    render(<UserCard user={user} onEdit={jest.fn()} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('should call onEdit when edit button is clicked', () => {
    const onEdit = jest.fn();
    const user = { id: '1', name: 'John Doe', email: 'john@example.com' };
    render(<UserCard user={user} onEdit={onEdit} />);

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith('1');
  });
});
```

## 🔒 Security Guidelines

### Never Commit
- API keys or secrets
- `.env` files (use `.env.example` instead)
- Customer data or PII
- Database credentials

### Always
- Validate and sanitize user inputs
- Use parameterized queries (no string concatenation for SQL)
- Implement rate limiting on public endpoints
- Check authentication and authorization
- Log security-relevant events

## 📝 Commit Messages

Follow conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

Examples:
```
feat(reservations): add ability to edit reservation time

- Add edit button to reservation card
- Implement time selection modal
- Update API to support time changes

Closes #123
```

```
fix(auth): resolve session timeout issue

Users were being logged out prematurely due to incorrect
token expiration calculation.

Fixes #456
```

## 🐛 Debugging Guidelines

### Logging
- **Use the logger** - not console.log
- **Include context** - request ID, user ID, etc.
- **Log levels**: error, warn, info, debug
- **No sensitive data** in logs (passwords, tokens, etc.)

Example:
```typescript
import { logger } from '@/lib/logger';

logger.info('User logged in', { userId: user.id, timestamp: new Date() });
logger.error('Payment failed', { error, userId, amount, requestId });
```

### Error Handling
- Always catch and handle errors
- Provide meaningful error messages to users
- Log detailed error information for debugging
- Never expose internal errors to users

## 📚 Documentation

### Code Comments
- Write self-documenting code when possible
- Add comments for complex logic
- Document "why" not "what"
- Keep comments up to date

### API Documentation
- Document all API endpoints
- Include request/response examples
- Specify required vs optional parameters
- Document error responses

### Component Documentation
- Add JSDoc comments for complex components
- Document props with descriptions
- Include usage examples

## 🚫 What NOT to Do

- ❌ Push directly to `main` or `dev`
- ❌ Commit console.log statements
- ❌ Use `any` type in TypeScript
- ❌ Skip error handling
- ❌ Ignore ESLint warnings
- ❌ Write code without testing
- ❌ Commit commented-out code
- ❌ Hard-code configuration values
- ❌ Mix tabs and spaces
- ❌ Leave TODO comments without tickets

## ✅ Before Submitting a PR

- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] New code has tests
- [ ] No console.log or debug code
- [ ] TypeScript compiles without errors
- [ ] ESLint passes with no warnings
- [ ] Documentation is updated
- [ ] Commit messages are clear and descriptive
- [ ] PR description explains changes
- [ ] Manual testing completed
- [ ] No merge conflicts

## 🤝 Code Review Process

### For Authors
- Respond to feedback promptly
- Be open to suggestions
- Explain your decisions when needed
- Make requested changes or discuss alternatives

### For Reviewers
- Be constructive and respectful
- Focus on code quality and standards
- Suggest improvements, don't just criticize
- Approve when ready or request changes with clear feedback

## 📞 Getting Help

- Check existing documentation first
- Search closed issues and PRs
- Ask in team chat for quick questions
- Create an issue for bugs or feature requests
- Tag appropriate team members for specific areas

## 🎯 Quality Standards

We strive for:
- **Performance**: Fast load times, optimized queries
- **Reliability**: Comprehensive error handling, monitoring
- **Security**: Input validation, authentication, authorization
- **Maintainability**: Clean code, good documentation
- **Testability**: High test coverage, easy to test

## 📖 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Supabase Documentation](https://supabase.com/docs)
- [Chakra UI Documentation](https://chakra-ui.com/docs)
- [React Testing Library](https://testing-library.com/react)

---

Thank you for contributing to Noir CRM Dashboard! 🎉
