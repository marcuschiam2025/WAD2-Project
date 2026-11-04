import mongoose from "mongoose";

export const MAX_PARTY_SIZE = 8; //arbitrary limit but good to have. If collab rooms are too big they might loose functionality.

const { ObjectId } = mongoose.Schema.Types;

const partySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    module: { type: String, required: true, uppercase: true, trim: true }, // e.g. "IS216"
    termKey: { type: String, required: true, match: /^\d{4}-\d{2}_T(1|2|3A|3B)$/ }, // e.g. "2026-27_T2"
    inviteCode: { type: String, required: true, unique: true, uppercase: true }, // 6 characters, shared to join
    owner: { type: ObjectId, ref: "User", required: true },
    maxMembers: { type: Number, min: 2, max: MAX_PARTY_SIZE, default: MAX_PARTY_SIZE },
    members: [{ type: ObjectId, ref: "User" }], // includes the owner
    banned: [{ type: ObjectId, ref: "User" }],
    locked: { type: Boolean, default: false },      // true = the party is frozen
    lockedAt: { type: Date, default: null },        // when it was locked
    lockedSection: { type: String, default: null }, // the section the owner chose, e.g. "IS216-G2"

    //votes is their vote not necessarily the section they bid for
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
    },
  },
  { timestamps: true },
);

const Party = mongoose.model("Party", partySchema);

export default Party;


