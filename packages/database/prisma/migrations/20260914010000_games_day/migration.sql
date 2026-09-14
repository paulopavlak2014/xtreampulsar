-- GamesDay config + leagues (Jogos do Dia) — configuração de geração
-- automática de canais de jogos ao vivo.

CREATE TABLE "games_day_config" (
    "id" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL DEFAULT 'CANAIS | JOGOS DO DIA',
    "bouquetId" TEXT,
    "allowedQualities" TEXT[] NOT NULL DEFAULT ARRAY['FHD','HD']::TEXT[],
    "maxChannelsPerMatch" INTEGER NOT NULL DEFAULT 2,
    "excludedChannels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "syncHour" INTEGER NOT NULL DEFAULT 6,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "games_day_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "games_day_leagues" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "leagueName" TEXT NOT NULL,
    "channels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "games_day_leagues_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "games_day_leagues_configId_leagueId_key"
    ON "games_day_leagues"("configId", "leagueId");

ALTER TABLE "games_day_leagues"
    ADD CONSTRAINT "games_day_leagues_configId_fkey" FOREIGN KEY ("configId")
    REFERENCES "games_day_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;