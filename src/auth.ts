function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(
      `Error: Missing required environment variable: ${name}\n` +
        "  GEMINI_API_KEY is required.\n" +
        "  Get your API key at: https://aistudio.google.com/apikey"
    );
    process.exit(1);
  }
  return value;
}

export const API_KEY = getRequiredEnv("GEMINI_API_KEY");
export const BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta";
