export interface Item {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItemPayload {
  title: string;
  description?: string;
}

export interface UpdateItemPayload {
  title?: string;
  description?: string;
}
