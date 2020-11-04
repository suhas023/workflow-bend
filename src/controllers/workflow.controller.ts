import { Router, Request, Response } from "express";
import { IController } from "../interfaces";
import { workflowModel, ILevel, IApproval, IWorkflow } from "../models";
import { checkJwt } from "../middlewares";

export class WorkflowController implements IController {
  public path = "/workflow";
  public router = Router();
  private workflowModel = workflowModel;

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Requires JWT to be present
    this.router.use(checkJwt);
    this.router.post(`${this.path}/create`, this.createWorkflow);
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
        userId,
        action: "blocked",
      }));
      levelList.push({
        approvalType,
        approvals,
        status: "blocked",
      });
    });

    newWorkflow.levels = levelList;
    newWorkflow.status = "active";
    newWorkflow.currentLevel = 0;

    try {
      await newWorkflow.save();
      await this.notifyNextUsers(newWorkflow);
    } catch (e) {
      return res.status(500).json({ message: "Server Error" });
    }

    return res.json({ success: true });
  };

  // Notify next Users for approval by creating Approval objects
  private notifyNextUsers = async (workflow: IWorkflow) => {
    const currentLevelIndex = workflow.currentLevel;
    const currentLevel = workflow.levels[currentLevelIndex];
    const approvalType = currentLevel.approvalType;
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
