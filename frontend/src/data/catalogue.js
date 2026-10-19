// Sample catalogue data used until the frontend is wired to /api/tracks and /api/modules.
// Shapes mirror backend/models/Track.js and backend/models/Module.js.

export const tracks = [
  {
    code: 'BA',
    name: 'Business Analytics',
    short: 'Business Analytics',
    blurb:
      'BA leans on statistics, visualisation and turning results into business recommendations.',
    recommended: ['IS460', 'IS441', 'IS428'],
  },
  {
    code: 'SMT',
    name: 'Smart-City Management & Technology',
    short: 'Smart-City',
    blurb: 'SMT applies sensing, geospatial analytics and systems thinking to urban problems.',
    recommended: ['IS415', 'IS428', 'IS214'],
  },
  {
    code: 'DCS',
    name: 'Digital Cloud Solutioning',
    short: 'Digital Cloud',
    blurb: 'DCS focuses on designing, deploying and operating reliable cloud systems.',
    recommended: ['IS458', 'IS459', 'IS214'],
  },
  {
    code: 'PD',
    name: 'Product Development',
    short: 'Product Development',
    blurb: 'PD centres on understanding users and shipping software products end to end.',
    recommended: ['IS211', 'IS212', 'IS216'],
  },
]

// category: uni-core | major-core | track | depth | free
export const modules = {
  COR1100: { code: 'COR1100', name: 'Managing', category: 'uni-core', prereqs: [], coreqs: [] },
  COR2100: { code: 'COR2100', name: 'Technology, Science & Society', category: 'uni-core', prereqs: [], coreqs: [] },
  COR3001: { code: 'COR3001', name: 'Cultures of the Modern World', category: 'uni-core', prereqs: [], coreqs: [] },
  COR3301: { code: 'COR3301', name: 'Civilisations', category: 'uni-core', prereqs: [], coreqs: [] },
  GEC101: { code: 'GEC101', name: 'General Education I', category: 'free', prereqs: [], coreqs: [] },
  GEC102: { code: 'GEC102', name: 'General Education II', category: 'free', prereqs: [], coreqs: [] },
  HSS210: { code: 'HSS210', name: 'Humanities & Social Sciences Elective', category: 'free', prereqs: [], coreqs: [] },
  'UE elective': { code: 'UE elective', name: 'Unrestricted Elective', category: 'free', prereqs: [], coreqs: [] },
  STAT151: { code: 'STAT151', name: 'Introduction to Statistical Theory', category: 'major-core', prereqs: [], coreqs: [] },
  IS111: { code: 'IS111', name: 'Introduction to Programming', category: 'major-core', prereqs: [], coreqs: [] },
  IS112: { code: 'IS112', name: 'Data Management', category: 'major-core', prereqs: [], coreqs: [] },
  IS113: { code: 'IS113', name: 'Web Application Development I', category: 'major-core', prereqs: ['IS111'], coreqs: [] },
  IS210: { code: 'IS210', name: 'Business Process Analysis', category: 'major-core', prereqs: [], coreqs: [] },
  IS211: { code: 'IS211', name: 'Interaction Design & Prototyping', category: 'major-core', prereqs: [], coreqs: [] },
  IS212: { code: 'IS212', name: 'Software Project Management', category: 'major-core', prereqs: [], coreqs: [] },
  IS213: { code: 'IS213', name: 'Enterprise Solution Development', category: 'major-core', prereqs: ['IS113'], coreqs: [] },
  IS214: { code: 'IS214', name: 'Enterprise Solution Management', category: 'major-core', prereqs: [], coreqs: [] },
  IS215: { code: 'IS215', name: 'Digital Business – Technologies & Transformation', category: 'major-core', prereqs: [], coreqs: [] },
  IS216: { code: 'IS216', name: 'Web Application Development II', category: 'major-core', prereqs: ['IS113'], coreqs: [] },
  IS217: { code: 'IS217', name: 'Analytics Foundation', category: 'track', tracks: ['BA'], prereqs: [], coreqs: [], compulsory: true },
  IS415: { code: 'IS415', name: 'Geospatial Analytics & Applications', category: 'track', tracks: ['SMT'], prereqs: ['IS217'], coreqs: [] },
  IS424: { code: 'IS424', name: 'Data Mining & Business Analytics', category: 'track', tracks: ['BA'], prereqs: ['IS217'], coreqs: [] },
  IS428: { code: 'IS428', name: 'Visual Analytics for Business Intelligence', category: 'track', tracks: ['BA', 'SMT'], prereqs: [], coreqs: [] },
  IS441: { code: 'IS441', name: 'Data Visualisation for Business', category: 'depth', tracks: ['BA'], prereqs: [], coreqs: [] },
  IS442: {
    code: 'IS442',
    name: 'Enterprise Solution Delivery',
    category: 'major-core',
    prereqs: ['IS211'],
    coreqs: ['IS216'],
  },
  IS453: { code: 'IS453', name: 'Financial Analytics', category: 'track', tracks: ['BA'], prereqs: ['IS217'], coreqs: [] },
  IS458: { code: 'IS458', name: 'Cloud Management & Engineering', category: 'track', tracks: ['DCS'], prereqs: [], coreqs: [] },
  IS459: { code: 'IS459', name: 'Big Data Architecture', category: 'track', tracks: ['DCS'], prereqs: [], coreqs: [] },
  IS460: {
    code: 'IS460',
    name: 'Machine Learning & Applications',
    category: 'track',
    tracks: ['BA'],
    prereqs: ['IS217'],
    coreqs: [],
    cu: 1,
    offered: 'Term 1 & 2',
    medianBid: 41,
    description:
      'Covers supervised and unsupervised learning — regression, classification, clustering and model evaluation — applied to real business datasets in Python. Ends with a team project with an industry partner.',
  },
  IS480: { code: 'IS480', name: 'IS Project Experience (Final Year Project)', category: 'major-core', prereqs: [], coreqs: [] },
  IS483: { code: 'IS483', name: 'IS Project Experience (Analytics)', category: 'track', tracks: ['BA'], prereqs: [], coreqs: [] },
}

export function moduleName(code) {
  return modules[code]?.name ?? code
}

export function trackName(code) {
  return tracks.find((t) => t.code === code)?.name ?? code
}

// Requirement buckets shown in the What-If Planner overview table
export const requirementBuckets = [
  { key: 'uni-core', label: 'University Core', required: 6 },
  { key: 'major-core', label: 'IS Major Core', required: 10 },
  { key: 'track', label: 'IS Track #1', required: 4 },
  { key: 'depth', label: 'IS Depth', required: 2 },
  { key: 'free', label: 'Free Electives', required: 6 },
]
