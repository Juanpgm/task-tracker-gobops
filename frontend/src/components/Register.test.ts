/**
 * Tests for Register.svelte and auth.ts registerUser
 *
 * Validates:
 * 1. Register form structure and validation
 * 2. Auto-login after successful registration
 * 3. registerUser uses direct fetch (no apiClient / no auth token)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const registerSource = readFileSync(
  resolve(__dirname, "Register.svelte"),
  "utf-8",
);

const authSource = readFileSync(
  resolve(__dirname, "../api/auth.ts"),
  "utf-8",
);

/* ============================================================
 *  1. REGISTER FORM STRUCTURE
 * ============================================================ */
describe("Register form structure", () => {
  it("imports registerUser and login from auth", () => {
    expect(registerSource).toMatch(
      /import\s*\{[^}]*registerUser[^}]*\}\s*from\s*["']\.\.\/api\/auth["']/,
    );
    expect(registerSource).toMatch(
      /import\s*\{[^}]*login[^}]*\}\s*from\s*["']\.\.\/api\/auth["']/,
    );
  });

  it("has all required form fields", () => {
    const requiredFields = [
      "email",
      "password",
      "full_name",
      "cellphone",
      "nombre_centro_gestor",
    ];
    for (const field of requiredFields) {
      expect(registerSource, `Missing field: ${field}`).toContain(field);
    }
  });

  it("validates empty fields before submit", () => {
    expect(registerSource).toContain("Por favor, complete todos los campos.");
  });

  it("validates email format", () => {
    expect(registerSource).toContain("Formato de correo electrónico inválido.");
  });

  it("validates minimum password length of 8 characters", () => {
    expect(registerSource).toContain("La contraseña debe tener al menos 8 caracteres.");
    expect(registerSource).toMatch(/password\.length\s*<\s*8/);
  });

  it("trims whitespace from text fields before submit", () => {
    expect(registerSource).toMatch(/email:\s*form\.email\.trim\(\)/);
    expect(registerSource).toMatch(/full_name:\s*form\.full_name\.trim\(\)/);
    expect(registerSource).toMatch(/cellphone:\s*form\.cellphone\.trim\(\)/);
    expect(registerSource).toMatch(/nombre_centro_gestor:\s*form\.nombre_centro_gestor\.trim\(\)/);
  });

  it("does not trim password", () => {
    expect(registerSource).toMatch(/password:\s*form\.password,/);
  });
});

/* ============================================================
 *  2. AUTO-LOGIN AFTER REGISTRATION
 * ============================================================ */
describe("Auto-login after registration", () => {
  it("calls login() after successful registerUser()", () => {
    // After registerUser succeeds, should call login with email and password
    expect(registerSource).toMatch(
      /await\s+registerUser\(normalizedForm\)/,
    );
    expect(registerSource).toMatch(
      /await\s+login\(normalizedForm\.email,\s*normalizedForm\.password\)/,
    );
  });

  it("shows 'Iniciando sesión' message after register success", () => {
    expect(registerSource).toContain("Iniciando sesión");
  });

  it("does NOT use setTimeout to redirect to login page", () => {
    // Old behavior: setTimeout(() => dispatch("success"), 2000)
    // Should no longer have this pattern
    expect(registerSource).not.toMatch(
      /setTimeout\(\s*\(\)\s*=>\s*\{\s*dispatch\("success"\)/,
    );
  });

  it("handles auto-login failure gracefully", () => {
    // If login fails after register, should show a fallback message
    expect(registerSource).toContain("no se pudo iniciar sesión automáticamente");
  });

  it("shows registration error if registerUser fails", () => {
    expect(registerSource).toMatch(
      /err\s+instanceof\s+Error\s*\?\s*err\.message/,
    );
  });
});

/* ============================================================
 *  3. registerUser USES DIRECT FETCH (NO apiClient)
 * ============================================================ */
describe("registerUser uses direct fetch without auth", () => {
  // Extract the registerUser function body
  const fnMatch = authSource.match(
    /export async function registerUser\([\s\S]*?\n\}/,
  );
  const fnBody = fnMatch ? fnMatch[0] : "";

  it("registerUser function exists in auth.ts", () => {
    expect(fnMatch).not.toBeNull();
  });

  it("uses direct fetch() instead of apiClient.post()", () => {
    expect(fnBody).toMatch(/await\s+fetch\(/);
    expect(fnBody).not.toContain("apiClient.post");
  });

  it("sends Content-Type application/json header", () => {
    expect(fnBody).toContain("'Content-Type': 'application/json'");
  });

  it("does NOT send Authorization header", () => {
    expect(fnBody).not.toContain("Authorization");
    expect(fnBody).not.toContain("Bearer");
  });

  it("constructs URL from VITE_AUTH_API_URL", () => {
    expect(fnBody).toMatch(/VITE_AUTH_API_URL/);
    expect(fnBody).toContain("/auth/register");
  });

  it("handles EMAIL_EXISTS error", () => {
    expect(fnBody).toContain("EMAIL_EXISTS");
    expect(fnBody).toContain("ya está registrado");
  });

  it("handles WEAK_PASSWORD error", () => {
    expect(fnBody).toContain("WEAK_PASSWORD");
  });

  it("handles network errors", () => {
    expect(fnBody).toContain("Failed to fetch");
    expect(fnBody).toContain("NetworkError");
  });
});
