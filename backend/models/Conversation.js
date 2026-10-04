const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    initiator: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'blocked'],
      default: 'pending',
    },
    blockedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      default: null,
    },
    lastMessage: {
      text: {
        type: String,
        default: '',
      },
      sender: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        default: null,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
      isRead: {
        type: Boolean,
        default: false,
      },
    },
    unreadCounts: {
      type: Map,
      of: Number,
      default: () => new Map(),
    },
    deletedFor: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],
    isGroup: {
      type: Boolean,
      default: false,
      index: true,
    },
    groupName: {
      type: String,
      default: '',
      trim: true,
      maxlength: [60, 'Group name cannot exceed 60 characters'],
    },
    groupAvatar: {
      type: String,
      default: null,
    },
    groupDescription: {
      type: String,
      default: '',
      trim: true,
      maxlength: [300, 'Group description cannot exceed 300 characters'],
    },
    groupCreator: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      default: null,
    },
    groupAdmins: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index for querying user conversations sorted by recent activity
conversationSchema.index({ participants: 1, updatedAt: -1 });
conversationSchema.index({ participants: 1, isGroup: 1, updatedAt: -1 });
conversationSchema.index({ status: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
