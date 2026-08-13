export const PICKUP_TYPES = ["custom", "damara_zone"] as const;

export type PickupType = (typeof PICKUP_TYPES)[number];

export const PICKUP_TYPE_LABELS: Record<PickupType, string> = {
  custom: "직접 입력",
  damara_zone: "다마라존",
};

export const PICKUP_ZONE_CAMPUSES = ["humanities", "natural", "shared"] as const;

export type PickupZoneCampus = (typeof PICKUP_ZONE_CAMPUSES)[number];

export type PickupZone = {
  id: string;
  name: string;
  campus: PickupZoneCampus;
  campusLabel: string;
  building: string | null;
  floor: string | null;
  detailLocation: string;
  displayName: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
};

export const DAMARA_PICKUP_ZONES: PickupZone[] = [
  {
    id: "student-hall-8f-stairs",
    name: "학관 8층 계단 앞",
    campus: "humanities",
    campusLabel: "인문캠퍼스",
    building: "학관",
    floor: "8층",
    detailLocation: "계단 앞",
    displayName: "인문캠퍼스 학관 8층 계단 앞",
    description: "인문캠퍼스 학관 8층 계단 앞 공식 접선지",
    isActive: true,
    sortOrder: 10,
  },
  {
    id: "administration-building-1f-hana-bank",
    name: "행정동 1층 하나은행 앞",
    campus: "humanities",
    campusLabel: "인문캠퍼스",
    building: "행정동",
    floor: "1층",
    detailLocation: "하나은행 앞",
    displayName: "인문캠퍼스 행정동 1층 하나은행 앞",
    description: "인문캠퍼스 행정동 1층 하나은행 앞 공식 접선지",
    isActive: true,
    sortOrder: 20,
  },
  {
    id: "bangmok-library-3f-terrace",
    name: "방목학술정보관(도서관) 3층 테라스 앞",
    campus: "humanities",
    campusLabel: "인문캠퍼스",
    building: "방목학술정보관(도서관)",
    floor: "3층",
    detailLocation: "테라스 앞",
    displayName: "인문캠퍼스 방목학술정보관(도서관) 3층 테라스 앞",
    description: "인문캠퍼스 방목학술정보관(도서관) 3층 테라스 앞 공식 접선지",
    isActive: true,
    sortOrder: 30,
  },
  {
    id: "mcc-1f-bakery",
    name: "1층 MCC 베이커리 앞",
    campus: "humanities",
    campusLabel: "인문캠퍼스",
    building: "MCC",
    floor: "1층",
    detailLocation: "베이커리 앞",
    displayName: "인문캠퍼스 1층 MCC 베이커리 앞",
    description: "인문캠퍼스 1층 MCC 베이커리 앞 공식 접선지",
    isActive: true,
    sortOrder: 40,
  },
  {
    id: "general-building-2f-skybridge",
    name: "종합관 2층 구름다리",
    campus: "humanities",
    campusLabel: "인문캠퍼스",
    building: "종합관",
    floor: "2층",
    detailLocation: "구름다리",
    displayName: "인문캠퍼스 종합관 2층 구름다리",
    description: "인문캠퍼스 종합관 2층 구름다리 공식 접선지",
    isActive: true,
    sortOrder: 50,
  },
  {
    id: "international-building-3f-middle-stairs",
    name: "국제관 3층 중간계단",
    campus: "humanities",
    campusLabel: "인문캠퍼스",
    building: "국제관",
    floor: "3층",
    detailLocation: "중간계단",
    displayName: "인문캠퍼스 국제관 3층 중간계단",
    description: "인문캠퍼스 국제관 3층 중간계단 공식 접선지",
    isActive: true,
    sortOrder: 60,
  },
];

export function findDamaraPickupZoneById(id?: string | null) {
  if (!id) {
    return null;
  }

  return DAMARA_PICKUP_ZONES.find((zone) => zone.id === id) ?? null;
}
