import express from "express";
import swaggerUi from "swagger-ui-express";
import routes from "./routes";
import { openApiSpec } from "./swagger/openapi";
import { errorHandler, notFound } from "./middleware/errorHandler";

export const app = express();
app.use(express.json({ limit: "100kb" }));
app.get("/docs.json", (_req, res) => {
  res.json(openApiSpec);
});
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.use(routes);
app.use(notFound);
app.use(errorHandler);
