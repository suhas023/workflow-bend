import { Schema, model, Document } from "mongoose";

export interface IUserApproval extends Document {
  user: string;
  workflow: string;
  levelIndex: number;
  approvalIndex: number;
}

const userApprovalSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  workflow: { type: Schema.Types.ObjectId, ref: "Workflow", required: true },
  levelIndex: { type: Number },
  approvalIndex: { type: Number },
});

export const userApprovalModel = model<IUserApproval>(
  "Approval",
  userApprovalSchema
);
