// Degree checklist for BSc (IS), students admitted AY2024 and later.
// Source: details/General Course Progression.xlsx (sheet SCIS_2024_IS).
// TODO(backend): replace with GET /api/degree/requirements once the programme requirements live in the database.
//
// Each slot is one of the 36 courses. Fields:
//   rule    how a module in the plan is matched to the slot (see utils/degreeChecklist.js)
//             codes  -> by module code     basket -> by basket (managing | tss | cmw)
//             track  -> your first track   anyIs  -> any IS track / depth / related course
//             free   -> any SMU course
//   window  [first, last] semester the progression recommends (Y1S1 = Year 1, semester 1)
//   how     PASG = pre-assigned by the school, Bid = you bid for it in BOSS
//   note    pre/co-requisites from the spreadsheet

export const TOTAL_COURSES = 36

// The 8 regular semesters of the degree, in order
export const SEM_IDS = ['Y1S1', 'Y1S2', 'Y2S1', 'Y2S2', 'Y3S1', 'Y3S2', 'Y4S1', 'Y4S2']

// Window for requirements that can be cleared in any term
export const ANY_TERM = ['Y1S1', 'Y4S2']

export const BASKETS = {
  managing: 'Managing',
  tss: 'Technology, Science & Society',
  cmw: 'Cultures of the Modern World',
}

export const HOW = {
  PASG: 'Pre-assigned course',
  Bid: 'Bid for it in BOSS',
  'PASG+Bid': 'Pre-assigned, or bid for it',
}

export const degreeGroups = [
  {
    key: 'uni-cap',
    label: 'University Core · Capabilities',
    slots: [
      { id: 'managing-1', label: 'Managing Elective 1', code: 'COR1305', title: 'Modeling and Data Analytics', rule: 'codes', codes: ['COR1305'], window: ['Y1S1', 'Y2S2'] },
      { id: 'managing-2', label: 'Managing Elective 2', rule: 'basket', basket: 'managing', window: ['Y1S1', 'Y4S1'] },
      // IS111 is the stand-in used by the sample catalogue
      { id: 'modes', label: 'Modes of Thinking', code: 'COR-IS1704', title: 'Computational Thinking and Programming', rule: 'codes', codes: ['COR-IS1704', 'IS111'], window: ['Y1S1', 'Y1S1'], how: 'PASG' },
      // STAT151 is the stand-in used by the sample catalogue
      { id: 'numeracy', label: 'Numeracy', title: 'Introductory Statistics', rule: 'codes', codes: ['STAT151'], window: ['Y1S1', 'Y2S2'] },
      { id: 'writing', label: 'Writing and Reasoning', rule: 'codes', codes: [], window: ['Y1S1', 'Y1S2'], how: 'PASG' },
      { id: 'internship', label: 'Internship', title: 'After Year 2, summer or term time', rule: 'codes', codes: [], window: ['Y3S1', 'Y4S1'] },
    ],
  },
  {
    key: 'uni-com',
    label: 'University Core · Communities',
    slots: [
      { id: 'economics', label: 'Economics and Society', rule: 'codes', codes: [], window: ['Y1S1', 'Y1S2'], how: 'PASG' },
      { id: 'tss', label: 'Technology, Science & Society Elective', rule: 'basket', basket: 'tss', window: ['Y1S1', 'Y4S1'] },
      { id: 'cmw', label: 'Cultures of the Modern World Elective', rule: 'basket', basket: 'cmw', window: ['Y1S1', 'Y4S1'] },
      { id: 'community', label: 'Community Service', title: 'Anytime, summer or December', rule: 'codes', codes: [], window: ['Y1S1', 'Y4S2'] },
    ],
  },
  {
    key: 'uni-civ',
    label: 'University Core · Civilisations',
    slots: [
      { id: 'ethics', label: 'Ethics and Social Responsibility', rule: 'codes', codes: [], window: ['Y3S1', 'Y4S2'] },
      { id: 'big-questions', label: 'Big Questions', rule: 'codes', codes: [], window: ['Y1S1', 'Y1S2'], how: 'PASG' },
    ],
  },
  {
    key: 'major-core',
    label: 'IS Major Core',
    slots: [
      { id: 'is114', label: 'Computing Fundamentals', code: 'IS114', rule: 'codes', codes: ['IS114'], window: ['Y1S1', 'Y1S1'], how: 'PASG', note: 'Co-req: IS111 / SMT111 / CS101 / COR-IS1704' },
      { id: 'is112', label: 'Data Management', code: 'IS112', rule: 'codes', codes: ['IS112'], window: ['Y1S2', 'Y1S2'], how: 'PASG' },
      { id: 'is113', label: 'Web Application Development I', code: 'IS113', rule: 'codes', codes: ['IS113'], window: ['Y1S2', 'Y1S2'], how: 'PASG', note: 'Pre-req: CS101 / COR-IS1704 · Co-req: IS112 / IS105' },
      { id: 'is115', label: 'Algorithms & Programming', code: 'IS115', rule: 'codes', codes: ['IS115'], window: ['Y1S2', 'Y2S1'], how: 'PASG+Bid', note: 'Pre-req: CS101 / COR-IS1704' },
      { id: 'is216', label: 'Web Application Development II', code: 'IS216', rule: 'codes', codes: ['IS216'], window: ['Y2S1', 'Y2S1'], how: 'PASG', note: 'Pre-req: IS113 / CS203' },
      { id: 'is210', label: 'Business Process Analysis & Solutioning', code: 'IS210', rule: 'codes', codes: ['IS210'], window: ['Y2S1', 'Y2S1'], how: 'Bid' },
      { id: 'is211', label: 'Interaction Design & Prototyping', code: 'IS211', rule: 'codes', codes: ['IS211'], window: ['Y2S1', 'Y2S1'], how: 'Bid' },
      { id: 'is213', label: 'Enterprise Solution Development', code: 'IS213', rule: 'codes', codes: ['IS213'], window: ['Y2S2', 'Y2S2'], how: 'PASG', note: 'Co-req: IS112 / IS105 & IS113' },
      { id: 'is214', label: 'Enterprise Solution Management', code: 'IS214', rule: 'codes', codes: ['IS214'], window: ['Y2S2', 'Y2S2'], how: 'Bid' },
      { id: 'is215', label: 'Digital Business Technology & Transformation', code: 'IS215', rule: 'codes', codes: ['IS215'], window: ['Y2S2', 'Y2S2'], how: 'Bid', note: 'Pre-req: IS111 / CS101 / COR-IS1704' },
      { id: 'is212', label: 'Software Project Management', code: 'IS212', rule: 'codes', codes: ['IS212'], window: ['Y3S1', 'Y3S1'], how: 'Bid', note: 'Pre-req: IS112 / IS105 & IS113' },
      // IS480 is the stand-in used by the sample catalogue
      { id: 'project', label: 'Project Experience', code: 'IS483 / 484 / 485', rule: 'codes', codes: ['IS483', 'IS484', 'IS485', 'IS480'], window: ['Y3S2', 'Y4S1'], note: 'Pre-req: 1 IS Track Course · Co-req: IS212 & 1 IS Track Course' },
    ],
  },
  {
    key: 'major-elective',
    label: 'IS Major Electives',
    slots: [
      { id: 'track-1', label: 'IS Track Course 1', rule: 'track', window: ['Y2S1', 'Y3S1'] },
      { id: 'track-2', label: 'IS Track Course 2', rule: 'track', window: ['Y2S1', 'Y3S1'] },
      { id: 'track-3', label: 'IS Track Course 3', rule: 'track', window: ['Y3S1', 'Y4S2'] },
      { id: 'track-4', label: 'IS Track Course 4', rule: 'track', window: ['Y3S1', 'Y4S2'] },
      { id: 'any-is-1', label: 'Any IS Track Course / IS Depth Elective / ISRC', rule: 'anyIs', window: ['Y3S1', 'Y4S2'] },
      { id: 'any-is-2', label: 'Any IS Track Course / IS Depth Elective / ISRC', rule: 'anyIs', window: ['Y3S1', 'Y4S2'] },
    ],
  },
  {
    key: 'free',
    label: 'Free Electives',
    slots: [1, 2, 3, 4, 5, 6].map((n) => ({ id: `free-${n}`, label: `SMU Course ${n}`, rule: 'free', window: ['Y2S2', 'Y4S2'] })),
  },
]

// Graduation requirements. A module can count towards these and a degree requirement at the same time.
// Digital Technology / Data Analytics is auto-fulfilled for SCIS students.
export const gradRequirements = [
  { key: 'digital', label: 'Digital Technology / Data Analytics', auto: true, detail: 'Auto-fulfilled for SCIS students' },
  { key: 'sustainability', label: 'Sustainability', detail: 'Any course with the "Grad - Sustainability (2024)" attribute' },
  { key: 'sg-asia', label: 'Singapore and Asia Studies', detail: 'Any course with the "Grad - SG & Asia Studies" attribute' },
]

// Recommended: exchange in Y3 semester 2 or Y4 semester 1
export const globalExposure = { label: 'Global Exposure', window: ['Y2S1', 'Y4S1'], detail: 'Recommended exchange in Y3S2 or Y4S1' }

export const GRAD_LABELS = { sustainability: 'Sustainability', 'sg-asia': 'Singapore & Asia Studies' }
