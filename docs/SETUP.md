# Setup Guide - Nora Agents

## Requirements

- **Node.js**: 22.x (check with `node --version`)
- **npm**: 10.x+ (comes with Node.js)
- **Git**: For version control
- **Internet**: For OpenAI API calls and optional MongoDB/PostgreSQL

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Agents
```

### 2. Install Dependencies

**Option A: Install All at Once**
```bash
npm run install:all
```

**Option B: Install Separately**
```bash
# Backend
cd backend
npm install
cd ..

# Frontend
cd frontend
npm install
cd ..
```

## Configuration

### Backend Environment Variables

Create `backend/.env` file with:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4o-mini

# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Database - PostgreSQL (Optional)
POSTGRES_URL=postgresql://user:password@localhost:5432/nora_db

# Database - MongoDB (Optional)
MONGODB_URI=mongodb://localhost:27017/nora

# CORS Settings
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
ALLOW_LOCAL_DEBUG=true
```

### Frontend Environment Variables

Create `frontend/.env` file with:

```env
VITE_API_BASE_URL=http://localhost:3001
VITE_ASSISTANT_NAME=NORA
VITE_DEBUG_MODE=false
VITE_BACKEND_TYPE=ctm
```

### Environment File Template

Copy the example files:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

## Database Setup

### Option 1: Local PostgreSQL (Recommended for Development)

```bash
# Install PostgreSQL (macOS)
brew install postgresql

# Start PostgreSQL
brew services start postgresql

# Create database
createdb nora_db

# Update .env with:
# POSTGRES_URL=postgresql://postgres:password@localhost:5432/nora_db
```

### Option 2: MongoDB Atlas (Cloud)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Get connection string
4. Update `MONGODB_URI` in `backend/.env`

### Option 3: No Database (Fallback Mode)

- If both databases are unavailable, the backend uses JSON file storage
- Data stored in `backend/src/data/fallback-conversations.json`
- Suitable for testing but not recommended for production

## Development

### Start Backend

```bash
npm run dev:backend
```

The backend will start on `http://localhost:3001` with hot reload.

**Output should show:**
```
✅ MongoDB conectado exitosamente
✅ PostgreSQL connected and conversation table initialized
🚀 Servidor ejecutándose en puerto 3001
📍 Dashboard: http://localhost:3001
```

### Start Frontend

In a separate terminal:

```bash
npm run dev:frontend
```

The frontend will start on `http://localhost:5173`.

**Output should show:**
```
  VITE v8.x.x  ready in 234 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

### Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## Building for Production

### Build All

```bash
npm run build:all
```

This will:
1. Install dependencies in both backend and frontend
2. Build the React frontend (output: `frontend/dist/`)
3. Prepare the backend for production

### Build Output

- **Frontend compiled to**: `frontend/dist/`
- **Backend**: Ready to run
- **Total size**: ~2-3 MB

### Test Production Build Locally

```bash
# Build
npm run build:all

# Start backend (serves compiled frontend)
npm run start

# Access at http://localhost:3001
```

## Project Structure

```
Agents/
├── backend/
│   ├── src/
│   │   ├── config/       # Configuration files
│   │   ├── controllers/  # Request handlers
│   │   ├── database/     # DB connections
│   │   ├── middleware/   # Express middleware
│   │   ├── models/       # Mongoose schemas
│   │   ├── routes/       # Route definitions
│   │   ├── services/     # Business logic
│   │   ├── utils/        # Helper functions
│   │   ├── data/         # Fallback storage
│   │   └── index.js      # Entry point
│   ├── .env              # Environment variables
│   ├── package.json
│   └── server.js         # Start script
│
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── constants/    # App constants
│   │   ├── hooks/        # Custom hooks
│   │   ├── services/     # API client
│   │   ├── types/        # TypeScript types
│   │   ├── utils/        # Helpers
│   │   ├── App.tsx       # Root component
│   │   └── main.tsx      # Entry point
│   ├── public/           # Static assets
│   ├── dist/             # Build output
│   ├── .env              # Environment variables
│   ├── vite.config.ts    # Vite config
│   ├── index.html
│   └── package.json
│
├── docs/
│   ├── ARCHITECTURE.md   # System architecture
│   ├── API.md            # API documentation
│   ├── SETUP.md          # This file
│   └── DEPLOYMENT.md     # Deployment guide
│
├── .env.example          # Root env template
├── .gitignore
├── package.json          # Root scripts
├── railway.json          # Railway config
└── README.md
```

## Available Scripts

### Root Level

```bash
npm run install:all    # Install all dependencies
npm run build:all      # Build entire project
npm run start          # Start backend (production mode)
npm run dev:backend    # Start backend with hot reload
npm run dev:frontend   # Start frontend with Vite
npm run dev            # Alias for dev:frontend
```

### Backend Only

```bash
cd backend
npm run start          # Start server
npm run dev            # Start with nodemon
npm install            # Install dependencies
```

### Frontend Only

```bash
cd frontend
npm run build          # Build for production
npm run dev            # Start dev server
npm run preview        # Preview production build
npm install            # Install dependencies
```

## Troubleshooting

### Port Already in Use

**Error**: `EADDRINUSE: address already in use :::3001`

**Solution**:
```bash
# Kill process using port 3001
# On macOS/Linux:
lsof -i :3001 | grep LISTEN | awk '{print $2}' | xargs kill -9

# On Windows (PowerShell):
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process
```

### OpenAI API Key Error

**Error**: `401 Unauthorized - Invalid API key`

**Solution**:
1. Get key from [OpenAI Dashboard](https://platform.openai.com/account/api-keys)
2. Update `OPENAI_API_KEY` in `backend/.env`
3. Restart backend

### Database Connection Error

**Error**: `ECONNREFUSED` or database not found

**Solution**:
- Verify database is running
- Check connection string in `.env`
- Use fallback mode (omit DB vars) for testing
- Check [Database Setup](#database-setup) section

### Frontend Not Loading

**Error**: Blank page or 404

**Solution**:
1. Verify frontend built: `ls frontend/dist/`
2. Check backend is serving: `curl http://localhost:3001/`
3. Check console for errors
4. Try: `npm run build:all && npm run start`

### CORS Errors in Browser Console

**Error**: `CORS policy: Cross-Origin Request Blocked`

**Solution**:
1. Verify `FRONTEND_URL` in backend `.env`
2. Check `VITE_API_BASE_URL` in frontend `.env`
3. Ensure backend CORS middleware is enabled
4. For dev: set `ALLOW_LOCAL_DEBUG=true`

### TypeScript Errors

**Error**: Type errors in IDE

**Solution**:
```bash
cd frontend
npm install
# Check tsconfig.json is present
npm run build  # Should compile without errors
```

## Performance Tips

- **Backend**: Enable gzip compression for responses
- **Frontend**: Use lazy loading for components
- **Database**: Add indexes to frequently queried fields
- **Caching**: Implement Redis for metric caching

## Security Checklist

- [ ] OpenAI API key is not in git history
- [ ] Environment variables are configured properly
- [ ] Database credentials are not exposed
- [ ] CORS is limited to trusted origins in production
- [ ] Input validation is implemented
- [ ] SQL injection prevention (via Mongoose)
- [ ] XSS prevention (React escaping)

## Next Steps

1. **Read** [ARCHITECTURE.md](./ARCHITECTURE.md) - Understand the system
2. **Read** [API.md](./API.md) - Learn about the endpoints
3. **Read** [DEPLOYMENT.md](./DEPLOYMENT.md) - Deploy to production
4. **Explore** the code structure
5. **Run locally** to understand the flow

## Getting Help

- Check error messages carefully
- Review the relevant documentation file
- Check browser DevTools console
- Check backend logs with `npm run dev:backend`
- Verify environment variables are set correctly

---

**Last Updated**: June 2024
**Version**: 1.0.0
