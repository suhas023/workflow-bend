import { Router, Request, Response } from "express";
import { IController } from "../interfaces";
import { userModel, IUser } from "../models";
import { genSaltSync, hashSync, compareSync } from "bcrypt";
import { sign } from "jsonwebtoken";
import { checkJwt } from "../middlewares";

export class UserController implements IController {
  public path = "/user";
  public router = Router();
  private userModel = userModel;

  // TODO: Move to env file
  private saltRounds = 10;
  private secret = "SHHHHHHHHHH!!!";

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/signup`, this.signup);
    this.router.post(`${this.path}/login`, this.login);
    // Verify for JWT token from this point
    this.router.use(checkJwt);
    this.router.get(`${this.path}/approval-users`, this.getApprovalUsers);
  }

  // Signup Controller
  private signup = async (req: Request, res: Response) => {
    const details = req.body as ISignupRequest;

    // Find if user already exists
    try {
      const existingUser = await this.userModel.findOne({
        email: details.email,
      });
      if (existingUser)
        return res.status(400).json({
          message: "Email Taken",
        });
    } catch (e) {
      return res.status(500).json({
        message: "Server Error",
      });
    }

    // Setup new user
    const newUser = new this.userModel();
    newUser.name = details.name;
    newUser.email = details.email;
    newUser.approver = details.approver;
    newUser.passHash = hashSync(details.password, genSaltSync(this.saltRounds));
    try {
      await newUser.save();
      const token = sign(
        { userId: newUser._id, email: newUser.email },
        this.secret
      );

      // Send 200 with token
      return res.json({
        data: {
          token: token,
          name: newUser.name,
          email: newUser.email,
          userId: newUser._id,
        },
      });
    } catch (e) {
      console.log(e);
      res.status(500).json({ success: false, message: "Server Error" });
    }
  };

  // Login Controller
  private login = async (req: Request, res: Response) => {
    const details = req.body as ISignupRequest;

    // Find user in DB & compare password with hash
    try {
      let user: IUser | null;
      user = await this.userModel.findOne({ email: details.email });
      if (!user) {
        return res
          .status(400)
          .json({ success: false, message: "User not found" });
      }
      const isMatched = compareSync(details.password, user.passHash);

      // Check if password match
      if (!isMatched) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid Password" });
      }

      const token = sign({ userId: user._id, email: user.email }, this.secret);

      // Return 200 with token
      return res.json({
        data: {
          token: token,
          name: user.name,
          email: user.email,
          userId: user._id,
        },
      });
    } catch (e) {
      return res.status(500).json({ success: false, message: "Server Error" });
    }
  };

  private getApprovalUsers = async (req: Request, res: Response) => {
    try {
      const users = await this.userModel
        .find({ approver: true })
        .select("name email _id")
        .lean();
      let userMap: IUserMap = {
        allIds: [],
        byId: {},
      };
      users.forEach((user) => {
        userMap.allIds.push(user._id);
        userMap.byId[user._id] = user;
      });
      return res.json({
        data: {
          userMap,
        },
      });
    } catch (e) {
      return res.status(500).json({ success: false, message: "Server Error" });
    }
  };
}

export interface ILoginRequest {
  email: string;
  password: string;
}

export interface ISignupRequest {
  name: string;
  email: string;
  password: string;
  approver: boolean;
}

interface IUserMap {
  allIds: string[];
  byId: {
    [id: string]: {
      _id: string;
      email: string;
      name: string;
    };
  };
}
