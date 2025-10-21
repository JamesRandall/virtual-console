# Typescript Style Guide

## Core Principles

- Favor type safety over convenience
- Prefer explicit over implicit
- Use TypeScript's type system to catch errors at compile time
- Write code that is self-documenting through strong typing
- Avoid `any` type unless absolutely necessary

## Type Definitions

### Interfaces vs Types

- Use `interface` for object shapes that may be extended or implemented
- Use `type` for unions, intersections, primitives, and tuples
- Prefer `interface` for public APIs to enable declaration merging

```typescript
// Prefer interface for extensible objects
interface User {
  id: string;
  name: string;
  email: string;
}

// Use type for unions and complex types
type Result<T> = Success<T> | Failure;
type Status = 'pending' | 'active' | 'inactive';
```

### Avoid Optional Chaining Abuse

- Use optional chaining (`?.`) judiciously
- Prefer explicit null checks when logic depends on the value
- Don't use optional chaining to paper over poor type definitions

```typescript
// Poor - hides the real problem
const name = user?.profile?.name ?? 'Unknown';

// Better - be explicit about what can be null
if (!user.profile) {
  throw new Error('User profile required');
}
const name = user.profile.name;
```

## Functions

### Function Signatures

- Always explicitly type function parameters
- Explicitly type return values for exported functions
- Use descriptive parameter names
- Prefer named parameters (object destructuring) for functions with 3+ parameters

```typescript
// Good
export function calculateDiscount(
  price: number,
  discountRate: number
): number {
  return price * (1 - discountRate);
}

// Better for complex functions
export function createOrder({
  userId,
  items,
  shippingAddress,
  paymentMethod
}: CreateOrderParams): Promise<Order> {
  // implementation
}
```

### Arrow Functions vs Function Declarations

- Use function declarations for top-level functions
- Use arrow functions for callbacks and inline functions
- Use arrow functions in class methods when you need to preserve `this` context

### Async/Await

- Always prefer `async/await` over raw promises
- Handle errors with try/catch blocks
- Never use `.then()` chains in new code
- Return promises directly when no async operations are needed

```typescript
// Good
async function fetchUserData(userId: string): Promise<User> {
  try {
    const response = await fetch(`/api/users/${userId}`);
    return await response.json();
  } catch (error) {
    throw new UserFetchError(`Failed to fetch user ${userId}`, { cause: error });
  }
}
```

## Type Guards and Narrowing

- Create custom type guards for complex type narrowing
- Use discriminated unions for modeling different states
- Prefer exhaustive switch statements with `never` checks

```typescript
// Discriminated unions
type ApiResponse<T> =
  | { status: 'success'; data: T }
  | { status: 'error'; error: string }
  | { status: 'loading' };

// Type guard
function isSuccessResponse<T>(
  response: ApiResponse<T>
): response is { status: 'success'; data: T } {
  return response.status === 'success';
}

// Exhaustive checking
function handleResponse<T>(response: ApiResponse<T>): void {
  switch (response.status) {
    case 'success':
      console.log(response.data);
      break;
    case 'error':
      console.error(response.error);
      break;
    case 'loading':
      console.log('Loading...');
      break;
    default:
      const _exhaustive: never = response;
      throw new Error(`Unhandled response: ${_exhaustive}`);
  }
}
```

## Generics

- Use single uppercase letters (T, K, V) only for simple, obvious cases
- Use descriptive names for complex generics (TResponse, TEntity)
- Constrain generics when possible
- Avoid generic overuse

```typescript
// Simple case - single letter is fine
function identity<T>(value: T): T {
  return value;
}

// Complex case - descriptive names
function mapResponse<TResponse, TEntity>(
  response: TResponse,
  mapper: (data: TResponse) => TEntity
): TEntity {
  return mapper(response);
}

// With constraints
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

## Error Handling

- Create custom error classes for different error types
- Use Error cause chains (available in newer TS/JS)
- Never throw strings or plain objects
- Include contextual information in error messages

```typescript
class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'ValidationError';
  }
}

class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly query: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'DatabaseError';
  }
}
```

## Nullability

- Enable `strictNullChecks` in tsconfig.json
- Be explicit about nullable types using union types
- Use non-null assertion (`!`) sparingly and only when you're certain
- Prefer null over undefined for intentional absence

```typescript
// Explicit nullability
type User = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null; // Explicitly optional
};

// Avoid undefined in return types - prefer null or throw
function findUser(id: string): User | null {
  // return null if not found, don't return undefined
}
```

## Arrays and Collections

- Use array methods (`map`, `filter`, `reduce`) over loops
- Prefer `readonly` for array parameters that shouldn't be modified
- Use typed arrays with generics
- Consider using `ReadonlyArray<T>` for immutable parameters

```typescript
// Good
function processUsers(users: readonly User[]): string[] {
  return users
    .filter(user => user.active)
    .map(user => user.name);
}

// Use const assertions for literal arrays
const STATUS_CODES = [200, 201, 204] as const;
type StatusCode = typeof STATUS_CODES[number]; // 200 | 201 | 204
```

## Object Handling

- Use object destructuring with explicit types
- Prefer `Record<K, V>` for dictionaries
- Use `Partial<T>`, `Pick<T, K>`, `Omit<T, K>` utility types
- Avoid using `Object` type - use `Record<string, unknown>` or specific types

```typescript
// Destructuring with types
function greetUser({ name, email }: Pick<User, 'name' | 'email'>): void {
  console.log(`Hello ${name} (${email})`);
}

// Dictionary types
type UserCache = Record<string, User>;

// Partial updates
function updateUser(id: string, updates: Partial<User>): User {
  // implementation
}
```

## Classes

- Use `readonly` for immutable properties
- Prefer private fields (#field) over private keyword for truly private data
- Use parameter properties to reduce boilerplate
- Implement interfaces explicitly
- Avoid inheritance - prefer composition

```typescript
interface IUserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

class UserRepository implements IUserRepository {
  // Private field - not accessible even in subclasses
  #cache = new Map<string, User>();

  constructor(
    private readonly database: Database,
    private readonly logger: Logger
  ) {}

  async findById(id: string): Promise<User | null> {
    // implementation
  }

  async save(user: User): Promise<void> {
    // implementation
  }
}
```

## Enums vs Union Types

- Prefer string literal union types over enums
- Use enums only when you need reverse mapping or the enum represents flags
- Never use numeric enums unless there's a specific reason

```typescript
// Prefer this
type UserRole = 'admin' | 'user' | 'guest';

// Over this
enum UserRole {
  Admin = 'admin',
  User = 'user',
  Guest = 'guest'
}

// Enums acceptable for flags
enum Permission {
  Read = 1 << 0,
  Write = 1 << 1,
  Delete = 1 << 2
}
```

## Module Organization

- One class/interface per file (with related types)
- Use barrel exports (index.ts) sparingly
- Prefer named exports over default exports
- Group related functionality in directories

```typescript
// user.types.ts
export type User = {
  id: string;
  name: string;
};

export type CreateUserDto = Omit<User, 'id'>;

// user.repository.ts
import type { User, CreateUserDto } from './user.types';

export class UserRepository {
  // implementation
}

// user.service.ts
import type { User } from './user.types';
import { UserRepository } from './user.repository';

export class UserService {
  // implementation
}
```

## Naming Conventions

- Use PascalCase for types, interfaces, classes, enums
- Use camelCase for variables, functions, methods
- Use UPPER_SNAKE_CASE for constants
- Prefix interfaces with 'I' only when necessary to distinguish from implementation
- Boolean variables/functions should read naturally: `isActive`, `hasPermission`, `canEdit`

```typescript
const MAX_RETRY_ATTEMPTS = 3;

type UserStatus = 'active' | 'inactive';

interface UserRepository {
  findById(id: string): Promise<User | null>;
}

class DatabaseUserRepository implements UserRepository {
  // implementation
}

function isValidEmail(email: string): boolean {
  // implementation
}
```

## Comments and Documentation

- Use JSDoc for public APIs
- Write comments that explain "why", not "what"
- Keep comments up to date with code changes
- Use `// TODO:` and `// FIXME:` with your name and date

```typescript
/**
 * Calculates the total price including tax and discounts.
 * 
 * @param basePrice - The original price before adjustments
 * @param taxRate - Tax rate as a decimal (e.g., 0.08 for 8%)
 * @param discountCode - Optional discount code to apply
 * @returns The final price after tax and discounts
 * @throws {ValidationError} If basePrice is negative or taxRate is invalid
 */
export function calculateFinalPrice(
  basePrice: number,
  taxRate: number,
  discountCode?: string
): number {
  // Discount must be applied before tax (business requirement)
  const discounted = applyDiscount(basePrice, discountCode);
  return discounted * (1 + taxRate);
}
```

## Testing Considerations

- Write types that are easy to mock and test
- Use dependency injection
- Prefer interfaces over concrete classes in dependencies
- Make functions pure when possible

```typescript
// Testable design
interface IEmailService {
  send(to: string, subject: string, body: string): Promise<void>;
}

class UserNotificationService {
  constructor(private readonly emailService: IEmailService) {}

  async notifyUserCreated(user: User): Promise<void> {
    await this.emailService.send(
      user.email,
      'Welcome!',
      `Hello ${user.name}`
    );
  }
}
```

## Things to Avoid

- `any` type (use `unknown` if you really don't know the type)
- Non-null assertion operator (`!`) unless you're absolutely certain
- Type casting with `as` (prefer type guards)
- `@ts-ignore` or `@ts-expect-error` (fix the actual issue)
- Implicit any from missing return types
- Overly complex type gymnastics (keep types readable)
- Mutable default parameters
- Modifying function parameters
- Avoid "magic numbers" in the code - use descriptive const's

## tsconfig.json Recommended Settings

```json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```