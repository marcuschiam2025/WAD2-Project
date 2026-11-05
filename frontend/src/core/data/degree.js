// When the course progression recommends each course, for BSc (IS) students admitted AY2024 and later.
// Source: SMU's "General Course Progression" spreadsheet (sheet SCIS_2024_IS), copied in by hand. The file itself is no longer
// in the repo; it is still in the git history (frontend/details/General Course Progression.xlsx) if the numbers need checking.
// The backend's curriculum decides what is required. It stores no semester recommendations, so they come from here
// (see utils/curriculumLayout.js).
// TODO(backend): move the recommended semesters into the curriculum.

// The 8 regular semesters of the degree, in order
export const SEM_IDS = ['Y1S1', 'Y1S2', 'Y2S1', 'Y2S2', 'Y3S1', 'Y3S2', 'Y4S1', 'Y4S2'];

// Window for requirements that can be cleared in any term
export const ANY_TERM = ['Y1S1', 'Y4S2'];

// Each slot is one of the 36 courses. Fields:
//   rule    which requirements the window applies to
//             codes  -> by module code or tag     basket -> by basket (managing | tss | cmw)
//             track  -> track courses             anyIs  -> IS electives     free -> free electives
//   tag     (optional) the catalogue tag the slot stands for, e.g. CORE:ETHICS
//   window  [first, last] semester the progression recommends (Y1S1 = Year 1, semester 1)
//   how     (not displayed yet) PASG = pre-assigned by the school, Bid = you bid for it in BOSS
//   note    (not displayed yet) pre/co-requisites from the spreadsheet
export const degreeGroups = [
  {
    key: 'uni-cap',
    slots: [
      { id: 'managing-1', rule: 'codes', codes: ['COR1305'], window: ['Y1S1', 'Y2S2'] },
      { id: 'managing-2', rule: 'basket', basket: 'managing', window: ['Y1S1', 'Y4S1'] },
      { id: 'modes', rule: 'codes', codes: ['COR-IS1704', 'IS111'], window: ['Y1S1', 'Y1S1'], how: 'PASG' },
      { id: 'numeracy', rule: 'codes', codes: ['COR-STAT1202', 'COR-STAT1203'], window: ['Y1S1', 'Y2S2'] },
      {
        id: 'writing',
        rule: 'codes',
        codes: [],
        tag: 'CORE:WRITING_REASONING',
        window: ['Y1S1', 'Y1S2'],
        how: 'PASG',
      },
      { id: 'internship', rule: 'codes', codes: [], tag: 'CORE:INTERNSHIP', window: ['Y3S1', 'Y4S1'] },
    ],
  },
  {
    key: 'uni-com',
    slots: [
      {
        id: 'economics',
        rule: 'codes',
        codes: [],
        tag: 'CORE:ECON_SOCIETY',
        window: ['Y1S1', 'Y1S2'],
        how: 'PASG',
      },
      { id: 'tss', rule: 'basket', basket: 'tss', window: ['Y1S1', 'Y4S1'] },
      { id: 'cmw', rule: 'basket', basket: 'cmw', window: ['Y1S1', 'Y4S1'] },
      { id: 'community', rule: 'codes', codes: [], window: ['Y1S1', 'Y4S2'] },
    ],
  },
  {
    key: 'uni-civ',
    slots: [
      { id: 'ethics', rule: 'codes', codes: [], tag: 'CORE:ETHICS', window: ['Y3S1', 'Y4S2'] },
      {
        id: 'big-questions',
        rule: 'codes',
        codes: [],
        tag: 'CORE:BIG_QUESTIONS',
        window: ['Y1S1', 'Y1S2'],
        how: 'PASG',
      },
    ],
  },
  {
    key: 'major-core',
    slots: [
      {
        id: 'is114',
        rule: 'codes',
        codes: ['IS114'],
        window: ['Y1S1', 'Y1S1'],
        how: 'PASG',
        note: 'Co-req: IS111 / SMT111 / CS101 / COR-IS1704',
      },
      { id: 'is112', rule: 'codes', codes: ['IS112'], window: ['Y1S2', 'Y1S2'], how: 'PASG' },
      {
        id: 'is113',
        rule: 'codes',
        codes: ['IS113'],
        window: ['Y1S2', 'Y1S2'],
        how: 'PASG',
        note: 'Pre-req: CS101 / COR-IS1704 · Co-req: IS112 / IS105',
      },
      {
        id: 'is115',
        rule: 'codes',
        codes: ['IS115'],
        window: ['Y1S2', 'Y2S1'],
        how: 'PASG+Bid',
        note: 'Pre-req: CS101 / COR-IS1704',
      },
      {
        id: 'is216',
        rule: 'codes',
        codes: ['IS216'],
        window: ['Y2S1', 'Y2S1'],
        how: 'PASG',
        note: 'Pre-req: IS113 / CS203',
      },
      { id: 'is210', rule: 'codes', codes: ['IS210'], window: ['Y2S1', 'Y2S1'], how: 'Bid' },
      { id: 'is211', rule: 'codes', codes: ['IS211'], window: ['Y2S1', 'Y2S1'], how: 'Bid' },
      {
        id: 'is213',
        rule: 'codes',
        codes: ['IS213'],
        window: ['Y2S2', 'Y2S2'],
        how: 'PASG',
        note: 'Co-req: IS112 / IS105 & IS113',
      },
      { id: 'is214', rule: 'codes', codes: ['IS214'], window: ['Y2S2', 'Y2S2'], how: 'Bid' },
      {
        id: 'is215',
        rule: 'codes',
        codes: ['IS215'],
        window: ['Y2S2', 'Y2S2'],
        how: 'Bid',
        note: 'Pre-req: IS111 / CS101 / COR-IS1704',
      },
      {
        id: 'is212',
        rule: 'codes',
        codes: ['IS212'],
        window: ['Y3S1', 'Y3S1'],
        how: 'Bid',
        note: 'Pre-req: IS112 / IS105 & IS113',
      },
      {
        id: 'project',
        rule: 'codes',
        codes: ['IS483', 'IS484', 'IS485', 'IS480'],
        window: ['Y3S2', 'Y4S1'],
        note: 'Pre-req: 1 IS Track Course · Co-req: IS212 & 1 IS Track Course',
      },
    ],
  },
  {
    key: 'major-elective',
    slots: [
      { id: 'track-1', rule: 'track', window: ['Y2S1', 'Y3S1'] },
      { id: 'track-2', rule: 'track', window: ['Y2S1', 'Y3S1'] },
      { id: 'track-3', rule: 'track', window: ['Y3S1', 'Y4S2'] },
      { id: 'track-4', rule: 'track', window: ['Y3S1', 'Y4S2'] },
      { id: 'any-is-1', rule: 'anyIs', window: ['Y3S1', 'Y4S2'] },
      { id: 'any-is-2', rule: 'anyIs', window: ['Y3S1', 'Y4S2'] },
    ],
  },
  {
    key: 'free',
    slots: [1, 2, 3, 4, 5, 6].map((n) => ({ id: `free-${n}`, rule: 'free', window: ['Y2S2', 'Y4S2'] })),
  },
];

// Recommended semesters of courses that only another major's progression places (sheets SCIS_2024_SE, SCIS_2024-2025_CS, SCIS_2026_CS, SCIS_2024_C&L, SCIS_2023_SMT), by major code.
// Kept apart from degreeGroups, whose windows are the IS progression's.
export const majorCourseWindows = {
  'BSC-CS': {
    COR1201: ['Y1S1', 'Y1S1'],
    CS101: ['Y1S1', 'Y1S1'],
    IS211: ['Y1S1', 'Y1S1'],
    CS104: ['Y1S1', 'Y1S1'],
    CS102: ['Y1S2', 'Y1S2'],
    CS105: ['Y1S2', 'Y1S2'],
    IS112: ['Y1S2', 'Y1S2'],
    CS106: ['Y1S2', 'Y1S2'],
    CS103: ['Y2S1', 'Y2S1'],
    CS201: ['Y2S1', 'Y2S1'],
    CS203: ['Y2S1', 'Y2S1'],
    CS205: ['Y2S1', 'Y2S1'],
    CS202: ['Y2S2', 'Y2S2'],
    CS204: ['Y2S2', 'Y2S2'],
    CS206: ['Y2S2', 'Y2S2'],
    CS420: ['Y2S2', 'Y2S2'],
    CS301: ['Y3S1', 'Y3S1'],
    CS302: ['Y3S1', 'Y3S1'],
    CS480: ['Y3S2', 'Y4S1'],
  },
  'BSC-CL': {
    'COR-IS1704': ['Y1S1', 'Y1S1'],
    COR1201: ['Y1S1', 'Y1S1'],
    IS115: ['Y2S1', 'Y2S1'],
    IS112: ['Y1S2', 'Y1S2'],
    IS113: ['Y1S2', 'Y1S2'],
    CS105: ['Y2S2', 'Y2S2'],
    IS210: ['Y2S1', 'Y2S1'],
    IS215: ['Y2S2', 'Y2S2'],
    IS211: ['Y2S1', 'Y2S1'],
    CS206: ['Y3S1', 'Y3S1'],
    LAW101_601: ['Y1S1', 'Y1S1'],
    LGST102: ['Y1S1', 'Y1S1'],
    LAW102_602: ['Y1S2', 'Y1S2'],
    LAW103_603: ['Y1S2', 'Y1S2'],
    LAW105_605: ['Y2S1', 'Y2S1'],
    LAW401: ['Y2S2', 'Y2S2'],
    LAW201_621: ['Y3S1', 'Y3S1'],
    LAW486: ['Y3S1', 'Y3S1'],
    IS483: ['Y3S2', 'Y4S1'],
    IS484: ['Y3S2', 'Y4S1'],
    IS485: ['Y3S2', 'Y4S1'],
  },
  'BSC-SMT': {
    'COR-IS1702': ['Y1S2', 'Y1S2'],
    'COR-STAT1202': ['Y1S1', 'Y1S1'],
    COR1100: ['Y1S2', 'Y1S2'],
    SMT113: ['Y1S1', 'Y1S1'],
    IS114: ['Y1S1', 'Y1S1'],
    IS111: ['Y1S1', 'Y1S1'],
    IS112: ['Y1S2', 'Y1S2'],
    IS217: ['Y1S2', 'Y1S2'],
    POSC101: ['Y2S1', 'Y2S1'],
    IS211: ['Y2S1', 'Y2S1'],
    SMT201: ['Y2S2', 'Y2S2'],
    SMT203: ['Y2S2', 'Y2S2'],
    IS113: ['Y2S2', 'Y2S2'],
    IS212: ['Y3S1', 'Y3S1'],
    SMT481: ['Y3S1', 'Y3S1'],
    IS483: ['Y3S2', 'Y4S2'],
    IS484: ['Y3S2', 'Y4S2'],
    IS485: ['Y3S2', 'Y4S2'],
  },
  'BSC-SE': {
    SE101: ['Y1S1', 'Y1S1'],
    CS440: ['Y2S1', 'Y2S1'],
    CS102: ['Y2S1', 'Y2S1'],
    CS203: ['Y2S2', 'Y2S2'],
    CS301: ['Y3S1', 'Y3S1'],
    SE301: ['Y3S1', 'Y3S1'],
    SE401: ['Y3S2', 'Y4S2'],
  },
};

// Recommended: exchange in Y3 semester 2 or Y4 semester 1
export const globalExposure = { window: ['Y2S1', 'Y4S1'] };

// Checklist lines done outside of modules, which the student can mark as done themselves (checklist line id -> label)
export const MARK_DONE = {
  internship: 'Internship',
  community: 'Community Service',
  exposure: 'Global Exposure',
};
