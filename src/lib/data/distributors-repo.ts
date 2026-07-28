import type { DistributorInput } from "../validations";

export type Distributor = {
  id: number;
  name: string;
  city: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateDistributorInput = DistributorInput;
export type UpdateDistributorInput = Partial<CreateDistributorInput>;

export interface DistributorsRepo {
  list(): Promise<Distributor[]>;
  getById(id: number): Promise<Distributor | null>;
  create(data: CreateDistributorInput): Promise<Distributor>;
  update(id: number, data: UpdateDistributorInput): Promise<Distributor>;
  deactivate(id: number): Promise<void>;
}
