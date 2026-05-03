import { Router, type IRouter } from "express";
import healthRouter from "./health";
import contactsRouter from "./contacts";
import interactionsRouter from "./interactions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(contactsRouter);
router.use(interactionsRouter);

export default router;
