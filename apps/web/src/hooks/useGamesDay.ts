import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

export interface GamesDayLeague {
  id: string;
  configId: string;
  leagueId: number;
  leagueName: string;
  channels: string[];
  isActive: boolean;
  sortOrder: number;
}

export interface GamesDayConfig {
  id: string;
  categoryName: string;
  bouquetId: string | null;
  allowedQualities: string[];
  syncHour: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  leagues: GamesDayLeague[];
}

export function useGamesDayConfig() {
  return useQuery({
    queryKey: ['games-day-config'],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: GamesDayConfig }>('/games-day-config');
      return data.data;
    },
  });
}

export function useUpdateGamesDayConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Pick<GamesDayConfig, 'categoryName' | 'bouquetId' | 'allowedQualities' | 'syncHour' | 'isActive'>>) => {
      const res = await api.put<{ success: boolean; data: GamesDayConfig }>('/games-day-config', data);
      return res.data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['games-day-config'] });
      toast.success('Configuração salva');
    },
    onError: () => toast.error('Erro ao salvar configuração'),
  });
}

export function useAddGamesDayLeague() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { leagueId: number; leagueName: string; channels: string[] }) => {
      const res = await api.post<{ success: boolean; data: GamesDayLeague }>('/games-day-config/leagues', data);
      return res.data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['games-day-config'] });
      toast.success('Liga adicionada');
    },
    onError: () => toast.error('Erro ao adicionar liga'),
  });
}

export function useUpdateGamesDayLeague() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; leagueName?: string; channels?: string[]; isActive?: boolean; sortOrder?: number }) => {
      const res = await api.put<{ success: boolean; data: GamesDayLeague }>(`/games-day-config/leagues/${id}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['games-day-config'] });
    },
    onError: () => toast.error('Erro ao atualizar liga'),
  });
}

export function useRemoveGamesDayLeague() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/games-day-config/leagues/${id}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['games-day-config'] });
      toast.success('Liga removida');
    },
    onError: () => toast.error('Erro ao remover liga'),
  });
}

export function useSyncGamesDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ success: boolean; data: { created: number; skipped: number; games: number } }>('/games-day/sync');
      return data.data;
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['streams'] });
      toast.success(`${result.games} jogos → ${result.created} canais criados`);
    },
    onError: () => toast.error('Erro ao sincronizar jogos'),
  });
}
