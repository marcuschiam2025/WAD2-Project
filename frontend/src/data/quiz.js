// Sample Track Finder questions. Each option carries per-track weights,
// matching backend/models/QuizQuestion.js. Replace with GET /api/quiz/questions.

export const questions = [
  {
    id: 1,
    prompt: 'What do you most enjoy learning about?',
    options: [
      { label: 'Finding patterns in data', weights: { BA: 3, SMT: 1 } },
      { label: 'Understanding how people use products', weights: { PD: 3 } },
      { label: 'Designing reliable technical systems', weights: { DCS: 3 } },
      { label: 'Solving challenges in cities', weights: { SMT: 3, BA: 1 } },
    ],
  },
  {
    id: 2,
    prompt: 'Which group project role do you usually pick?',
    options: [
      { label: 'The analyst who crunches the numbers', weights: { BA: 3 } },
      { label: 'The designer who sketches the user flow', weights: { PD: 3 } },
      { label: 'The engineer who sets up the backend', weights: { DCS: 3 } },
      { label: 'The researcher who frames the real-world problem', weights: { SMT: 2, PD: 1 } },
    ],
  },
  {
    id: 3,
    prompt: 'Which assignment sounds the most fun?',
    options: [
      { label: 'Build a dashboard that predicts sales', weights: { BA: 3 } },
      { label: 'Map traffic flows across Singapore', weights: { SMT: 3 } },
      { label: 'Deploy an app that scales to 10,000 users', weights: { DCS: 3 } },
      { label: 'Prototype and test a new mobile app', weights: { PD: 3 } },
    ],
  },
  {
    id: 4,
    prompt: 'Which of these do you feel strongest in?',
    options: [
      { label: 'Statistics and spreadsheets', weights: { BA: 3 } },
      { label: 'Programming and debugging', weights: { DCS: 2, PD: 1 } },
      { label: 'Communicating with users and stakeholders', weights: { PD: 2, SMT: 1 } },
      { label: 'Seeing the big picture across systems', weights: { SMT: 2, DCS: 1 } },
    ],
  },
  {
    id: 5,
    prompt: 'How do you like to work?',
    options: [
      { label: 'Deep focus on a hard analytical question', weights: { BA: 2, DCS: 1 } },
      { label: 'Fast iterations with lots of feedback', weights: { PD: 3 } },
      { label: 'Careful planning before building', weights: { DCS: 2, SMT: 1 } },
      { label: 'Field work and talking to the public', weights: { SMT: 3 } },
    ],
  },
  {
    id: 6,
    prompt: 'Which internship would you apply for first?',
    options: [
      { label: 'Data analyst at a bank', weights: { BA: 3 } },
      { label: 'Cloud engineer at a tech firm', weights: { DCS: 3 } },
      { label: 'Product intern at a startup', weights: { PD: 3 } },
      { label: 'Urban tech intern at a government agency', weights: { SMT: 3 } },
    ],
  },
  {
    id: 7,
    prompt: 'What kind of result makes you proudest?',
    options: [
      { label: 'An insight that changed a decision', weights: { BA: 3 } },
      { label: 'A system that never goes down', weights: { DCS: 3 } },
      { label: 'A feature people love using', weights: { PD: 3 } },
      { label: 'A measurable improvement to a community', weights: { SMT: 3 } },
    ],
  },
  {
    id: 8,
    prompt: 'Where do you see yourself in five years?',
    options: [
      { label: 'Leading an analytics team', weights: { BA: 3 } },
      { label: 'Architecting cloud platforms', weights: { DCS: 3 } },
      { label: 'Running my own product', weights: { PD: 3 } },
      { label: 'Shaping smart-city policy', weights: { SMT: 3 } },
    ],
  },
]

// Score answers into % fit per track (weighted sum normalised by the best possible score).
// Kept in sync with backend/utils/trackScoring.js.
export function scoreAnswers(answers) {
  const totals = {}
  const max = {}
  questions.forEach((q, i) => {
    const trackCodes = new Set(q.options.flatMap((o) => Object.keys(o.weights)))
    trackCodes.forEach((code) => {
      max[code] = (max[code] ?? 0) + Math.max(...q.options.map((o) => o.weights[code] ?? 0))
    })
    const picked = q.options[answers[i]]
    if (!picked) return
    Object.entries(picked.weights).forEach(([code, w]) => {
      totals[code] = (totals[code] ?? 0) + w
    })
  })
  return Object.keys(max)
    .map((code) => ({ code, pct: Math.round(((totals[code] ?? 0) / max[code]) * 100) }))
    .sort((a, b) => b.pct - a.pct)
}
