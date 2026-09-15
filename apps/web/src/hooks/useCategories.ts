import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import type { PaginatedResponse } from '@/types';

export interface Category {
  id: string;
  externalId: number;
  name: string;
  type: 'LIVE' | 'VOD' | 'SERIES';
  sortOrder: number;
  isActive: boolean;
  categoryBouquets: { bouquetId: string; bouquet: { id: string; name: string } }[];
  createdAt: string;
  _count?: { streams: number };
}

export function useCategories(type?: string) {
  const params = type ? `?type=${type}` : '';
  return useQuery({
    queryKey: ['categories', type],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PaginatedResponse<Category> | Category[] }>(
        `/categories${params}`,
      );
      const d = res.data.data;
      return Array.isArray(d) ? d : d.items;
    },
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; type: string; bouquetIds: string[] }) =>
      api.post<{ success: boolean; data: Category }>('/categories', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Categoria criada');
    },
    onError: () => toast.error('Falha ao criar categoria'),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Category> & { bouquetIds?: string[] } }) =>
      api.patch(`/categories/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Categoria atualizada');
    },
    onError: () => toast.error('Falha ao atualizar'),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Categoria excluída');
    },
    onError: () => toast.error('Falha ao excluir'),
  });
}

export function useReorderCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (categoryIds: string[]) =>
      api.patch('/categories/reorder', { categoryIds }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}
