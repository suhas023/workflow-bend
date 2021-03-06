import { Router, Request, Response } from "express";
import { IController } from "../interfaces";
import {
  workflowModel,
  ILevel,
  IApproval,
  IWorkflow,
  userApprovalModel,
} from "../models";
import { checkJwt } from "../middlewares";

export class WorkflowController implements IController {
  public path = "/workflow";
  public router = Router();
  private workflowModel = workflowModel;
  private userApprovalModel = userApprovalModel;

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Requires JWT to be present
    this.router.use(checkJwt);
    this.router.post(`${this.path}/create`, this.createWorkflow);
    this.router.get(`${this.path}`, this.getWorkflows);
  }

  private createWorkflow = async (req: Request, res: Response) => {
    const userId = (<any>req).user.userId;
    const details = req.body as ICreateWorkflowRequest;
    const newWorkflow = new this.workflowModel();

    newWorkflow.title = details.title;
    newWorkflow.description = details.description;
    newWorkflow.createdBy = userId;

    let levelList: ILevel[] = [];

    // Create workflow level list
    details.levels.forEach((level) => {
      const approvalType = level.approvalType;
      const approvals: IApproval[] = level.userIds.map((userId) => ({
        user: userId,
        action: "blocked",
      }));
      levelList.push({
        approvalOrder: [],
        approvalType,
        approvals,
        status: "blocked",
      });
    });

    newWorkflow.levels = levelList;
    newWorkflow.status = "active";
    newWorkflow.currentLevel = 0;

    const firstLevel = newWorkflow.levels[0];

    // Send approval requests based on approval type for the first level
    if (
      firstLevel.approvalType === "any one" ||
      firstLevel.approvalType === "round-robin"
    ) {
      for (let i = 0; i < firstLevel.approvals.length; i++) {
        const approval = firstLevel.approvals[i];
        const newUserApproval = new this.userApprovalModel();
        newUserApproval.user = approval.user;
        newUserApproval.workflow = newWorkflow._id;
        newUserApproval.levelIndex = 0;
        newUserApproval.approvalIndex = i;
        approval.action = "pending";
        await newUserApproval.save();
      }
    } else {
      const approval = firstLevel.approvals[0];
      const newUserApproval = new this.userApprovalModel();
      newUserApproval.user = approval.user;
      newUserApproval.workflow = newWorkflow._id;
      newUserApproval.levelIndex = 0;
      newUserApproval.approvalIndex = 0;
      approval.action = "pending";
      await newUserApproval.save();
    }
    // Activate first level
    newWorkflow.levels[0].status = "active";

    try {
      await newWorkflow.save();
    } catch (e) {
      return res.status(500).json({ message: "Server Error" });
    }

    return res.json({ success: true });
  };

  // GET all the workflows created by a user
  private getWorkflows = async (req: Request, res: Response) => {
    const userId = (<any>req).user.userId;
    let workflows: IWorkflow[];

    try {
      workflows = await this.workflowModel
        .find({ createdBy: userId }).sort({_id: -1})
        .populate("levels.approvals.user", "name email");
      return res.json({ data: { workflows } });
    } catch (e) {
      return res.json({ message: "Server Error" });
    }
  };
}

type ILevelType = "sequential" | "round-robin" | "any one";

interface ILevelRequest {
  approvalType: ILevelType;
  userIds: string[];
}

interface ICreateWorkflowRequest {
  title: string;
  description: string;
  levels: ILevelRequest[];
}
