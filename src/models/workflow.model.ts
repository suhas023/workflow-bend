import { Schema, model, Document } from "mongoose";

export type IApprovalAction =
  | "blocked"
  | "pending"
  | "approve"
  | "reject"
  | "rejectAndRemove";
export type IApprovalType = "sequential" | "round-robin" | "any one";
export type ILevelStatus = "blocked" |"active" | "terminated" | "executed";
export type IWorkflowStatus =  "active" | "terminated" | "executed";

export interface IApproval {
  user: string;
  action: IApprovalAction;
}

export interface ILevel {
  approvalType: IApprovalType;
  approvals: IApproval[];
  status: ILevelStatus;
}

export interface IWorkflow extends Document {
  createdBy: string;
  title: string;
  description: string;
  status: IWorkflowStatus;
  levels: ILevel[];
  currentLevel: number;
}

const workflowSchema = new Schema({
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, default: "" },
  description: { type: String, default: "" },
  status: {
    type: String,
    enum: ["active", "terminated", "executed"],
    default: "active",
  },
  levels: [
    {
      approvalType: {
        type: String,
        enum: ["sequential", "round-robin", "any one"],
      },
      status: {
        type: String,
        enum: ["blocked", "active", "terminated", "executed"],
        default: "blocked",
      },
      approvals: [
        {
          user: { type: Schema.Types.ObjectId, ref: "User", required: true },
          action: {
            type: String,
            enum: ["blocked", "pending", "approve", "reject", "rejectAndRemove"],
            default: "blocked"
          },
        },
      ],
    },
  ],
});

export const workflowModel = model<IWorkflow>("Workflow", workflowSchema);
