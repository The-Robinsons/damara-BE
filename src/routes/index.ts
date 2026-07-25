import { Router } from "express";

import Paths from "../common/constants/Paths";
import userRouter from "./users/UserRoutes";
import postRouter from "./posts/PostRoutes";
import uploadRouter from "./upload/UploadRoutes";
import chatRouter from "./chat/ChatRoutes";
import notificationRouter from "./notifications/NotificationRoutes";
import noticeRouter from "./notices/NoticeRoutes";
import pickupZoneRouter from "./pickup-zones/PickupZoneRoutes";
import faqRouter from "./faqs/FaqRoutes";
import emailVerificationRouter from "./email-verifications/EmailVerificationRoutes";

const BaseRouter = Router();

// User 라우터: /api/users
BaseRouter.use(Paths.Users.Base, userRouter);

// Post 라우터: /api/posts
BaseRouter.use(Paths.Posts.Base, postRouter);

// Upload 라우터: /api/upload
BaseRouter.use(Paths.Upload.Base, uploadRouter);

// Chat 라우터: /api/chat
BaseRouter.use(Paths.Chat.Base, chatRouter);

// Notification 라우터: /api/notifications
BaseRouter.use(Paths.Notifications.Base, notificationRouter);

// Notice 라우터: /api/notices
BaseRouter.use(Paths.Notices.Base, noticeRouter);

// PickupZone 라우터: /api/pickup-zones
BaseRouter.use(Paths.PickupZones.Base, pickupZoneRouter);

// FAQ 라우터: /api/faqs
BaseRouter.use(Paths.Faqs.Base, faqRouter);

// Email verification 라우터: /api/auth/email-verifications
BaseRouter.use(Paths.EmailVerifications.Base, emailVerificationRouter);

export default BaseRouter;
