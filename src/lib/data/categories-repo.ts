import type { CategoryInput } from "../validations";

export type Category = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateCategoryInput = CategoryInput;
export type UpdateCategoryInput = Partial<CreateCategoryInput>;

export interface CategoriesRepo {
  list(): Promise<Category[]>;
  getById(id: number): Promise<Category | null>;
  create(data: CreateCategoryInput): Promise<Category>;
  update(id: number, data: UpdateCategoryInput): Promise<Category>;
  deactivate(id: number): Promise<void>;
}
