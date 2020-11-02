import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";
import { UserController } from "./controllers";
import { IController } from "./interfaces";

class App {
  public app: express.Application;
  public port: number;

  constructor(port: number, controllers: IController[]) {
    this.app = express();
    this.port = port;

    this.connectToTheDatabase();
    this.initializeMiddlewares();
    this.initializeControllers(controllers);
  }

  private initializeMiddlewares() {
    this.app.use(cors());
    this.app.use(bodyParser.json());
    this.app.use(morgan("tiny"));
  }

  private initializeControllers(controllers: IController[]) {
    controllers.forEach((controller) => this.app.use("/", controller.router));
  }

  private connectToTheDatabase() {
    mongoose.connect(`mongodb://localhost/vcomply`);
    mongoose.connection.on("open", () => console.log("\nmongoDB connected\n"));
    mongoose.connection.on("error", () =>
      console.log("\nmongoDB **NOT** connected\n")
    );
  }

  public listen() {
    this.app.listen(this.port, () => {
      console.log(`\nApp listening on the port ${this.port}\n`);
    });
  }
}

const port = 5002;
const controllers = [new UserController()];
const app = new App(port, controllers);
app.listen();
