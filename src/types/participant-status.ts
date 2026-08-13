export const PARTICIPANT_STATUSES = [
  "participating",
  "payment_pending",
  "pickup_ready",
  "received",
] as const;

export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];

export const PARTICIPANT_STATUS_LABELS: Record<ParticipantStatus, string> = {
  participating: "참여 신청",
  payment_pending: "참여 확정",
  pickup_ready: "입금 확인",
  received: "수령완료",
};

export const PARTICIPANT_STATUS_STEPS: Record<ParticipantStatus, number> = {
  participating: 1,
  payment_pending: 2,
  pickup_ready: 3,
  received: 4,
};

export const PARTICIPANT_STATUS_TOTAL_STEPS = 4;

export const PARTICIPANT_NEXT_ACTIONS: Record<
  ParticipantStatus,
  {
    nextStatus: ParticipantStatus | null;
    nextActionLabel: string | null;
    nextActionActor: "organizer" | "participant" | null;
  }
> = {
  participating: {
    nextStatus: "payment_pending",
    nextActionLabel: "참여 확정하기",
    nextActionActor: "organizer",
  },
  payment_pending: {
    nextStatus: "pickup_ready",
    nextActionLabel: "입금 확인하기",
    nextActionActor: "organizer",
  },
  pickup_ready: {
    nextStatus: "received",
    nextActionLabel: "수령 완료하기",
    nextActionActor: "participant",
  },
  received: {
    nextStatus: null,
    nextActionLabel: null,
    nextActionActor: null,
  },
};

export const PARTICIPANT_PROCESS_GUIDE = {
  title: "거래는 이렇게 진행돼요",
  totalSteps: PARTICIPANT_STATUS_TOTAL_STEPS,
  steps: PARTICIPANT_STATUSES.map((status) => ({
    status,
    step: PARTICIPANT_STATUS_STEPS[status],
    label: PARTICIPANT_STATUS_LABELS[status],
    description: {
      participating: "공동구매 참여를 신청한 상태예요.",
      payment_pending: "모집자가 참여를 확정했어요.",
      pickup_ready: "모집자가 입금을 확인했어요.",
      received: "상품을 받은 참여자가 수령을 완료했어요.",
    }[status],
  })),
} as const;

export function getParticipantStatusMeta(status: ParticipantStatus) {
  return {
    participantStatusLabel: PARTICIPANT_STATUS_LABELS[status],
    participantStatusStep: PARTICIPANT_STATUS_STEPS[status],
    participantStatusTotalSteps: PARTICIPANT_STATUS_TOTAL_STEPS,
    ...PARTICIPANT_NEXT_ACTIONS[status],
  };
}

export const PARTICIPANT_STATUS_TRANSITIONS: Record<
  ParticipantStatus,
  ParticipantStatus | null
> = {
  participating: "payment_pending",
  payment_pending: "pickup_ready",
  pickup_ready: "received",
  received: null,
};

export function canTransitionParticipantStatus(
  currentStatus: ParticipantStatus,
  nextStatus: ParticipantStatus
) {
  return (
    currentStatus === nextStatus ||
    PARTICIPANT_STATUS_TRANSITIONS[currentStatus] === nextStatus
  );
}
