import { Router, Request, Response } from "express";
import { IController } from "../interfaces";
import {
  workflowModel,
  ILevel,
  IApproval,
  IWorkflow,
  IUserApproval,
  userApprovalModel,
  IApprovalAction,
  ILevelStatus,
} from "../models";
import { checkJwt } from "../middlewares";
import { Document } from "mongoose";

export class UserApprovalController implements IController {
  public path = "/user-approval";
  public router = Router();
  private workflowModel = workflowModel;
  private userApprovalModel = userApprovalModel;

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Requires JWT to be present
    this.router.use(checkJwt);
    this.router.get(`${this.path}/pending`, this.getPendingApprovals);
    this.router.get(`${this.path}/history`, this.getApprovalHistory);
    this.router.post(`${this.path}/action`, this.setUserAction);
  }

  private getPendingApprovals = async (req: Request, res: Response) => {
    const userId = (<any>req).user.userId;
    let approvals: IUserApproval[] | null;
    let pendingApprovalResponse: IApprovalResponse[] = [];

    try {
      approvals = await this.userApprovalModel
        .find({ user: userId })
        .sort({ _id: -1 })
        .lean();
      // Filter to pending workflows
      for (let i = 0; i < approvals.length; i++) {
        const levelIndex = approvals[i].levelIndex;
        const approvalIndex = approvals[i].approvalIndex;
        const workflowId = approvals[i].workflow;
        const workflow = await this.workflowModel
          .findById(workflowId)
          .populate("levels.approvals.user", "name email");
        if (!workflow) continue;
        if (
          workflow.levels[levelIndex].approvals[approvalIndex].action ===
            "pending" &&
          workflow.levels[levelIndex].status === "active"
        )
          pendingApprovalResponse.push({ ...approvals[i], workflow });
      }

      return res.json({
        data: {
          pendingApprovals: pendingApprovalResponse,
        },
      });
    } catch (e) {
      return res.status(500).json({ message: "Server Error" });
    }
  };

  private getApprovalHistory = async (req: Request, res: Response) => {
    const userId = (<any>req).user.userId;
    let approvals: IUserApproval[] | null;
    let pendingApprovalResponse: IApprovalResponse[] = [];

    try {
      approvals = await this.userApprovalModel
        .find({ user: userId })
        .sort({ _id: -1 })
        .lean();
      for (let i = 0; i < approvals.length; i++) {
        const levelIndex = approvals[i].levelIndex;
        const approvalIndex = approvals[i].approvalIndex;
        const workflowId = approvals[i].workflow;
        const workflow = await this.workflowModel
          .findById(workflowId)
          .populate("levels.approvals.user", "name email");
        if (!workflow) continue;
        if (
          workflow.levels[levelIndex].approvals[approvalIndex].action !==
            "pending" ||
          workflow.levels[levelIndex].status !== "active"
        )
          pendingApprovalResponse.push({ ...approvals[i], workflow });
      }

      return res.json({
        data: {
          pendingApprovals: pendingApprovalResponse,
        },
      });
    } catch (e) {
      return res.status(500).json({ message: "Server Error" });
    }
  }

  private setUserAction = async (req: Request, res: Response) => {
    const { approvalId, action } = req.body;
    let userApprovalObj: IUserApproval | null;
    let levelIndex: number;
    let approvalIndex: number;
    let workflow: IWorkflow | null;
    try {
      userApprovalObj = await this.userApprovalModel.findById(approvalId);
      if (!userApprovalObj) throw new Error("Approval object not found");
      levelIndex = userApprovalObj.levelIndex;
      approvalIndex = userApprovalObj.approvalIndex;
      workflow = (await this.workflowModel.findById(
        userApprovalObj.workflow
      )) as IWorkflow;
      workflow.levels[levelIndex].approvals[approvalIndex].action = action;
      workflow.levels[levelIndex].approvalOrder = [
        ...workflow.levels[levelIndex].approvalOrder,
        approvalIndex,
      ];
      await workflow.save();
    } catch (e) {
      return res.status(500).json({ message: "server error" });
    }

    const level = workflow.levels[levelIndex];

    // No further action if level is no longer active
    if (level.status !== "active") return res.json({ data: { success: true } });

    // Check if we can go to next level
    let levelStatus: ILevelStatus = "active";
    if (level.approvalType === "any one") {
      for (let i = 0; i < level.approvalOrder.length; i++) {
        const action = level.approvals[level.approvalOrder[i]].action;
        if (action === "approve") {
          levelStatus = "executed";
          break;
        } else if (action === "reject" && i === level.approvals.length - 1) {
          levelStatus = "terminated";
          break;
        } else if (
          action === "rejectAndRemove" &&
          i === level.approvals.length - 1
        ) {
          levelStatus = "executed";
          break;
        }
      }
    } else if (level.approvalType === "round-robin") {
      for (let i = 0; i < level.approvalOrder.length; i++) {
        const action = level.approvals[level.approvalOrder[i]].action;
        if (action === "reject") {
          levelStatus = "terminated";
          break;
        } else if (action === "approve" && i === level.approvals.length - 1) {
          levelStatus = "executed";
          break;
        } else if (
          action === "rejectAndRemove" &&
          i === level.approvals.length - 1
        ) {
          levelStatus = "executed";
          break;
        }
      }
    } else if (level.approvalType === "sequential") {
      for (let i = 0; i < level.approvalOrder.length; i++) {
        const action = level.approvals[level.approvalOrder[i]].action;
        if (action === "reject") {
          levelStatus = "terminated";
          break;
        } else if (action === "approve" && i === level.approvals.length - 1) {
          levelStatus = "executed";
          break;
        } else if (
          action === "rejectAndRemove" &&
          i === level.approvals.length - 1
        ) {
          levelStatus = "executed";
          break;
        }
      }
      // if still active send to approval to next user
      if (levelStatus === "active") {
        for (let i = 0; i < level.approvals.length; i++) {
          const action = level.approvals[i].action;
          if (action === "blocked") {
            workflow.levels[levelIndex].approvals[i].action = "pending";
            const newApproval = new this.userApprovalModel();
            newApproval.user = level.approvals[i].user;
            newApproval.workflow = workflow._id;
            newApproval.levelIndex = levelIndex;
            newApproval.approvalIndex = i;
            await newApproval.save();
            await workflow.save();
            break;
          }
        }
      }
    }

    if (levelStatus !== "active") {
      workflow.levels[levelIndex].status = levelStatus;
      if (levelStatus === "terminated") workflow.status = "terminated";
      else if (levelStatus === "executed") {
        if (workflow.levels.length === levelIndex + 1) {
          workflow.status = "executed";
        } else {
          workflow.currentLevel = levelIndex + 1;
          const nextLevel = workflow.levels[levelIndex + 1];
          if (
            nextLevel.approvalType === "any one" ||
            nextLevel.approvalType === "round-robin"
          ) {
            for (let i = 0; i < nextLevel.approvals.length; i++) {
              const approval = nextLevel.approvals[i];
              const newUserApproval = new this.userApprovalModel();
              newUserApproval.user = approval.user;
              newUserApproval.workflow = workflow._id;
              newUserApproval.levelIndex = levelIndex + 1;
              newUserApproval.approvalIndex = i;
              approval.action = "pending";
              await newUserApproval.save();
            }
          } else {
            const approval = nextLevel.approvals[0];
            const newUserApproval = new this.userApprovalModel();
            newUserApproval.user = approval.user;
            newUserApproval.workflow = workflow._id;
            newUserApproval.levelIndex = levelIndex + 1;
            newUserApproval.approvalIndex = 0;
            approval.action = "pending";
            await newUserApproval.save();
          }
          // Activate first level
          workflow.levels[levelIndex + 1].status = "active";
        }
      }

      await workflow.save();
    }

    return res.json({ success: 200 });
  };
}

interface IApprovalResponse {
  user: string;
  workflow: IWorkflow;
  levelIndex: number;
  approvalIndex: number;
}
