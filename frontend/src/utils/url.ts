/** First http(s) URL in text (trailing punctuation trimmed). */
export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"']+/i)
  if (!match) return null
  return match[0].replace(/[.,;:!?)]+$/g, '')
}

export function previewLabelForUrl(url: string): string {
  try {
    const { hostname, pathname } = new URL(url)
    if (hostname.includes('docs.google.com') && pathname.includes('/forms/')) {
      return 'Google Form'
    }
    return hostname
  } catch {
    return 'Website'
  }
}

/** Google Forms/Docs block iframe embeds — use live stream or open in a new tab. */
export function isLikelyIframeBlocked(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url)
    if (hostname === 'docs.google.com' || hostname.endsWith('.docs.google.com')) {
      return true
    }
    if (hostname.includes('google.com') && pathname.includes('/forms/')) {
      return true
    }
    return false
  } catch {
    return false
  }
}
