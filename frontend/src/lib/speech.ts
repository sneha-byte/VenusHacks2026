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
  const spoken = textForSpeech(text)
  if (!spoken || !window.speechSynthesis) return

  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(spoken)
  utterance.rate = 0.92
  utterance.lang = 'en-US'
  const voice = pickEnglishVoice()
  if (voice) utterance.voice = voice

  // Chrome can pause the queue until resume() is called.
  window.speechSynthesis.resume()
  window.speechSynthesis.speak(utterance)
}
