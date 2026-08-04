import { beforeEach, describe, expect, it, vi } from "vitest";

const { userModel, trustEventModel, trustEventRepo, sequelize } = vi.hoisted(() => ({
  userModel: {
    findByPk: vi.fn(),
  },
  trustEventModel: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
  trustEventRepo: {
    findByUserId: vi.fn(),
    countByUserId: vi.fn(),
  },
  sequelize: {
    transaction: vi.fn(),
  },
}));

vi.mock("../../src/models/User", () => ({
  default: userModel,
}));

vi.mock("../../src/db", () => ({
  sequelize,
}));

vi.mock("../../src/models/TrustEvent", () => ({
  default: trustEventModel,
}));

vi.mock("../../src/repos/TrustEventRepo", () => ({
  TrustEventRepo: trustEventRepo,
}));

import { TrustService } from "../../src/services/TrustService";

describe("TrustService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("신뢰 이벤트 목록에 페이지네이션 메타와 신뢰학점을 포함한다", async () => {
    userModel.findByPk.mockResolvedValueOnce({ id: "user-1" });
    trustEventRepo.findByUserId.mockResolvedValueOnce([
      {
        id: "event-1",
        userId: "user-1",
        type: "manual_adjustment",
        previousScore: 50,
        nextScore: 70,
      },
      {
        id: "event-2",
        userId: "user-1",
        type: "post_completed_author",
        previousScore: 70,
        nextScore: 80,
      },
    ]);
    trustEventRepo.countByUserId.mockResolvedValueOnce(5);

    await expect(
      TrustService.listEventsByUserId("user-1", 2, 2)
    ).resolves.toEqual({
      trustEvents: [
        {
          id: "event-1",
          userId: "user-1",
          type: "manual_adjustment",
          previousScore: 50,
          nextScore: 70,
          previousGrade: 3.5,
          nextGrade: 3.9,
        },
        {
          id: "event-2",
          userId: "user-1",
          type: "post_completed_author",
          previousScore: 70,
          nextScore: 80,
          previousGrade: 3.9,
          nextGrade: 4.1,
        },
      ],
      total: 5,
      limit: 2,
      offset: 2,
      hasNext: true,
    });

    expect(trustEventRepo.findByUserId).toHaveBeenCalledWith("user-1", 2, 2);
    expect(trustEventRepo.countByUserId).toHaveBeenCalledWith("user-1");
  });

  it("returns an existing idempotent event without changing the score", async () => {
    const existing = { get: vi.fn().mockReturnValue({ id: "event-existing" }) };
    sequelize.transaction.mockImplementationOnce(async (callback) =>
      callback({ LOCK: { UPDATE: "UPDATE" } })
    );
    trustEventModel.findOne.mockResolvedValueOnce(existing);

    await expect(
      TrustService.applyEvent({
        userId: "user-1",
        type: "participant_received",
        scoreChange: 4,
        idempotencyKey: "received-once",
      })
    ).resolves.toEqual({ id: "event-existing" });

    expect(userModel.findByPk).not.toHaveBeenCalled();
    expect(trustEventModel.create).not.toHaveBeenCalled();
  });

  it("stores the effective score change after clamping", async () => {
    const user = {
      trustScore: 99,
      update: vi.fn().mockResolvedValue(undefined),
    };
    const createdEvent = { get: vi.fn().mockReturnValue({ id: "event-1" }) };
    sequelize.transaction.mockImplementationOnce(async (callback) =>
      callback({ LOCK: { UPDATE: "UPDATE" } })
    );
    trustEventModel.findOne.mockResolvedValueOnce(null);
    userModel.findByPk.mockResolvedValueOnce(user);
    trustEventModel.create.mockResolvedValueOnce(createdEvent);

    await TrustService.applyEvent({
      userId: "user-1",
      type: "participant_received",
      scoreChange: 4,
      idempotencyKey: "received-once",
    });

    expect(user.update).toHaveBeenCalledWith(
      { trustScore: 100 },
      expect.any(Object)
    );
    expect(trustEventModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        scoreChange: 1,
        effectiveScoreChange: 1,
        previousScore: 99,
        nextScore: 100,
      }),
      expect.any(Object)
    );
  });
});
