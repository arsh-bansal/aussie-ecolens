import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  CognitoUserSession,
  type ISignUpResult,
} from 'amazon-cognito-identity-js';

let _pool: CognitoUserPool | null = null;

function pool(): CognitoUserPool {
  if (!_pool) {
    _pool = new CognitoUserPool({
      UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? '',
      ClientId: process.env.NEXT_PUBLIC_COGNITO_APP_CLIENT_ID ?? '',
    });
  }
  return _pool;
}

export interface SignUpParams {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthResult {
  session: CognitoUserSession;
  idToken: string;
  accessToken: string;
}

export function signUp({ email, password, firstName, lastName }: SignUpParams): Promise<ISignUpResult> {
  return new Promise((resolve, reject) => {
    const attrs = [
      new CognitoUserAttribute({ Name: 'email', Value: email }),
      new CognitoUserAttribute({ Name: 'given_name', Value: firstName }),
      new CognitoUserAttribute({ Name: 'family_name', Value: lastName }),
    ];
    pool().signUp(email, password, attrs, [], (err, result) => {
      if (err || !result) reject(err ?? new Error('Sign-up failed'));
      else resolve(result);
    });
  });
}

export function confirmSignUp(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    new CognitoUser({ Username: email, Pool: pool() }).confirmRegistration(code, true, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function resendConfirmationCode(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    new CognitoUser({ Username: email, Pool: pool() }).resendConfirmationCode((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function signIn(email: string, password: string): Promise<AuthResult> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: pool() });
    user.authenticateUser(
      new AuthenticationDetails({ Username: email, Password: password }),
      {
        onSuccess(session) {
          resolve({
            session,
            idToken: session.getIdToken().getJwtToken(),
            accessToken: session.getAccessToken().getJwtToken(),
          });
        },
        onFailure: reject,
        newPasswordRequired() {
          reject(new Error('NEW_PASSWORD_REQUIRED'));
        },
      }
    );
  });
}

export function signOut(): void {
  pool().getCurrentUser()?.signOut();
}

export function getCurrentSession(): Promise<AuthResult> {
  return new Promise((resolve, reject) => {
    const user = pool().getCurrentUser();
    if (!user) { reject(new Error('No current user')); return; }
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) {
        reject(err ?? new Error('Session invalid'));
        return;
      }
      resolve({
        session,
        idToken: session.getIdToken().getJwtToken(),
        accessToken: session.getAccessToken().getJwtToken(),
      });
    });
  });
}

export async function getIdToken(): Promise<string> {
  const { idToken } = await getCurrentSession();
  return idToken;
}

export function getUserAttributes(): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const user = pool().getCurrentUser();
    if (!user) { reject(new Error('No current user')); return; }
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session) { reject(err ?? new Error('No session')); return; }
      user.getUserAttributes((attrErr, attrs) => {
        if (attrErr || !attrs) { reject(attrErr ?? new Error('No attributes')); return; }
        const result: Record<string, string> = {};
        attrs.forEach((a) => { result[a.getName()] = a.getValue(); });
        resolve(result);
      });
    });
  });
}

export function forgotPassword(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    new CognitoUser({ Username: email, Pool: pool() }).forgotPassword({
      onSuccess: () => resolve(),
      onFailure: reject,
    });
  });
}

export function confirmForgotPassword(email: string, code: string, newPassword: string): Promise<void> {
  return new Promise((resolve, reject) => {
    new CognitoUser({ Username: email, Pool: pool() }).confirmPassword(code, newPassword, {
      onSuccess: () => resolve(),
      onFailure: reject,
    });
  });
}
