//NOT IN USE, TO DELETE?

// import { unmetGroups } from "../../planning/utils/requisites.js";
// import { findClashes, findExamClashes } from "../../bidding/utils/clash.js";
// import { httpError } from "../../../middleware/errorHandler.js";

// export function validateRoomHandoff({ module, section, completed, others }) {
//   const done = new Set(completed);
//   if (done.has(module._id))
//     throw httpError(400, "You have already completed this module.");
//   const missing = unmetGroups(module.prerequisites, (code) => done.has(code));
//   if (
//     missing.length ||
//     (module.prerequisiteRules ?? []).some(
//       (rule) => rule.countFrom.filter((code) => done.has(code)).length < rule.n,
//     )
//   )
//     throw httpError(400, "Recorded prerequisites are not met for this module.");
//   const concurrent = new Set([...done, ...others.map((other) => other.module)]);
//   if (unmetGroups(module.corequisites, (code) => concurrent.has(code)).length)
//     throw httpError(
//       400,
//       "Add the required corequisite module to your bidding cart first.",
//     );
//   if ((module.mutuallyExclusive ?? []).some((code) => concurrent.has(code)))
//     throw httpError(
//       400,
//       "This module has an exclusion with a completed or selected module.",
//     );
//   if (findClashes([section, ...others]).length)
//     throw httpError(
//       400,
//       "The confirmed section clashes with a class in this bidding cart.",
//     );
//   if (findExamClashes([section, ...others]).length)
//     throw httpError(
//       400,
//       "The confirmed section has an exam clash in this bidding cart.",
//     );
// }
