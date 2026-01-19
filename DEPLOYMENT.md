# Deployment Guide for ERP System

## Environment Variables Setup

### 1. Database Configuration
The system uses Supabase PostgreSQL with automatic fallback support.

**Primary Connection (Pooler):**
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
```

**Fallback Connection (Direct):**
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@aws-1-ap-south-1.db.supabase.com:5432/postgres
```

### 2. Application Configuration
```
SESSION_SECRET=super_secret_session_key_change_this_in_production
NODE_ENV=production
PORT=3100
```

## Deployment Steps

### 1. On Render.com
1. Create a new Web Service
2. Connect your GitHub repository
3. Set environment variables in Render dashboard:
   - `DATABASE_URL`: Your Supabase connection string
   - `SESSION_SECRET`: Random secret string
   - `NODE_ENV`: production
   - `PORT`: 10000 (Render's default)

### 2. Database Setup
Run the database setup script:
```bash
node backend/setup_database.js
```

### 3. Start the Application
```bash
npm start
```

## Connection Strategy

The system implements a robust connection strategy:

1. **Primary**: Supabase Pooler (port 6543) - optimized for serverless
2. **Fallback**: Direct connection (port 5432) - automatic switch on failure
3. **Circuit Breaker**: Prevents overwhelming failing database
4. **Retry Logic**: Exponential backoff with smart error handling

## Troubleshooting

### Connection Issues
- Check if Supabase project is active
- Verify DATABASE_URL is correct
- Try direct connection if pooler fails
- Check SSL certificates

### Performance Issues
- Monitor circuit breaker state
- Check connection pool health
- Review slow query logs

## Security Notes

- Change `SESSION_SECRET` in production
- Use environment variables for sensitive data
- Enable SSL for database connections
- Monitor for connection failures
