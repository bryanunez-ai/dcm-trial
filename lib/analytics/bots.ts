/**
 * User-agent based bot filtering.
 *
 * This is the weakest guard in the collector and it is worth being honest about why it is still
 * here: it removes the overwhelming bulk of crawler traffic — which would otherwise make every
 * chart wrong — while catching none of the traffic that is actively pretending not to be a bot.
 * There is no reverse DNS and no behavioural detection. A determined non-browser client is not
 * addressed by this and is documented as a known limitation instead of being papered over.
 */
const BOT_PATTERN =
  /(bot|crawl|spider|slurp|scrape|search|preview|fetch|monitor|uptime|ping|check|validator|scanner|analyz|index|archiv|curl|wget|python-requests|node-fetch|axios|okhttp|httpclient|libwww|java\/|go-http|headless|phantom|puppeteer|playwright|selenium|lighthouse|pagespeed|gtmetrix|semrush|ahrefs|mj12|dotbot|bytespider|facebookexternalhit|whatsapp|telegram|slackbot|discord|embedly|quora|pinterest|redditbot|linkedinbot|twitterbot|applebot|petalbot|yandex|baidu|sogou|duckduck|bingpreview|chatgpt|gptbot|claudebot|anthropic|perplexity|ccbot)/i;

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true; // A pageview beacon from a real browser always sends one.
  return BOT_PATTERN.test(userAgent);
}
