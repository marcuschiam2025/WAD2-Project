import mongoose from 'mongoose'

export const MIN_BID = 10

// A student's bid cart for one What-If plan and term: the chosen section and e$ amount per module
const bidCartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
    term: { type: String, required: true },
    items: [
      {
        _id: false,
        module: { type: String, required: true },
        sectionId: { type: String, required: true },
        amount: { type: Number, min: MIN_BID, required: true },
      },
    ],
  },
  { timestamps: true },
)

// One cart per plan per term. Carts saved before this change have no plan and need migrating.
bidCartSchema.index({ user: 1, plan: 1, term: 1 }, { unique: true })

export default mongoose.model('BidCart', bidCartSchema)
