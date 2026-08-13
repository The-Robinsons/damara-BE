import { describe, expect, it } from "vitest";
import {
  createPostSchema,
  updatePostSchema,
} from "../../src/routes/common/validation/post-schemas";
import { updatePostStatusSchema } from "../../src/routes/common/validation/post-status-schemas";

const basePost = {
  authorId: "123e4567-e89b-12d3-a456-426614174000",
  title: "물티슈 공동구매",
  content: "도톰한 물티슈를 같이 구매합니다.",
  price: 5000,
  minParticipants: 3,
  deadline: "2026-06-17T23:59:59.000Z",
  pickupLocation: "명지대 정문",
};

describe("post schemas", () => {
  it("선모집 가격 해금 공구 생성을 허용한다", () => {
    const parsed = createPostSchema.parse({
      post: {
        ...basePost,
        groupBuyType: "pre_recruit",
        groupBuyMode: "price_unlock",
        targetParticipants: 5,
        targetPrice: 4500,
      },
    });

    expect(parsed.post.groupBuyType).toBe("pre_recruit");
    expect(parsed.post.groupBuyMode).toBe("price_unlock");
    expect(parsed.post.targetParticipants).toBe(5);
  });

  it("지원하지 않는 거래 타입은 거부한다", () => {
    const result = createPostSchema.safeParse({
      post: {
        ...basePost,
        groupBuyType: "campus_pickup",
      },
    });

    expect(result.success).toBe(false);
  });

  it("지원하지 않는 거래 세부 모드는 거부한다", () => {
    const result = createPostSchema.safeParse({
      post: {
        ...basePost,
        groupBuyType: "pre_recruit",
        groupBuyMode: "auction",
      },
    });

    expect(result.success).toBe(false);
  });

  it("수정 요청에서 거래 방식 필드를 허용한다", () => {
    const parsed = updatePostSchema.parse({
      post: {
        groupBuyType: "pre_recruit",
        groupBuyMode: "normal",
        targetParticipants: null,
        targetPrice: null,
      },
    });

    expect(parsed.post.groupBuyMode).toBe("normal");
  });

  it("다마라존 선택 방식 생성을 허용한다", () => {
    const { pickupLocation, ...postWithoutPickupLocation } = basePost;
    const parsed = createPostSchema.parse({
      post: {
        ...postWithoutPickupLocation,
        pickupType: "damara_zone",
        pickupZoneId: "s2810",
      },
    });

    expect(parsed.post.pickupType).toBe("damara_zone");
    expect(parsed.post.pickupZoneId).toBe("s2810");
    expect(parsed.post.pickupLocation).toBeUndefined();
  });

  it("지원하지 않는 수령 방식은 거부한다", () => {
    const result = createPostSchema.safeParse({
      post: {
        ...basePost,
        pickupType: "random_place",
      },
    });

    expect(result.success).toBe(false);
  });
  it("rejects the removed in_progress post status", () => {
    expect(
      updatePostStatusSchema.safeParse({ status: "in_progress" }).success
    ).toBe(false);
    expect(updatePostStatusSchema.safeParse({ status: "closed" }).success).toBe(
      true
    );
    expect(
      updatePostStatusSchema.safeParse({ status: "completed" }).success
    ).toBe(true);
  });
});
