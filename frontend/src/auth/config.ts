const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID as string | undefined;
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID as string | undefined;
const region = (import.meta.env.VITE_AWS_REGION as string | undefined) ?? "ap-southeast-2";

const isConfigured = Boolean(
  userPoolId && clientId && userPoolId.includes("_") && clientId.length >= 20
);

export const cognitoConfig = {
  userPoolId: userPoolId ?? "",
  clientId: clientId ?? "",
  region,
  isConfigured,
} as const;
