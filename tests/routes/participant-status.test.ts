import { describe, expect, it } from "vitest";
import { canTransitionParticipantStatus } from "../../src/types/participant-status";

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
});
