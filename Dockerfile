# Imagem de producao do dashboard (Next.js standalone). Build em tres etapas para a imagem final
# levar so o necessario para rodar.
#
# Nenhuma variavel de ambiente e necessaria no BUILD: todas (Supabase, GHL, nome da clinica) sao
# lidas em tempo de execucao. Defina-as no servico (Easypanel: aba Ambiente) e reinicie para
# aplicar mudancas. Nenhum segredo entra na imagem.

ARG NODE_VERSION=24

# 1. Dependencias
FROM node:${NODE_VERSION}-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2. Build
FROM node:${NODE_VERSION}-alpine AS build
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1
# O Git nao guarda pastas vazias: sem isso, o COPY da pasta public falha em um clone limpo.
RUN mkdir -p public
RUN npm run build

# 3. Execucao
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=America/Sao_Paulo

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/login || exit 1
CMD ["node", "server.js"]
