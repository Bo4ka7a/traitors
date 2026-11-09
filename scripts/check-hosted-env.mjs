const required = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

const missing = required.filter(key => !process.env[key]?.trim());
if (missing.length) {
  console.error("Firebase configuration is required for a hosted build. Missing: " + missing.join(", "));
  process.exitCode = 1;
}

