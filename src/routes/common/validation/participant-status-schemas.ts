import z from "zod";
import { PARTICIPANT_STATUSES } from "../../../types/participant-status";

/**
 * 참여자별 진행 상태 변경 요청 스키마
 */
export const updateParticipantStatusSchema = z.object({
  participantStatus: z.enum(PARTICIPANT_STATUSES),
});

export type UpdateParticipantStatusReq = z.infer<
  typeof updateParticipantStatusSchema
>;
