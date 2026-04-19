# The Away End — World Cup 2026 Bracket Contest

A fan bracket contest site for listeners of *The Away End* podcast (John Green & Daniel Alarcón), tied to the 2026 FIFA World Cup.

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                      CloudFront CDN                        │
│  /api/* → API Gateway → Lambda    /*  → S3 (React SPA)    │
└────────────────────────────────────────────────────────────┘
                              │
                        DynamoDB (single-table)
```

| Layer          | Service                        |
|----------------|--------------------------------|
| Frontend       | React + TypeScript + Vite      |
| CDN / Hosting  | CloudFront + S3                |
| API            | AWS Lambda + API Gateway       |
| Database       | DynamoDB (single-table design) |
| Auth           | Magic link via SES             |
| Infrastructure | AWS CDK v2                     |

## 2026 World Cup Groups

| Group | Teams |
|-------|-------|
| A | Mexico, South Africa, Korea Republic, Czechia |
| B | Canada, Bosnia and Herzegovina, Qatar, Switzerland |
| C | Brazil, Morocco, Haiti, Scotland |
| D | United States, Paraguay, Australia, Türkiye |
| E | Germany, Ivory Coast, Ecuador, Curaçao |
| F | Netherlands, Sweden, Tunisia, Japan |
| G | Belgium, Egypt, Iran, New Zealand |
| H | Spain, Cape Verde, Saudi Arabia, Uruguay |
| I | France, Senegal, Iraq, Norway |
| J | Argentina, Algeria, Austria, Jordan |
| K | Portugal, DR Congo, Uzbekistan, Colombia |
| L | England, Croatia, Ghana, Panama |

## Scoring

### Group Stage (max 56 pts)
- **1 pt** per team ranked in the correct position (max 4 pts per group × 12 groups = 48 pts)
- **1 pt** per correctly picked third-place advancer (8 picks × 1 pt = 8 pts)

### Knockout Stage (max 143 pts)
| Round | Points per Correct Pick |
|-------|------------------------|
| Round of 32 (advancing teams) | 2 pts |
| Round of 16 (advancing teams) | 4 pts |
| Quarterfinals (advancing teams) | 6 pts |
| Semifinals (advancing teams) | 10 pts |
| Finalist (non-champion) | 15 pts |
| Champion | 20 pts |

**Grand total max: 199 pts**

## Project Structure

```
away-end-bracket/
├── backend/              # Node.js/TypeScript Lambda API
│   ├── src/
│   │   ├── index.ts      # Lambda entry point
│   │   ├── types.ts      # Shared types
│   │   ├── data/         # Team & bracket data
│   │   ├── lib/          # DynamoDB, scoring, email, auth
│   │   └── handlers/     # Route handlers (auth, picks, leaderboard, admin)
│   └── package.json
├── frontend/             # React/TypeScript SPA
│   ├── src/
│   │   ├── pages/        # Home, Register, Picks, Leaderboard, Admin
│   │   ├── components/   # GroupCard, ThirdsPicker, BracketView, Leaderboard
│   │   ├── lib/          # API client, auth context
│   │   └── data/         # Team definitions
│   └── package.json
├── infrastructure/       # AWS CDK stack
│   ├── lib/stack.ts      # DynamoDB + Lambda + API GW + S3 + CloudFront
│   └── bin/app.ts
└── deploy.sh             # Single command deploy
```

## Prerequisites

- Node.js 20+
- AWS CLI configured (`aws configure`)
- AWS CDK CLI: `npm install -g aws-cdk`

## First-Time Setup

### 1. Create SSM Parameters

```bash
# JWT signing secret (generate a strong random string)
aws ssm put-parameter \
  --name /away-end/jwt-secret \
  --value "$(openssl rand -base64 48)" \
  --type SecureString

# SES verified sender email
aws ssm put-parameter \
  --name /away-end/from-email \
  --value "noreply@yourdomain.com" \
  --type String

# Frontend URL (update after first deploy)
aws ssm put-parameter \
  --name /away-end/frontend-url \
  --value "https://placeholder.cloudfront.net" \
  --type String
```

### 2. Verify SES Email Identity

```bash
aws ses verify-email-identity --email-address noreply@yourdomain.com
```
Click the verification link in the email that arrives.

### 3. Bootstrap CDK (first time only)

```bash
CDK_BOOTSTRAP=true ./deploy.sh
```

### 4. Deploy

```bash
./deploy.sh
```

After the first deploy, update the `/away-end/frontend-url` SSM parameter with the CloudFront URL from the output, then deploy again.

### 5. Create Admin User

After deploying, register a user account normally, then manually update the DynamoDB item to set `is_admin: true`:

```bash
# Get user ID from DynamoDB (find by email)
aws dynamodb query \
  --table-name AwayEndBracket \
  --key-condition-expression "PK = :pk AND SK = :sk" \
  --expression-attribute-values '{":pk":{"S":"EMAIL#admin@example.com"},":sk":{"S":"PROFILE"}}' \
  --query 'Items[0].user_id.S' \
  --output text

# Update user to admin (replace USER_ID)
aws dynamodb update-item \
  --table-name AwayEndBracket \
  --key '{"PK":{"S":"USER#USER_ID"},"SK":{"S":"USER#USER_ID"}}' \
  --update-expression "SET is_admin = :t" \
  --expression-attribute-values '{":t":{"BOOL":true}}'
```

## Development

### Backend

```bash
cd backend
npm install
npm run typecheck    # Type check
npm run build        # Bundle with esbuild
```

### Frontend

```bash
cd frontend
npm install
npm run dev          # Start dev server (proxies /api to localhost:3001)
npm run build        # Production build
```

### Local Development

For local development, you'll need:
1. A local or remote DynamoDB table
2. Backend environment variables in a `.env` file:
   ```
   DYNAMODB_TABLE=AwayEndBracket
   JWT_SECRET=local-dev-secret
   FROM_EMAIL=test@example.com
   FRONTEND_URL=http://localhost:5173
   AWS_REGION=us-east-1
   ```

## Phase Timeline

| Phase | Date | Action |
|-------|------|--------|
| Site launch | Now | Users register and submit picks |
| Picks lock | June 11, 2026 (16:00 UTC) | Tournament kickoff |
| Admin: enter group results | June 11–26, 2026 | After each match day |
| Admin: slot 8 thirds | June 27, 2026 | After group stage ends |
| Admin: knockout results | June 28 – July 19, 2026 | After each match |
| Admin: trigger recalc | After each entry | Updates leaderboard |

## Admin Operations

All admin operations are performed through the Admin panel at `/admin` (requires `is_admin: true`).

1. **Enter group results**: Input final standings for each group (1st–4th)
2. **Assign thirds**: Select which 8 third-place teams advanced, assign to bracket slots
3. **Enter knockout results**: Input winners for each round match-by-match
4. **Recalculate scores**: Trigger score recalculation for all users

## Key Design Decisions

- **Presence-based knockout scoring**: Wrong group seeding doesn't cascade. If you picked USA and Mexico both to advance, seeding errors don't cost knockout points.
- **No real-time updates**: Admin manually enters results and triggers recalculation.
- **Public brackets**: Anyone can view any user's bracket (fan community feel).
- **Magic link auth**: No passwords. Email → magic link → 30-day session cookie.
- **Single Lambda**: All API routes in one function for simplicity. Easy to split if needed.
- **Single DynamoDB table**: GSI for leaderboard queries. All other access patterns are key-based.
