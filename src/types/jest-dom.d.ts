// Registers @testing-library/jest-dom's matcher types with TypeScript.
//
// jest.setup.js imports the library so the matchers exist at runtime, but
// nothing pulled its type augmentation into the program — so every
// `toBeInTheDocument` / `toHaveAttribute` / `toHaveValue` in the repo was a
// type error (17 of them in BiometricRegistrationPrompt.test.tsx alone) even
// though the assertions themselves work.
import "@testing-library/jest-dom"
