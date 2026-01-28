# Foundry

**Foundry**는 개인 Kubernetes 클러스터에서 실행되는 Private PaaS(Platform as a Service)입니다. Vercel과 유사한 배포 경험을 제공하며, GitHub OAuth 인증, 프로젝트 관리, 실시간 빌드 로그 스트리밍 등을 지원합니다.

## 🚀 Features

### Authentication & User Management
- **GitHub OAuth 2.0** 통합 인증
- **Invite Code System**: 월별 자동 순환 초대 코드
- **User Profile**: GitHub 프로필 이미지 및 사용자 정보 동기화
- **Account Management**: 회원 탈퇴 시 GitHub OAuth 권한 자동 해제

### Project Management
- **프로젝트 배포**: GitHub 저장소 기반 자동 배포
- **상태 모니터링**: Building, Running, Error 상태 실시간 추적
- **Community Feed**: 공개 프로젝트 대시보드

### Social Features
- **좋아요(Like)**: 프로젝트당 유저별 1회 좋아요
- **조회수(View)**: 유니크 사용자 기반 조회수 추적
- **즐겨찾기(Favorite)**: 개인화된 프로젝트 북마크
- **정렬 기능**: 최신순, 좋아요순, 조회수순 정렬 (즐겨찾기 우선 표시)

### Tech Stack
#### Frontend (Client)
- **Framework**: React 18 + Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: TanStack Query (React Query), Zustand
- **Routing**: React Router v6

#### Backend (Server)
- **Language**: Go (Golang)
- **Web Framework**: Echo v4
- **Database**: PostgreSQL (via Docker)
- **ORM**: GORM
- **Authentication**: OAuth2 (GitHub)
- **Infrastructure**: Kubernetes (on-premise)

## 📁 Project Structure

```
foundry/
├── client/              # React Frontend
│   ├── src/
│   │   ├── components/  # Reusable UI components (shadcn/ui)
│   │   ├── pages/       # Page components
│   │   ├── lib/         # Utilities and helpers
│   │   └── styles/      # Global styles
│   └── package.json
│
├── server/              # Go Backend
│   ├── cmd/api/         # Application entry point
│   ├── internal/
│   │   ├── handler/     # HTTP handlers
│   │   ├── model/       # Data models
│   │   └── database/    # Database connection
│   ├── schema.sql       # Database schema
│   ├── seed.sql         # Mock data
│   └── go.mod
│
└── README.md
```

## 🛠️ Setup & Installation

### Prerequisites
- **Docker** (for PostgreSQL)
- **Node.js** 18+ (for frontend)
- **Go** 1.21+ (for backend)
- **GitHub OAuth App** (Client ID & Secret)

### 1. Database Setup
```bash
# Start PostgreSQL container
docker run -d \
  --name foundry-db \
  -e POSTGRES_USER=park \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=foundry \
  -p 5432:5432 \
  postgres:15

# Apply schema
cat server/schema.sql | docker exec -i foundry-db psql -U park -d foundry

# (Optional) Seed mock data
cat server/seed.sql | docker exec -i foundry-db psql -U park -d foundry
```

### 2. Backend Setup
```bash
cd server

# Create .env file
cat > .env << EOF
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
EOF

# Install dependencies
go mod download

# Run server
go run cmd/api/main.go
```

Server will start on `http://localhost:8080`

### 3. Frontend Setup
```bash
cd client

# Install dependencies
npm install

# Run dev server
npm run dev
```

Frontend will start on `http://localhost:5173`

## 🔐 GitHub OAuth Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set **Authorization callback URL** to: `http://localhost:8080/auth/github/callback`
4. Copy **Client ID** and **Client Secret** to `server/.env`

## 🎯 Usage

### First Time Login
1. Visit `http://localhost:5173/login`
2. Click "Login with GitHub"
3. Authorize the application
4. Enter invite code (default: `FOUNDRY-START` or `FOUNDRY-VIP`)
5. Account activated!

### Invite Codes
- **Master Code**: `FOUNDRY-VIP` (always valid)
- **Monthly Codes**: Auto-generated (e.g., `FOUNDRY-JAN`, `FOUNDRY-FEB`)

## 🏗️ Architecture

### Authentication Flow
```
User → GitHub OAuth → Backend (/auth/github/callback)
     → Store User + Access Token → Redirect to Frontend
     → Frontend stores token in localStorage
     → User enters Invite Code → Account Activated
```

### Project Interactions
```
User clicks Like/Favorite/View
  → Frontend (Optimistic Update)
  → Backend API (POST /api/projects/:id/{like|favorite|view})
  → Database (Insert/Delete in interaction tables)
  → Update aggregate counts (like_count, view_count)
```

## 📊 Database Schema

### Core Tables
- `users`: User accounts with GitHub info
- `projects`: Deployed projects
- `invite_codes`: Monthly rotating invite codes

### Interaction Tables
- `project_likes`: User-Project like relationships
- `project_views`: Unique view tracking
- `project_favorites`: User bookmarks

## 🚧 Roadmap

- [ ] Kaniko integration for actual builds
- [ ] Real-time build logs via WebSocket
- [ ] Kubernetes namespace isolation per user
- [ ] Custom domain support
- [ ] Environment variable management
- [ ] Deployment rollback

## 📝 License

MIT License

## 👨‍💻 Author

Built with ❤️ by **park-dev** as part of Project Foundry - a private PaaS experiment.

---

**Note**: This is a development/learning project. For production use, implement proper security measures, JWT authentication, and comprehensive error handling.
