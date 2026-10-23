// Turns BOSS requisite text into the shape we store in the database.
//
// Requisites are stored as AND-of-OR groups:
//   [["IS111", "CS101"], ["IS217"]]  means  (IS111 or CS101) and IS217
// Every group must be met, and a group is met by any one course in it.

// A full course code: IS217, COR-STAT1202, ACCT201A. The part before the digits is the subject.
const FULL_CODE = /^([A-Z]+(?:-[A-Z]+)?)\d+[A-Z]?$/

// A short code like "103" in "ACCT101/103", which reuses the subject of the code before it
const SHORT_CODE = /^\d{3,4}[A-Z]?$/

function isOperator(token) {
  return token === '/' || token === '&'
}

function isSymbol(token) {
  return token === '(' || token === ')' || isOperator(token)
}

// Step 1: split the text into tokens, e.g. "IS111/(CS101&201)" -> IS111 / ( CS101 & CS201 )
function tokenize(text, subject) {
  const rawTokens = text.toUpperCase().match(/[()/&]|[A-Z0-9-]+/g) ?? []
  let currentSubject = subject
  const tokens = []

  for (const token of rawTokens) {
    if (isSymbol(token)) {
      tokens.push(token)
      continue
    }

    const fullMatch = token.match(FULL_CODE)
    if (fullMatch) {
      // Remember the subject so a following short code can reuse it
      currentSubject = fullMatch[1]
      tokens.push(token)
    } else if (SHORT_CODE.test(token) && currentSubject) {
      tokens.push(currentSubject + token)
    }
    // Anything else (words, a stray "5") is dropped
  }

  // A dropped token can leave a dangling operator behind ("CS103&&CS201").
  // Keep an operator only when it sits between two operands.
  const cleaned = []
  for (const token of tokens) {
    const last = cleaned[cleaned.length - 1]

    if (isOperator(token)) {
      const followsOperand = last !== undefined && !isOperator(last) && last !== '('
      if (followsOperand) {
        cleaned.push(token)
      }
    } else {
      if (token === ')' && isOperator(last)) {
        cleaned.pop()
      }
      cleaned.push(token)
    }
  }
  if (isOperator(cleaned[cleaned.length - 1])) {
    cleaned.pop()
  }

  return cleaned
}

// Step 2: turn the tokens into a tree of { code }, { or: [...] } and { and: [...] } nodes.
// "/" binds tighter than "&":  "CS103&IS217/MGMT108" = CS103 and (IS217 or MGMT108)
function parse(tokens) {
  let position = 0

  // A single course, or a whole expression in brackets
  function parsePrimary() {
    if (tokens[position] === '(') {
      position++ // skip "("
      const node = parseAnd()
      if (tokens[position] === ')') {
        position++ // skip ")"
      }
      return node
    }

    const token = tokens[position]
    position++
    if (token && !isSymbol(token)) {
      return { code: token }
    }
    return null
  }

  // Items joined by `operator`, each read with `parseItem`
  function parseList(operator, parseItem) {
    const items = [parseItem()]
    while (tokens[position] === operator) {
      position++ // skip the operator
      items.push(parseItem())
    }

    const kept = items.filter((item) => item !== null)
    if (kept.length === 0) {
      return null
    }
    if (kept.length === 1) {
      return kept[0]
    }
    if (operator === '/') {
      return { or: kept }
    }
    return { and: kept }
  }

  function parseOr() {
    return parseList('/', parsePrimary)
  }

  function parseAnd() {
    return parseList('&', parseOr)
  }

  return parseAnd()
}

// Step 3: flatten the tree into AND-of-OR groups
function toGroups(node) {
  if (!node) {
    return []
  }

  // One course is one group with one course in it
  if (node.code) {
    return [[node.code]]
  }

  // "a and b": all the groups of a, plus all the groups of b
  if (node.and) {
    const groups = []
    for (const child of node.and) {
      groups.push(...toGroups(child))
    }
    return groups
  }

  // "(a and b) or c" = "(a or c) and (b or c)": combine every group of one side with every group of the other
  let combined = [[]]
  for (const child of node.or) {
    const childGroups = toGroups(child)
    const next = []
    for (const soFar of combined) {
      for (const group of childGroups) {
        next.push([...soFar, ...group])
      }
    }
    combined = next
  }
  return combined
}

// Remove repeated courses inside a group, and groups that appear twice
function removeDuplicates(groups) {
  const seen = new Set()
  const result = []

  for (const group of groups) {
    const unique = [...new Set(group)]
    const key = [...unique].sort().join('|')
    if (!seen.has(key)) {
      seen.add(key)
      result.push(unique)
    }
  }
  return result
}

/** "IS111/IS200/(CS101&CS201)" → [["IS111","IS200","CS101"],["IS111","IS200","CS201"]] */
export function parseRequisite(text, subject = '') {
  if (!text) {
    return []
  }
  const tokens = tokenize(text, subject)
  const tree = parse(tokens)
  return removeDuplicates(toGroups(tree))
}

/** "STAT151/COR-STAT1203" → ["STAT151", "COR-STAT1203"] */
export function splitCodes(text, subject = '') {
  if (!text) {
    return []
  }
  const codes = tokenize(text, subject).filter((token) => !isSymbol(token))
  return [...new Set(codes)]
}

/** The groups that no course satisfies, e.g. unmetGroups(mod.prerequisites, (code) => done.has(code)) */
export function unmetGroups(groups = [], isMet) {
  const unmet = []
  for (const group of groups ?? []) {
    const anyMet = group.some((code) => isMet(code))
    if (!anyMet) {
      unmet.push(group)
    }
  }
  return unmet
}
