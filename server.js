// server.js
import express from "express";
import "dotenv/config";
import { registerFlowRoutes } from "./flows/routes.js";

const app = express();
const PORT = process.env.PORT || 3001;

(async () => {
  await registerFlowRoutes(app); // fetch flows + register endpoints

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
})();