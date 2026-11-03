// Structural and completion validation only. Does not calculate or save results.
export function validateSubmissionV2(body, rubric) {
  const issues = []
  const fail = (status, code) => ({ ok: false, status, code, issues })
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    issues.push({ field: 'body', code: 'INVALID_BODY' })
    return fail(400, 'INVALID_SUBMISSION')
  }
  if (body.rubricVersion !== rubric.rubricVersion) {
    issues.push({ field: 'rubricVersion', code: 'VERSION_MISMATCH' })
    return fail(409, 'QUIZ_VERSION_UNAVAILABLE')
  }
  if (typeof body.submissionId !== 'string' || !body.submissionId.trim() || body.submissionId.length > 128) {
    issues.push({ field: 'submissionId', code: 'INVALID_SUBMISSION_ID' })
  }
  if (!Array.isArray(body.answers)) {
    issues.push({ field: 'answers', code: 'EXPECTED_ARRAY' })
    return fail(400, 'INVALID_SUBMISSION')
  }

  const questions = new Map(rubric.questions.map((question) => [question.id, question]))
  const responses = new Map()
  for (const answer of body.answers) {
    if (!answer || typeof answer !== 'object' || Array.isArray(answer) || !questions.has(answer.questionId)) {
      issues.push({ field: 'answers', code: 'UNKNOWN_QUESTION' })
      continue
    }
    const questionId = answer.questionId
    const question = questions.get(questionId)
    if (responses.has(questionId)) {
      issues.push({ questionId, section: question.section, code: 'DUPLICATE_QUESTION' })
      continue
    }
    responses.set(questionId, answer.optionId)
    if (answer.optionId !== null && !question.options.some((option) => option.id === answer.optionId)) {
      issues.push({ questionId, section: question.section, code: 'INVALID_OPTION' })
    }
  }
  for (const question of rubric.questions) {
    if (!responses.has(question.id)) {
      issues.push({ questionId: question.id, section: question.section, code: 'MISSING_QUESTION' })
    }
  }
  if (issues.length) return fail(400, 'INVALID_SUBMISSION')

  const coverage = {}
  for (const question of rubric.questions) {
    const section = coverage[question.section] ??= { answered: 0, informativeScenarios: 0 }
    const optionId = responses.get(question.id)
    if (optionId === null) {
      issues.push({ questionId: question.id, section: question.section, code: 'QUESTION_UNANSWERED' })
      continue
    }
    section.answered += 1
    if (question.type === 'scenario') section.informativeScenarios += 1
  }
  for (const [section, counts] of Object.entries(coverage)) {
    if (counts.answered < 3) issues.push({ section, code: 'SECTION_NEEDS_THREE_ANSWERS' })
  }
  if (issues.length) return fail(422, 'QUIZ_INCOMPLETE')

  return {
    ok: true,
    rubricVersion: rubric.rubricVersion,
    submissionId: body.submissionId,
    responses: rubric.questions.map(({ id }) => ({ questionId: id, optionId: responses.get(id) })),
    sectionCoverage: coverage,
  }
}
