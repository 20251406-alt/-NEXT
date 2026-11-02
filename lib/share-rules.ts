export type ShareAccess = {
  status: "대기 중" | "승인됨" | "거절됨" | "회수됨" | "만료됨";
  agreed: boolean;
  blockActive: boolean;
  deleted?: boolean;
  validStart: string;
  validEnd: string;
};

export function isShareUsable(share: ShareAccess, today: string): boolean {
  return share.status === "승인됨" &&
    share.agreed &&
    share.blockActive &&
    !share.deleted &&
    share.validStart <= today &&
    share.validEnd >= today;
}

