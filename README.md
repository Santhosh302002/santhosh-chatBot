# Bedrock RAG Service

This project is a Java 21 Spring Boot RAG service that:

- creates embeddings with Amazon Titan Text Embeddings V2
- stores vectors in PostgreSQL with pgvector
- answers questions with Anthropic Claude 3.5 Sonnet v2 through Amazon Bedrock

## Models

- Embedding model: `amazon.titan-embed-text-v2:0`
- Embedding input type: `TEXT`
- Chat model (inference profile): `us.anthropic.claude-3-5-sonnet-20241022-v2:0`

Those model IDs match the current AWS Bedrock documentation.

## Prerequisites

- Java 21
- Maven 3.9+
- Docker
- AWS credentials with Bedrock access
- Bedrock model access enabled for Titan embeddings and Claude Sonnet

## Run locally

Start pgvector:

```bash
docker compose up -d
```

Set AWS environment variables:

```bash
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_SESSION_TOKEN=your-session-token
export BEDROCK_EMBEDDING_INPUT_TYPE=TEXT
export BEDROCK_CHAT_MODEL=us.anthropic.claude-3-5-sonnet-20241022-v2:0
```

Build and run:

```bash
mvn spring-boot:run
```

## API

Ingest a document:

```bash
curl -X POST http://localhost:8080/api/documents \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "policy-001",
    "title": "Refund Policy",
    "text": "Your long business content goes here..."
  }'
```

Ask a question:

```bash
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What does the refund policy say?"
  }'
```

## Notes

- Chunking is currently simple character-based splitting with overlap.
- The vector store schema is auto-created on startup.
- For Claude models in Bedrock Converse, use an inference profile ID/ARN in `BEDROCK_CHAT_MODEL` if direct on-demand model invocation is blocked.
- If you want file ingestion for PDF, DOCX, or HTML next, that can be added on top of this service.

## Deploy (Vercel + Render + Supabase)

This is the recommended free-tier setup for this project:

- Frontend on Vercel
- Spring Boot backend on Render Web Service
- PostgreSQL + pgvector on Supabase

### 1) Create Supabase Postgres

1. Create a Supabase project.
2. In SQL editor, enable pgvector:

```sql
create extension if not exists vector;
```

3. Get connection details from Supabase:
   - Host
   - Database name
   - User
   - Password
   - Port
4. Build JDBC URL:

```text
jdbc:postgresql://<host>:5432/postgres?sslmode=require
```

### 2) Deploy backend to Render

1. Push this repo to GitHub.
2. In Render: `New` -> `Web Service` -> connect repo.
3. Configure:
   - Runtime: `Java`
   - Build command: `mvn clean package -DskipTests`
   - Start command: `java -jar target/chatbot-1.0-SNAPSHOT.jar`
4. Add environment variables in Render:

```text
SPRING_DATASOURCE_URL=jdbc:postgresql://<host>:5432/postgres?sslmode=require
SPRING_DATASOURCE_USERNAME=<supabase-user>
SPRING_DATASOURCE_PASSWORD=<supabase-password>

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
AWS_SESSION_TOKEN=<optional-session-token>

BEDROCK_CHAT_MODEL=us.anthropic.claude-sonnet-4-5-20250929-v1:0
BEDROCK_EMBEDDING_MODEL=amazon.titan-embed-text-v2:0
BEDROCK_EMBEDDING_INPUT_TYPE=TEXT

APP_ADMIN_TOKEN=<a-long-random-secret>
APP_CORS_ALLOWED_ORIGINS=https://<your-vercel-app>.vercel.app
```

5. Deploy and verify:

```bash
curl https://<render-service>.onrender.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"hello"}'
```

Note: Render free services can cold-start after inactivity.

### 3) Deploy frontend to Vercel

1. Import your frontend repo in Vercel.
2. Redeploy frontend.

If you use the static frontend in this repo (`/frontend`):

- Framework preset: `Other`
- Root directory: `frontend`
- Build command: (leave empty)
- Output directory: (leave empty)
- Install command: (leave empty)

Set backend proxy in `frontend/vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://your-render-service.onrender.com/api/$1"
    }
  ]
}
```

Then use:

- User chat app: `https://<your-vercel-domain>/`
- Admin KB upload app: `https://<your-vercel-domain>/admin`
Admin page asks for `APP_ADMIN_TOKEN`.

### 4) CORS for multiple domains

If you use preview deployments, allow multiple origins:

```text
APP_CORS_ALLOWED_ORIGINS=https://<prod>.vercel.app,https://<preview>.vercel.app
```

## Admin-only KB ingestion

`POST /api/documents` is protected by `X-Admin-Token`.

Set this on backend:

```text
APP_ADMIN_TOKEN=<a-long-random-secret>
```

Admin ingestion example:

```bash
curl -X POST https://<render-service>.onrender.com/api/documents \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: <a-long-random-secret>" \
  -d '{
    "documentId": "policy-001",
    "title": "Refund Policy",
    "text": "Your long business content goes here..."
  }'
```
