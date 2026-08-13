import { describe, expect, it } from "vitest";
import {
  canTransitionParticipantStatus,
  getParticipantStatusMeta,
  PARTICIPANT_PROCESS_GUIDE,
} from "../../src/types/participant-status";

describe("participant status transitions", () => {
  it("allows only the next progress step", () => {
    expect(
      canTransitionParticipantStatus("participating", "payment_pending")
    ).toBe(true);
    expect(
      canTransitionParticipantStatus("payment_pending", "pickup_ready")
    ).toBe(true);
    expect(canTransitionParticipantStatus("pickup_ready", "received")).toBe(
      true
    );
  });

  it("allows an idempotent retry", () => {
    expect(canTransitionParticipantStatus("received", "received")).toBe(true);
  });

  it("rejects skipped and backward transitions", () => {
    expect(canTransitionParticipantStatus("participating", "received")).toBe(
      false
    );
    expect(canTransitionParticipantStatus("pickup_ready", "participating")).toBe(
      false
    );
  });

  it("returns a numbered step and an explicit next action", () => {
    expect(getParticipantStatusMeta("participating")).toEqual({
      participantStatusLabel: "참여 신청",
      participantStatusStep: 1,
      participantStatusTotalSteps: 4,
      nextStatus: "payment_pending",
      nextActionLabel: "참여 확정하기",
      nextActionActor: "organizer",
    });
    expect(getParticipantStatusMeta("payment_pending")).toMatchObject({
      participantStatusLabel: "참여 확정",
      participantStatusStep: 2,
      nextActionLabel: "입금 확인하기",
    });
    expect(getParticipantStatusMeta("pickup_ready")).toMatchObject({
      participantStatusLabel: "입금 확인",
      participantStatusStep: 3,
      nextActionActor: "participant",
    });
  });

  it("provides the same four steps for the post process guide", () => {
    expect(PARTICIPANT_PROCESS_GUIDE.totalSteps).toBe(4);
    expect(PARTICIPANT_PROCESS_GUIDE.steps.map(({ step }) => step)).toEqual([
      1, 2, 3, 4,
    ]);
  });
});
