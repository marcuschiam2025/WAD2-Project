import mongoose from "mongoose";

export const MAX_PARTY_SIZE = 8;

const { ObjectId } = mongoose.Schema.Types;

// A party of students planning and bidding for one module together.
// updatedAt doubles as the cursor for the polling endpoint.
const partySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: String,
    module: { type: String, required: true ,uppercase: true}, // module the party is bidding for
    // Required for new parties. Older parties saved before this field have none: they keep working,
    // and their votes and section list cover every term on file.
    termKey: { type: String, required: function () { return this.isNew; } },
    inviteCode: { type: String, required: true, unique: true, uppercase: true },
    owner: { type: ObjectId, ref: "User", required: true },
    maxMembers: { type: Number, min: 2, max: MAX_PARTY_SIZE, default: 6 },
    members: [{ type: ObjectId, ref: "User" }],
    banned: [{ type: ObjectId, ref: "User" }],

    //vote from each member may not necesarily be the actual section they choose
    votes: [
      {
        _id: false,
        user: { type: ObjectId, ref: "User" },
        sectionIds: [String],
      },
    ],

    //memberSections refer to the actual section they bid for
    memberSections: {
      type: [
        {
          _id: false,
          user: { type: ObjectId, ref: "User", required: true },
          sectionId: { type: String, required: true },
          status: {
            type: String,
            enum: ["considering", "bidding", "enrolled"],
            default: "considering",
          },
          updatedAt: { type: Date, default: Date.now },
        },
      ],
      validate: {
        // at most one entry per member
        validator(list) {
          const ids = list.map((s) => s.user.toString());
          return new Set(ids).size === ids.length;
        },
        message: "A member can only share one section",
      },
    },
  },
  { timestamps: true },
);

const Party = mongoose.model("Party", partySchema);

export default Party;


