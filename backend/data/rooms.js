// Sample plan-room data. Shapes mirror backend/models/Room.js.

export const classmates = [
  { id: 'rk', name: 'Rachel Koh', short: 'Rachel', initials: 'RK', email: 'rachel.koh.2023@smu.edu.sg', completed: ['IS211', 'COR-IS1704'] },
  { id: 'tm', name: 'Tan Ming', short: 'Tan Ming', initials: 'TM', email: 'ming.tan.2023@smu.edu.sg', completed: ['IS211', 'COR-IS1704'] },
  { id: 'sl', name: 'Sarah Lim', short: 'Sarah', initials: 'SL', email: 'sarah.lim.2023@smu.edu.sg', completed: ['IS211', 'COR-IS1704'] },
  { id: 'jl', name: 'Jun Lee', short: 'Jun', initials: 'JL', email: 'jun.lee.2023@smu.edu.sg', completed: ['COR-IS1704'] },
  { id: 'aw', name: 'Alicia Wong', short: 'Alicia', initials: 'AW', email: 'alicia.wong.2023@smu.edu.sg', completed: ['COR-IS1704'] },
  { id: 'mp', name: 'Marcus Png', short: 'Marcus', initials: 'MP', email: 'marcus.png.2023@smu.edu.sg', completed: ['COR-IS1704'] },
  // Missing the prerequisite for IS442 — triggers the prerequisite ban popup
  { id: 'ct', name: 'Clara Tan', short: 'Clara', initials: 'CT', email: 'clara.tan.2024@smu.edu.sg', completed: [] },
]

// Prerequisites a member must have completed to join a room for a module
export const roomPrereqs = {
  IS442: { code: 'COR-IS1704', name: 'Computational Thinking and Programming' },
}

export const rooms = [
  {
    id: 'A1F3',
    name: 'Yappers',
    description: 'IS Y3 friends planning Y3S2 bids together',
    module: 'IS442',
    maxMembers: 6,
    members: ['me', 'rk', 'tm', 'sl'],
    // section id -> member ids who picked it (excluding the signed-in student)
    votes: { 'IS442-G1': ['rk', 'tm'], 'IS442-G2': ['sl'], 'IS442-G3': [] },
    finalised: null,
  },
  {
    id: '7C20',
    name: 'SCIS Study Squad',
    description: 'BA track people syncing IS428 and IS460 sections',
    module: 'IS442',
    maxMembers: 5,
    members: ['me', 'jl', 'aw'],
    votes: { 'IS442-G1': ['jl'], 'IS442-G2': [], 'IS442-G3': ['aw'] },
    finalised: null,
  },
  {
    id: 'E9B1',
    name: 'Exchange Gang',
    description: 'KAIST + NUS exchange mapping, Y3S1',
    module: 'IS442',
    maxMembers: 4,
    members: ['me', 'mp'],
    votes: { 'IS442-G1': [], 'IS442-G2': ['mp'], 'IS442-G3': [] },
    finalised: null,
  },
]
