/** Hardcoded UCI post-course Google Form — no backend. */

export const UCI_FORM_ID =
  '1FAIpQLSd3CaLvPVyIIKrhzFDCzdI-8W1HbV9MdBUG0qty_9xT6ZmzGQ'

export type GuidedQuestionType = 'text' | 'yesno' | 'scale' | 'choice'

export type GuidedQuestion = {
  id: string
  prompt: string
  type: GuidedQuestionType
  required?: boolean
  options?: string[]
  hint?: string
}

export const UCI_FORM_TITLE = 'How are you feeling? (Post-Course Survey)'

export const UCI_FORM_INTRO =
  'Congratulations on completing your first-year experience course! I will ask each question one at a time. Answer in the box below and press Send.'

export const UCI_FORM_QUESTIONS: GuidedQuestion[] = [
  {
    id: 'email',
    prompt: 'What is your email address?',
    type: 'text',
    required: true,
    hint: 'Use the same email you used before the course, if you have one.',
  },
  {
    id: 'research_consent',
    prompt:
      'Do you agree that your responses to this survey (without your name) can be used for research purposes?',
    type: 'yesno',
    required: true,
  },
  {
    id: 'academic_confidence',
    prompt: 'How confident are you in your ability to succeed academically at UCI?',
    type: 'scale',
    required: true,
    options: ['1 — Not at all confident', '2', '3', '4', '5 — Very confident'],
  },
  {
    id: 'stress',
    prompt:
      'How nervous or stressed do you feel about starting your academic journey at UCI?',
    type: 'scale',
    required: true,
    options: ['1 — Not nervous or stressed at all', '2', '3', '4', '5 — Very nervous and stressed'],
  },
  {
    id: 'resources_confidence',
    prompt:
      "How confident do you feel about navigating the university's resources and support systems?",
    type: 'scale',
    required: true,
    options: ['1 — Not at all confident', '2', '3', '4', '5 — Very confident'],
  },
  {
    id: 'skills_understanding',
    prompt: 'How well do you understand the skills needed for academic success at UCI?',
    type: 'scale',
    required: true,
    options: ['1 — Not at all', '2', '3', '4', '5 — Very well'],
  },
  {
    id: 'time_management',
    prompt: 'How prepared do you feel to manage your time effectively as a university student?',
    type: 'scale',
    required: true,
    options: ['1 — Not at all', '2', '3', '4', '5 — Very prepared'],
  },
  {
    id: 'goals_comfort',
    prompt:
      'How comfortable do you feel with setting and achieving academic and personal goals?',
    type: 'scale',
    required: true,
    options: ['1 — Not at all comfortable', '2', '3', '4', '5 — Very comfortable'],
  },
  {
    id: 'overall_experience',
    prompt: 'How would you describe your overall experience with this first-year online seminar course?',
    type: 'choice',
    required: true,
    options: ['Very Poor', 'Poor', 'Fair', 'Good', 'Excellent'],
  },
  {
    id: 'organization',
    prompt: 'How well organized and structured was the course overall?',
    type: 'choice',
    required: true,
    options: [
      'Poorly organized',
      'Not well organized',
      'Neutral',
      'Well organized',
      'Very well organized',
    ],
  },
  {
    id: 'assignments_helpful',
    prompt:
      'Were the assignments, readings, and activities helpful in achieving the course objectives?',
    type: 'choice',
    required: true,
    options: [
      'Not at all helpful',
      'Not very helpful',
      'Neutral',
      'Helpful',
      'Very helpful',
    ],
  },
  {
    id: 'additional_feedback',
    prompt:
      'Any additional feedback about your experience? Was the course helpful for UCI? Suggestions to improve it?',
    type: 'text',
    required: false,
    hint: 'You can type "skip" if you have nothing to add.',
  },
]

export const UCI_FORM_URL = `https://docs.google.com/forms/d/e/${UCI_FORM_ID}/viewform`

export function isUciPostCourseFormUrl(text: string): boolean {
  return text.includes(UCI_FORM_ID) || text.includes('docs.google.com/forms')
}
