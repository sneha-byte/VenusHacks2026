/** Plain text for Web Speech API from chat / UI strings. */
export function textForSpeech(content: string): string {
  return content
    .replace(/[•]/g, '')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function pickEnglishVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => v.lang === 'en-US') ??
    voices.find((v) => v.lang.startsWith('en')) ??
    voices[0] ??
    null
  )
}

export function speakText(text: string): void {
  void speakTextAsync(text)
}

export function speakTextAsync(text: string): Promise<void> {
  const spoken = textForSpeech(text)
  if (!spoken || !window.speechSynthesis) return Promise.resolve()

  window.speechSynthesis.cancel()

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(spoken)
    utterance.rate = 0.92
    utterance.lang = 'en-US'
    const voice = pickEnglishVoice()
    if (voice) utterance.voice = voice

    const done = () => resolve()
    utterance.onend = done
    utterance.onerror = done

    window.speechSynthesis.resume()
    window.speechSynthesis.speak(utterance)
  })
}

export async function speakTextsSequentially(texts: string[]): Promise<void> {
  for (const text of texts) {
    const spoken = textForSpeech(text)
    if (!spoken) continue
    await speakTextAsync(spoken)
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
