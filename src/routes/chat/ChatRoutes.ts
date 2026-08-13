import { Router } from "express";

import {
  createChatRoom,
  getOrCreateChatRoomByPostId,
  getChatRoomById,
  sendMessage,
  getMessagesByChatRoomId,
  markMessageAsRead,
  markAllMessagesAsRead,
  getUnreadMessageCount,
  deleteChatRoom,
  deleteMessage,
  getChatRoomsByUserId,
  createChatReport,
} from "../../controllers/chat.controller";

const chatRouter = Router();

/**
 * @swagger
 * /api/chat/rooms:
 *   post:
 *     summary: 채팅방 생성
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chatRoom
 *             properties:
 *               chatRoom:
 *                 type: object
 *                 required:
 *                   - postId
 *                 properties:
 *                   postId:
 *                     type: string
 *                     format: uuid
 *                     example: "123e4567-e89b-12d3-a456-426614174000"
 *           example:
 *             chatRoom:
 *               postId: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       201:
 *         description: 채팅방 생성 성공
 *       400:
 *         description: 유효성 검증 실패 또는 이미 채팅방이 존재함
 *       404:
 *         description: Post를 찾을 수 없음
 */
chatRouter.post("/rooms", createChatRoom);

/**
 * @swagger
 * /api/chat/rooms/user/{userId}:
 *   get:
 *     summary: 사용자가 참여한 채팅방 목록 조회
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 사용자 UUID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 조회 개수
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: 페이지네이션 오프셋
 *     responses:
 *       200:
 *         description: 채팅방 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 chatRooms:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       postId:
 *                         type: string
 *                         format: uuid
 *                       post:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           title:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [open, closed, completed, cancelled]
 *                           pickupLocation:
 *                             type: string
 *                             nullable: true
 *                           deadline:
 *                             type: string
 *                             format: date-time
 *                           thumbnailUrl:
 *                             type: string
 *                             nullable: true
 *                           authorId:
 *                             type: string
 *                             format: uuid
 *                           images:
 *                             type: array
 *                             items:
 *                               type: string
 *                       participants:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             userId:
 *                               type: string
 *                               format: uuid
 *                             nickname:
 *                               type: string
 *                             avatarUrl:
 *                               type: string
 *                               nullable: true
 *                       lastMessage:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           content:
 *                             type: string
 *                           senderId:
 *                             type: string
 *                             format: uuid
 *                           messageType:
 *                             type: string
 *                             enum: [text, image, system]
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                       unreadCount:
 *                         type: integer
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 total:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 offset:
 *                   type: integer
 *                 hasNext:
 *                   type: boolean
 *       404:
 *         description: 사용자를 찾을 수 없음
 */
// GET /api/chat/rooms/user/:userId - 사용자가 참여한 채팅방 목록 조회
// 중요: 더 구체적인 라우트를 먼저 배치해야 함
chatRouter.get("/rooms/user/:userId", getChatRoomsByUserId);

/**
 * @swagger
 * /api/chat/rooms/post/{postId}:
 *   get:
 *     summary: Post ID로 채팅방 조회 또는 생성
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 채팅방 조회 또는 생성 성공
 */
// GET /api/chat/rooms/post/:postId - Post ID로 채팅방 조회 또는 생성
// 중요: 더 구체적인 라우트를 먼저 배치해야 함
chatRouter.get("/rooms/post/:postId", getOrCreateChatRoomByPostId);

/**
 * @swagger
 * /api/chat/rooms/{chatRoomId}/messages:
 *   get:
 *     summary: 채팅방의 메시지 목록 조회
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: chatRoomId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: 메시지 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *                 total:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 offset:
 *                   type: integer
 *                 hasNext:
 *                   type: boolean
 *       404:
 *         description: 채팅방을 찾을 수 없음
 */
// GET /api/chat/rooms/:chatRoomId/messages - 채팅방의 메시지 목록 조회
// 중요: 더 구체적인 라우트를 먼저 배치해야 함
chatRouter.get("/rooms/:chatRoomId/messages", getMessagesByChatRoomId);

/**
 * @swagger
 * /api/chat/rooms/{chatRoomId}/reports:
 *   post:
 *     summary: 채팅 사용자 신고 접수
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: chatRoomId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: header
 *         name: x-user-id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 신고자 사용자 UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateChatReportRequest'
 *     responses:
 *       202:
 *         description: 신고 이메일 전송 완료
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateChatReportResponse'
 *       400:
 *         description: 신고 사유 누락 또는 자기 신고
 *       401:
 *         description: 인증 정보 누락
 *       403:
 *         description: 채팅 참여자가 아님
 *       404:
 *         description: 채팅방 또는 사용자를 찾을 수 없음
 *       429:
 *         description: 신고 횟수 제한
 *       502:
 *         description: 신고 이메일 전송 실패
 */
chatRouter.post("/rooms/:chatRoomId/reports", createChatReport);

/**
 * @swagger
 * /api/chat/rooms/{chatRoomId}/read-all:
 *   patch:
 *     summary: 채팅방의 모든 메시지 읽음 처리
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: chatRoomId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       204:
 *         description: 읽음 처리 성공
 *       400:
 *         description: 사용자 ID 누락 또는 유효성 검증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: 채팅방을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// PATCH /api/chat/rooms/:chatRoomId/read-all - 채팅방의 모든 메시지 읽음 처리
// 중요: 더 구체적인 라우트를 먼저 배치해야 함
chatRouter.patch("/rooms/:chatRoomId/read-all", markAllMessagesAsRead);

/**
 * @swagger
 * /api/chat/rooms/{chatRoomId}/unread-count:
 *   get:
 *     summary: 읽지 않은 메시지 수 조회
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: chatRoomId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 읽지 않은 메시지 수 조회 성공
 */
// GET /api/chat/rooms/:chatRoomId/unread-count - 읽지 않은 메시지 수 조회
// 중요: 더 구체적인 라우트를 먼저 배치해야 함
chatRouter.get("/rooms/:chatRoomId/unread-count", getUnreadMessageCount);

/**
 * @swagger
 * /api/chat/rooms/{id}:
 *   get:
 *     summary: 채팅방 ID로 조회
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 채팅방 조회 성공
 *       404:
 *         description: 채팅방을 찾을 수 없음
 */
// GET /api/chat/rooms/:id - 채팅방 ID로 조회 (일반 라우트는 마지막에 배치)
chatRouter.get("/rooms/:id", getChatRoomById);

/**
 * @swagger
 * /api/chat/messages:
 *   post:
 *     summary: 메시지 전송
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: object
 *                 required:
 *                   - chatRoomId
 *                   - senderId
 *                   - content
 *                 properties:
 *                   chatRoomId:
 *                     type: string
 *                     format: uuid
 *                   senderId:
 *                     type: string
 *                     format: uuid
 *                   content:
 *                     type: string
 *                     minLength: 1
 *                   messageType:
 *                     type: string
 *                     enum: [text, image, system]
 *                     default: text
 *           example:
 *             message:
 *               chatRoomId: "123e4567-e89b-12d3-a456-426614174000"
 *               senderId: "a87522bd-bc79-47b0-a73f-46ea4068a158"
 *               content: "안녕하세요! 공동구매 참여하고 싶습니다."
 *               messageType: "text"
 *     responses:
 *       201:
 *         description: 메시지 전송 성공
 *       400:
 *         description: 유효성 검증 실패
 *       404:
 *         description: 채팅방 또는 발신자를 찾을 수 없음
 */
chatRouter.post("/messages", sendMessage);

/**
 * @swagger
 * /api/chat/messages/{id}/read:
 *   patch:
 *     summary: 메시지 읽음 처리
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: 읽음 처리 성공
 *       404:
 *         description: 메시지를 찾을 수 없음
 */
chatRouter.patch("/messages/:id/read", markMessageAsRead);

/**
 * @swagger
 * /api/chat/rooms/{id}:
 *   delete:
 *     summary: 채팅방 삭제
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: 채팅방 삭제 성공
 *       404:
 *         description: 채팅방을 찾을 수 없음
 */
chatRouter.delete("/rooms/:id", deleteChatRoom);

/**
 * @swagger
 * /api/chat/messages/{id}:
 *   delete:
 *     summary: 메시지 삭제
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: 메시지 삭제 성공
 *       404:
 *         description: 메시지를 찾을 수 없음
 */
chatRouter.delete("/messages/:id", deleteMessage);

export default chatRouter;
