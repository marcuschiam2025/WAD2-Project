import mongoose from 'mongoose'

export const MIN_BID = 10

// A student's bid cart for one term: the chosen section and e$ amount per module.
const bidCartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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

bidCartSchema.index({ user: 1, term: 1 }, { unique: true })

export default mongoose.model('BidCart', bidCartSchema)
