import { Router, type IRouter } from "express";
import healthRouter from "./health";
import contactsRouter from "./contacts";
import digestRouter from "./digest";

const router: IRouter = Router();

router.use(healthRouter);
router.use(contactsRouter);
router.use(digestRouter);

export default router;
