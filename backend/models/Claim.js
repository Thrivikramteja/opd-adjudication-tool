/**
 * Claim Mongoose Schema — represents an insurance claim in MongoDB.
 */

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const claimSchema = new mongoose.Schema({
  claim_number: {
    type: String,
    unique: true,
    default: () => `CLM_${uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase()}`,
  },
  member_id: { type: String, required: true },
  member_name: { type: String, required: true },
  member_join_date: { type: String, default: null },
  treatment_date: { type: String, required: true },
  claim_amount: { type: Number, required: true },
  hospital_name: { type: String, default: null },
  cashless_request: { type: Boolean, default: false },
  previous_claims_same_day: { type: Number, default: 0 },

  // Documents submitted with the claim
  documents: {
    prescription: { type: mongoose.Schema.Types.Mixed, default: null },
    bill: { type: mongoose.Schema.Types.Mixed, default: null },
  },

  // AI-extracted data from uploaded files
  extracted_data: { type: mongoose.Schema.Types.Mixed, default: null },

  // Uploaded file metadata
  uploaded_files: [
    {
      filename: String,
      original_name: String,
      mimetype: String,
      size: Number,
    },
  ],

  // Adjudication result
  status: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'PARTIAL', 'MANUAL_REVIEW'],
    default: 'PENDING',
  },
  decision: { type: String, default: null },
  approved_amount: { type: Number, default: null },
  rejection_reasons: { type: [String], default: null },
  confidence_score: { type: Number, default: null },
  decision_notes: { type: String, default: null },
  next_steps: { type: String, default: null },
  deductions: { type: mongoose.Schema.Types.Mixed, default: null },
  rejected_items: { type: [String], default: null },
  cashless_approved: { type: Boolean, default: null },
  network_discount: { type: Number, default: null },
  flags: { type: [String], default: null },

  // Step-by-step adjudication breakdown
  adjudication_breakdown: { type: [mongoose.Schema.Types.Mixed], default: null },
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret.__v;
      return ret;
    },
  },
});

// Index for common queries
claimSchema.index({ status: 1 });
claimSchema.index({ member_id: 1 });
claimSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Claim', claimSchema);
