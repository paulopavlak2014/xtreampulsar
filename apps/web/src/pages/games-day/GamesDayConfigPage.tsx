import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Gamepad2,
  Plus,
  Trash2,
  Loader2,
  Play,
  GripVertical,
  Clock,
  Tv,
  Zap,
  ChevronDown,
  ChevronUp,
  Pencil,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import {
  useGamesDayConfig,
  useUpdateGamesDayConfig,
  useAddGamesDayLeague,
  useUpdateGamesDayLeague,
  useRemoveGamesDayLeague,
  useSyncGamesDay,
  useSportsChannels,
} from '@/hooks/useGamesDay';
import { useBouquets } from '@/hooks/useBouquets';

const AVAILABLE_QUALITIES = ['4K', 'FHD', 'HD', 'SD'];

const PRESET_LEAGUES = [
  { leagueId: 71, leagueName: 'Brasileirão Série A' },
  { leagueId: 72, leagueName: 'Brasileirão Série B' },
  { leagueId: 73, leagueName: 'Copa do Brasil' },
  { leagueId: 9, leagueName: 'Copa do Brasil (ALT)' },
  { leagueId: 13, leagueName: 'Brasileirão Série C' },
  { leagueId: 11, leagueName: 'Copa Libertadores' },
  { leagueId: 12, leagueName: 'Copa Sul-Americana' },
  { leagueId: 2, leagueName: 'Champions League' },
  { leagueId: 3, leagueName: 'Europa League' },
  { leagueId: 848, leagueName: 'Conference League' },
  { leagueId: 39, leagueName: 'Premier League' },
  { leagueId: 140, leagueName: 'La Liga' },
  { leagueId: 135, leagueName: 'Serie A Italiana' },
  { leagueId: 78, leagueName: 'Bundesliga' },
  { leagueId: 61, leagueName: 'Ligue 1' },
];

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-center gap-2 text-slate-200">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[220px_1fr] gap-4 items-start">
      <div>
        <div className="text-sm font-medium text-slate-300">{label}</div>
        {hint && <div className="text-xs text-muted mt-0.5">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors', checked ? 'bg-primary' : 'bg-border')}
    >
      <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
    </button>
  );
}

function LeagueRow({
  league,
  onUpdate,
  onRemove,
}: {
  league: { id: string; leagueId: number; leagueName: string; channels: string[]; isActive: boolean; sortOrder: number };
  onUpdate: (data: { id: string; leagueName?: string; channels?: string[]; isActive?: boolean }) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(league.leagueName);
  const [channelsText, setChannelsText] = useState(league.channels.join(', '));
  const [expanded, setExpanded] = useState(false);

  const save = () => {
    const channels = channelsText.split(',').map((c) => c.trim()).filter(Boolean);
    onUpdate({ id: league.id, leagueName: name, channels });
    setEditing(false);
  };

  const channelsPreview = league.channels.slice(0, 3).join(', ') + (league.channels.length > 3 ? ` +${league.channels.length - 3}` : '');

  return (
    <div className={cn('border rounded-lg transition-colors', league.isActive ? 'border-border bg-surface-2' : 'border-border opacity-50')}>
      <div className="flex items-center gap-3 px-3 py-2">
        <button onClick={() => setExpanded(!expanded)} className="text-muted hover:text-slate-300">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <GripVertical className="w-4 h-4 text-muted cursor-grab" />

        {editing ? (
          <input value={name} onChange={(e) => setName(e.target.value)} className="input flex-1 text-sm" autoFocus />
        ) : (
          <span className="text-sm font-medium text-slate-200 flex-1">{league.leagueName}</span>
        )}

        <span className="text-xs text-muted font-mono">ID: {league.leagueId}</span>

        <span className="text-xs text-muted">{channelsPreview}</span>

        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <button onClick={save} className="p-1 text-emerald-400 hover:text-emerald-300"><Check className="w-4 h-4" /></button>
              <button onClick={() => setEditing(false)} className="p-1 text-muted hover:text-slate-300"><X className="w-4 h-4" /></button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="p-1 text-muted hover:text-slate-300"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => onRemove(league.id)} className="p-1 text-muted hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-10 pb-3 space-y-2">
          <div>
            <label className="text-xs text-muted mb-1 block">Canais (separados por vírgula)</label>
            <input
              value={channelsText}
              onChange={(e) => setChannelsText(e.target.value)}
              className="input w-full text-sm"
              placeholder="SPORTV, PREMIERE, ESPN"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Ativo:</span>
            <Toggle checked={league.isActive} onChange={(v) => onUpdate({ id: league.id, isActive: v })} />
          </div>
        </div>
      )}
    </div>
  );
}

export function GamesDayConfigPage() {
  const { t } = useTranslation();
  const { data: config, isLoading } = useGamesDayConfig();
  const { data: bouquets = [] } = useBouquets();
  const { data: sportsChannels = [] } = useSportsChannels();
  const updateConfig = useUpdateGamesDayConfig();
  const addLeague = useAddGamesDayLeague();
  const updateLeague = useUpdateGamesDayLeague();
  const removeLeague = useRemoveGamesDayLeague();
  const syncGames = useSyncGamesDay();

  const [showAddLeague, setShowAddLeague] = useState(false);
  const [newLeagueId, setNewLeagueId] = useState('');
  const [newLeagueName, setNewLeagueName] = useState('');
  const [newLeagueChannels, setNewLeagueChannels] = useState('');
  const [showChannels, setShowChannels] = useState(false);
  const [channelSearch, setChannelSearch] = useState('');

  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleAddLeague = () => {
    const leagueId = parseInt(newLeagueId);
    if (!leagueId || !newLeagueName.trim()) {
      toast.error('Preencha o ID e nome da liga');
      return;
    }
    const channels = newLeagueChannels.split(',').map((c) => c.trim()).filter(Boolean);
    if (channels.length === 0) {
      toast.error('Adicione pelo menos um canal');
      return;
    }
    addLeague.mutate({ leagueId, leagueName: newLeagueName.trim(), channels });
    setNewLeagueId('');
    setNewLeagueName('');
    setNewLeagueChannels('');
    setShowAddLeague(false);
  };

  const handleQuickAdd = (preset: { leagueId: number; leagueName: string }) => {
    if (config.leagues.some((l) => l.leagueId === preset.leagueId)) {
      toast.error('Liga já adicionada');
      return;
    }
    addLeague.mutate({ leagueId: preset.leagueId, leagueName: preset.leagueName, channels: [] });
  };

  const toggleChannel = (name: string) => {
    const current = config.excludedChannels ?? [];
    const next = current.includes(name) ? current.filter((x) => x !== name) : [...current, name];
    updateConfig.mutate({ excludedChannels: next });
  };

  const filteredChannels = sportsChannels.filter((c) =>
    c.name.toLowerCase().includes(channelSearch.toLowerCase())
  );

  const toggleQuality = (q: string) => {
    const current = config.allowedQualities;
    const next = current.includes(q) ? current.filter((x) => x !== q) : [...current, q];
    if (next.length === 0) {
      toast.error('Selecione pelo menos uma qualidade');
      return;
    }
    updateConfig.mutate({ allowedQualities: next });
  };

  const totalLeagues = config.leagues.length;
  const activeLeagues = config.leagues.filter((l) => l.isActive).length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Gamepad2 className="w-6 h-6 text-primary" />
            Jogos do Dia
          </h1>
          <p className="text-sm text-muted mt-1">Configure como os canais de jogos são gerados automaticamente.</p>
        </div>
        <button
          onClick={() => syncGames.mutate()}
          disabled={syncGames.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
        >
          {syncGames.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Sincronizar Agora
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Status', value: config.isActive ? 'Ativo' : 'Inativo', color: config.isActive ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Categoria', value: config.categoryName, color: 'text-slate-200' },
          { label: 'Ligas Ativas', value: `${activeLeagues}/${totalLeagues}`, color: 'text-blue-400' },
          { label: 'Sincronização', value: `${String(config.syncHour).padStart(2, '0')}:00 BRT`, color: 'text-yellow-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface rounded-xl border border-border p-4">
            <div className="text-xs text-muted">{stat.label}</div>
            <div className={cn('text-lg font-semibold mt-1 truncate', stat.color)}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* General Settings */}
      <Section title="Configurações Gerais" icon={Tv}>
        <div className="space-y-4">
          <Field label="Ativo" hint="Ligar/desligar geração automática">
            <Toggle
              checked={config.isActive}
              onChange={(v) => updateConfig.mutate({ isActive: v })}
            />
          </Field>

          <Field label="Nome da Categoria" hint="Onde os canais serão criados">
            <input
              value={config.categoryName}
              onChange={(e) => updateConfig.mutate({ categoryName: e.target.value })}
              className="input w-full"
            />
          </Field>

          <Field label="Bouquet" hint="Bouquet vinculado à categoria">
            <select
              value={config.bouquetId ?? ''}
              onChange={(e) => updateConfig.mutate({ bouquetId: e.target.value || null })}
              className="input w-full"
            >
              <option value="">Nenhum</option>
              {bouquets.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Logo dos Canais" hint="URL da logo exibida nos canais dos jogos (deixe vazio para usar logo da equipe)">
            <div className="flex items-center gap-3">
              <input
                value={config.channelLogo ?? ''}
                onChange={(e) => updateConfig.mutate({ channelLogo: e.target.value || null })}
                className="input flex-1"
                placeholder="https://exemplo.com/logo.png"
              />
              {(config.channelLogo ?? '') && (
                <img
                  src={config.channelLogo!}
                  alt="Logo"
                  className="w-8 h-8 rounded object-cover border border-border"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
            </div>
          </Field>

          <Field label="Horário de Sync" hint="Hora em Brasília (0-23)">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted" />
              <input
                type="number"
                min={0}
                max={23}
                value={config.syncHour}
                onChange={(e) => updateConfig.mutate({ syncHour: parseInt(e.target.value) || 0 })}
                className="input w-20 text-center"
              />
              <span className="text-sm text-muted">:00 BRT</span>
            </div>
          </Field>

          <Field label="Qualidades" hint="Canais com essas qualidades serão incluídos">
            <div className="flex gap-2">
              {AVAILABLE_QUALITIES.map((q) => (
                <button
                  key={q}
                  onClick={() => toggleQuality(q)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                    config.allowedQualities.includes(q)
                      ? 'bg-primary/20 border-primary text-primary'
                      : 'bg-surface border-border text-muted hover:border-slate-500'
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Máx. Canais por Jogo" hint="Limita quantos canais por keyword (evita poluição)">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={10}
                value={config.maxChannelsPerMatch}
                onChange={(e) => updateConfig.mutate({ maxChannelsPerMatch: parseInt(e.target.value) || 2 })}
                className="input w-20 text-center"
              />
              <span className="text-sm text-muted">canais por keyword</span>
            </div>
          </Field>
        </div>
      </Section>

      {/* Sports Channels */}
      <Section title={`Canais de Esporte Detectados (${sportsChannels.length})`} icon={Tv}>
        <button onClick={() => setShowChannels(!showChannels)} className="flex items-center gap-2 text-sm text-muted hover:text-slate-300">
          {showChannels ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {showChannels ? 'Ocultar lista' : 'Mostrar lista — marque/desmarque os canais'}
        </button>

        {showChannels && (
          <div className="space-y-2">
            <input
              value={channelSearch}
              onChange={(e) => setChannelSearch(e.target.value)}
              placeholder="Buscar canal..."
              className="input w-full text-sm"
            />
            <div className="max-h-72 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
              {filteredChannels.length === 0 && (
                <p className="text-center text-muted text-sm py-4">Nenhum canal de esporte encontrado.</p>
              )}
              {filteredChannels.map((ch) => (
                <label
                  key={ch.name}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors',
                    ch.excluded ? 'opacity-50 line-through' : 'text-slate-200 hover:bg-surface-2'
                  )}
                >
                  <input type="checkbox" checked={!ch.excluded} onChange={() => toggleChannel(ch.name)} className="accent-primary" />
                  {ch.name}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted">Canais riscados serão ignorados na geração.</p>
          </div>
        )}
      </Section>

      {/* Leagues */}
      <Section title={`Ligas (${activeLeagues} ativas)`} icon={Zap}>
        <div className="space-y-2">
          {config.leagues.length === 0 && (
            <div className="text-center py-8 text-muted">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma liga configurada.</p>
              <p className="text-xs mt-1">Adicione ligas para mapear canais aos jogos.</p>
            </div>
          )}

          {config.leagues.map((league) => (
            <LeagueRow
              key={league.id}
              league={league}
              onUpdate={(data) => updateLeague.mutate(data)}
              onRemove={(id) => removeLeague.mutate(id)}
            />
          ))}

          {/* Add League */}
          {showAddLeague ? (
            <div className="border border-primary/30 rounded-lg p-4 space-y-3 bg-surface">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-200">Adicionar Liga</span>
                <button onClick={() => setShowAddLeague(false)} className="text-muted hover:text-slate-300"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted mb-1 block">KickoffAPI League ID</label>
                  <input
                    type="number"
                    value={newLeagueId}
                    onChange={(e) => setNewLeagueId(e.target.value)}
                    className="input w-full text-sm"
                    placeholder="71"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Nome da Liga</label>
                  <input
                    value={newLeagueName}
                    onChange={(e) => setNewLeagueName(e.target.value)}
                    className="input w-full text-sm"
                    placeholder="Brasileirão Série A"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Canais (vírgula)</label>
                  <input
                    value={newLeagueChannels}
                    onChange={(e) => setNewLeagueChannels(e.target.value)}
                    className="input w-full text-sm"
                    placeholder="SPORTV, PREMIERE"
                  />
                </div>
              </div>
              <button
                onClick={handleAddLeague}
                disabled={addLeague.isPending}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {addLeague.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                Adicionar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddLeague(true)}
              className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg text-sm text-muted hover:border-primary hover:text-primary transition-colors w-full justify-center"
            >
              <Plus className="w-4 h-4" />
              Adicionar Liga Personalizada
            </button>
          )}

          {/* Quick Add Presets */}
          {!showAddLeague && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-xs text-muted mb-2 font-medium">Adicionar Rápido (ligas populares)</div>
              <div className="flex flex-wrap gap-2">
                {PRESET_LEAGUES.filter((p) => !config.leagues.some((l) => l.leagueId === p.leagueId)).map((preset) => (
                  <button
                    key={preset.leagueId}
                    onClick={() => handleQuickAdd(preset)}
                    className="flex items-center gap-1 px-2 py-1 bg-surface-2 border border-border rounded text-xs text-slate-300 hover:border-primary hover:text-primary transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    {preset.leagueName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
