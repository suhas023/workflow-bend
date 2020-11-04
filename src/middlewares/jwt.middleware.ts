import jwt from "express-jwt";

export const checkJwt = jwt({
  // TODO: move to env
  secret: "SHHHHHHHHHH!!!",
  algorithms: ["HS256"],
});
