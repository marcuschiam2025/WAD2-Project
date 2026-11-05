import BiddingSettings from '../bidding/models/BiddingSettings.js';
import { availableTerms, roundSettings } from '../bidding/section.repository.js';
import { auditedChange } from './audit.service.js';
import { revisionFilter } from './changes.js';
import { createRoundEditor } from './rounds.service.js';
const editor = createRoundEditor({
  change: auditedChange,
  read: (session) => BiddingSettings.findById('active').session(session).lean(),
  terms: (session) => availableTerms(session),
  write: async (before, data, session) => {
    if (!before) {
      const [row] = await BiddingSettings.create([{ _id: 'active', ...data, revision: 1 }], { session });
      return row.toObject();
    }
    return BiddingSettings.findOneAndUpdate(
      revisionFilter('active', before.revision ?? 0),
      { $set: data, $inc: { revision: 1 } },
      { session, new: true },
    ).lean();
  },
});
export async function getAdminRound(req, res) {
  const stored = await BiddingSettings.findById('active').lean();
  const effective = await roundSettings(process.env, async () => stored);
  res.json({ ...effective, revision: stored?.revision ?? 0 });
}
export async function saveAdminRound(req, res) {
  res.json(await editor.save(req.user, req.body));
}
