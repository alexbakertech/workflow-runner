export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getToken, tokenSource, TOKEN_FILE } = await import("./lib/server/token");
  const token = getToken();
  const where = tokenSource() === "env" ? "ACCESS_TOKEN" : TOKEN_FILE;
  console.log(token ? `\n  Access token: ${token}  (from ${where})\n` : `\n  Access token check is off (${process.env.ACCESS_TOKEN?.trim() ? "ACCESS_TOKEN=off" : "dev server"})\n`);
  const { ready } = await import("./lib/server/jobs");
  await ready().catch((e) => console.error("Couldn’t load saved agent jobs:", e));
}
