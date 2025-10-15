#!/bin/sh

echo "🚀 Starting EmailTaskRouter backend..."

# Extract DB host and port from DATABASE_URL for readiness check
DB_URL="$DATABASE_URL"
DB_HOST=""
DB_PORT="5432"

if [ -n "$DB_URL" ]; then
  # Remove protocol
  url_no_proto=${DB_URL#*://}
  # Remove credentials if present
  host_port_and_path=${url_no_proto#*@}
  # Extract host:port part
  host_port=${host_port_and_path%%/*}
  DB_HOST=${host_port%%:*}
  maybe_port=${host_port#*:}
  if [ "$maybe_port" != "$host_port" ]; then
    DB_PORT=$maybe_port
  fi

  # Log sanitized DB target (no credentials)
  echo "🔎 Parsed DATABASE_URL target => host=$DB_HOST port=$DB_PORT"

  # Helpful warning: docker-compose host mistakenly used in production
  if [ "$NODE_ENV" = "production" ] && [ "$DB_HOST" = "postgres" ]; then
    echo "⚠️  DATABASE_URL points to host 'postgres' while running in production."
    echo "    This is the docker-compose hostname and won't resolve in AWS ECS."
    echo "    Please update the SSM parameter to use your RDS endpoint, e.g.:"
    echo "    postgresql://<db_user>:<password>@<rds-endpoint>:5432/<db_name>"
    echo "    Exiting so the task can restart after you fix the secret."
    exit 1
  fi
fi

if [ -n "$DB_HOST" ]; then
  echo "⏳ Waiting for database $DB_HOST:$DB_PORT to be ready..."
  retries=0
  until nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
    retries=$((retries+1))
    if [ $retries -ge 60 ]; then
      echo "⚠️  Database not reachable after 120s, continuing anyway..."
      break
    fi
    echo "🔄 Database not ready yet, waiting..."
    sleep 2
  done
  echo "✅ Database check done"
else
  echo "ℹ️  DATABASE_URL not set or host parse failed; skipping DB wait"
fi

# Ensure SSL is used by tools that honor PGSSLMODE (e.g., drizzle-kit via pg)
# Enable when DB host is not local/docker or when running in AWS
case "$DB_HOST" in
  localhost|127.0.0.1|postgres|docker-host)
    echo "ℹ️  Local DB detected ($DB_HOST), not forcing PGSSLMODE"
    ;;
  *)
    export PGSSLMODE=require
    echo "🔐 Set PGSSLMODE=require for migrations (host=$DB_HOST)"
    ;;
esac

# Change to server directory
cd /app/apps/server

# Run database migrations
echo "📦 Running database migrations..."
if [ "$NODE_ENV" = "production" ]; then
  NODE_TLS_REJECT_UNAUTHORIZED=0 npm run db:push
  status=$?
  if [ $status -ne 0 ]; then
    echo "❌ Database migrations failed (production). Exiting to let ECS restart."
    exit 1
  fi
else
  # Use npm to avoid requiring a global pnpm in the runtime image
  npm run db:push || echo "❌ Database migrations failed, but continuing anyway..."
fi

# Start the server
echo "🔥 Starting server..."
exec npm start