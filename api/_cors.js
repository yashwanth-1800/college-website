const ALLOWED_ORIGINS = new Set([
  "https://campus-emergency-response.vercel.app",
  "https://yashwanth-1800.github.io",
]);

export function allowWebClient(request, response) {
  const origin = request.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return true;
  }
  return false;
}

