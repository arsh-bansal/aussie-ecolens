import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  CognitoUserSession,
  type ISignUpResult,
} from "amazon-cognito-identity-js";
import { cognitoConfig } from "./config";

let cachedPool: CognitoUserPool | null = null;

function getPool(): CognitoUserPool {
  if (!cognitoConfig.isConfigured) {
    throw new Error(
      "Cognito is not configured. Set VITE_COGNITO_USER_POOL_ID and " +
        "VITE_COGNITO_CLIENT_ID in .env.local and restart the dev server.",
    );
  }
  if (!cachedPool) {
    cachedPool = new CognitoUserPool({
      UserPoolId: cognitoConfig.userPoolId,
      ClientId: cognitoConfig.clientId,
    });
  }
  return cachedPool;
}

function user(email: string): CognitoUser {
  return new CognitoUser({ Username: email, Pool: getPool() });
}

export function signUp(
  email: string,
  firstName: string,
  lastName: string,
  password: string,
): Promise<ISignUpResult> {
  const attrs = [
    new CognitoUserAttribute({ Name: "email", Value: email }),
    new CognitoUserAttribute({ Name: "given_name", Value: firstName }),
    new CognitoUserAttribute({ Name: "family_name", Value: lastName }),
  ];
  return new Promise((resolve, reject) => {
    getPool().signUp(email, password, attrs, [], (err, result) => {
      if (err || !result) return reject(err ?? new Error("Sign-up failed"));
      resolve(result);
    });
  });
}

export function confirmSignUp(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    user(email).confirmRegistration(code, true, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export function resendConfirmationCode(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    user(email).resendConfirmationCode((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export function signIn(email: string, password: string): Promise<CognitoUserSession> {
  const u = user(email);
  const details = new AuthenticationDetails({ Username: email, Password: password });
  return new Promise((resolve, reject) => {
    u.authenticateUser(details, {
      onSuccess: (session) => resolve(session),
      onFailure: (err) => reject(err),
      newPasswordRequired: () => reject(new Error("New password required — flow not implemented")),
    });
  });
}

export function getCurrentSession(): Promise<{ session: CognitoUserSession; user: CognitoUser } | null> {
  const u = getPool().getCurrentUser();
  if (!u) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    u.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err) return reject(err);
      if (!session || !session.isValid()) return resolve(null);
      resolve({ session, user: u });
    });
  });
}

export function signOut(): Promise<void> {
  const u = getPool().getCurrentUser();
  if (!u) return Promise.resolve();
  return new Promise((resolve) => {
    u.signOut(() => resolve());
  });
}

export function globalSignOut(): Promise<void> {
  const u = getPool().getCurrentUser();
  if (!u) return Promise.resolve();
  return new Promise((resolve, reject) => {
    u.getSession((err: Error | null) => {
      if (err) return reject(err);
      u.globalSignOut({
        onSuccess: () => resolve(),
        onFailure: (e) => reject(e),
      });
    });
  });
}

export function forgotPassword(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    user(email).forgotPassword({
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    });
  });
}

export function confirmPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    user(email).confirmPassword(code, newPassword, {
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    });
  });
}

export function getUserAttributes(session: { user: CognitoUser }): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    session.user.getUserAttributes((err, attrs) => {
      if (err || !attrs) return reject(err ?? new Error("No attributes"));
      const out: Record<string, string> = {};
      for (const a of attrs) out[a.getName()] = a.getValue();
      resolve(out);
    });
  });
}
