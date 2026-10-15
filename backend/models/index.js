// One import point for all models:  import { Major, DegreePlan } from '../models/index.js';

// Catalogue (seeded from SMU data, read-only)
export { default as School } from './catalogue/School.js';
export { default as Major } from './catalogue/Major.js';
export { default as Track } from './catalogue/Track.js';
export { default as Requirement } from './catalogue/Requirement.js';
export { default as Module } from './catalogue/Module.js';
export { default as Section } from './catalogue/Section.js';
export { default as BidResult } from './catalogue/BidResult.js';
export { default as QuizQuestion } from './catalogue/QuizQuestion.js';
export { default as TrainingResponse } from './catalogue/TrainingResponse.js';

// User data (created by the app). DRAFT: see TEAM TO CONFIRM notes in each file.
export { default as User } from './user/User.js';
export { default as QuizAttempt } from './user/QuizAttempt.js';
export { default as DegreePlan } from './user/DegreePlan.js';
export { default as Party } from './user/Party.js';
export { default as Comment } from './user/Comment.js';
export { default as SemesterBid } from './user/SemesterBid.js';
