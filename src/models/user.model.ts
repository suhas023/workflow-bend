import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
  userId: string;
  name: string;
  email: string;
  passHash: string;
  approver?: boolean;
}

const userSchema = new Schema({
  userId: { type: String, unique: true, required: true },
  name: { type: String },
  email: { type: String, required: true, unique: true },
  passHash: { type: String },
  approver: { type: Boolean, default: false },
});

export const userModel = model<IUser>("User", userSchema);
