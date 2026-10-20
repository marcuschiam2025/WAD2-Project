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
    code: 'FT',
    name: 'Financial Technology',
    short: 'Fintech',
    blurb: 'FT applies software and analytics to payments, banking and financial services.',
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
// basket (optional): managing | tss | cmw — which uni-core elective basket the module belongs to
// grad (optional): graduation requirements it also counts for — sustainability | sg-asia
// TODO(backend): basket and grad come from the course attributes ("Grad - Sustainability (2024)" etc.)
export const modules = {
  COR1100: { code: 'COR1100', name: 'Managing', category: 'uni-core', basket: 'managing', prereqs: [], coreqs: [] },
  COR2100: { code: 'COR2100', name: 'Technology, Science & Society', category: 'uni-core', basket: 'tss', grad: ['sustainability'], prereqs: [], coreqs: [] },
  COR3001: { code: 'COR3001', name: 'Cultures of the Modern World', category: 'uni-core', basket: 'cmw', grad: ['sg-asia'], prereqs: [], coreqs: [] },
  COR3301: { code: 'COR3301', name: 'Civilisations', category: 'uni-core', prereqs: [], coreqs: [] },
  // Sample basket electives, only here so the degree checklist has options to list.
  // TODO(backend): replace with the real Managing / TSS / CMW basket modules (GET /api/modules?basket=...)
  MGMT101: { code: 'MGMT101', name: 'Organisational Behaviour', category: 'uni-core', basket: 'managing', prereqs: [], coreqs: [] },
  MGMT102: { code: 'MGMT102', name: 'Managing Innovation', category: 'uni-core', basket: 'managing', prereqs: [], coreqs: [] },
  MGMT103: { code: 'MGMT103', name: 'Leading Teams', category: 'uni-core', basket: 'managing', prereqs: [], coreqs: [] },
  MGMT104: { code: 'MGMT104', name: 'Business Negotiation', category: 'uni-core', basket: 'managing', prereqs: [], coreqs: [] },
  TSS101: { code: 'TSS101', name: 'Artificial Intelligence & Society', category: 'uni-core', basket: 'tss', prereqs: [], coreqs: [] },
  TSS102: { code: 'TSS102', name: 'Climate, Technology & Policy', category: 'uni-core', basket: 'tss', grad: ['sustainability'], prereqs: [], coreqs: [] },
  TSS103: { code: 'TSS103', name: 'Data, Privacy & Ethics', category: 'uni-core', basket: 'tss', prereqs: [], coreqs: [] },
  TSS104: { code: 'TSS104', name: 'The Future of Work', category: 'uni-core', basket: 'tss', prereqs: [], coreqs: [] },
  CMW101: { code: 'CMW101', name: 'Modern Southeast Asia', category: 'uni-core', basket: 'cmw', grad: ['sg-asia'], prereqs: [], coreqs: [] },
  CMW102: { code: 'CMW102', name: 'Art, Culture & Society', category: 'uni-core', basket: 'cmw', prereqs: [], coreqs: [] },
  CMW103: { code: 'CMW103', name: 'Global Religions', category: 'uni-core', basket: 'cmw', prereqs: [], coreqs: [] },
  CMW104: { code: 'CMW104', name: 'Singapore: A Modern History', category: 'uni-core', basket: 'cmw', grad: ['sg-asia'], prereqs: [], coreqs: [] },
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
  IS458: { code: 'IS458', name: 'Cloud Management & Engineering', category: 'track', tracks: ['FT'], prereqs: [], coreqs: [] },
  IS459: { code: 'IS459', name: 'Big Data Architecture', category: 'track', tracks: ['FT'], prereqs: [], coreqs: [] },
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
