// Colours of the semester tags in the degree checklist (shared by the tag, its hover row and the legend).
//   now     recommended for the current semester
//   later   recommended further ahead
//   late    the recommended term has already passed
//   inProgress  being taken in the current semester
//   planned     already placed in a later semester of the plan
export const semesterTone = {
  now: 'border-success bg-success-tint text-foreground',
  later: 'border-border bg-secondary text-muted-foreground',
  late: 'border-destructive bg-destructive-tint text-destructive',
  inProgress: 'border-warning bg-warning-tint text-warning',
  planned: 'border-primary bg-primary-tint text-primary',
}

export const semesterToneLabel = {
  now: 'Recommended this semester',
  later: 'Recommended later',
  late: 'Past the recommended term',
  inProgress: 'In progress this semester',
  planned: 'Already in your plan',
}
