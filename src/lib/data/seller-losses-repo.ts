import type { SellerLossInput } from "../validations";

export type SellerLossItem = {
  id: number;
  lossId: number;
  productId: number;
  quantity: number;
  unitCost: number;
};

export type SellerLoss = {
  id: number;
  sellerId: number;
  type: "perdida" | "dano" | "robo";
  lossDate: string;
  notes: string | null;
  createdAt: string;
  items: SellerLossItem[];
};

export interface SellerLossesRepo {
  list(): Promise<SellerLoss[]>;
  listForSeller(sellerId: number): Promise<SellerLoss[]>;
  create(data: SellerLossInput): Promise<SellerLoss>;
}
