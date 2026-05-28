import { cognitoConfig } from "../auth/config";

export function ConfigBanner() {
  if (cognitoConfig.isConfigured) return null;
  return (
    <div className="config-banner" role="alert">
      <strong>Cognito not configured.</strong> The UI renders, but sign-up and login
      will fail. Add <code>VITE_COGNITO_USER_POOL_ID</code> and
      <code> VITE_COGNITO_CLIENT_ID</code> to <code>.env.local</code> and restart
      the dev server. See <code>AUTH-SETUP.md</code>.
    </div>
  );
}
