# Foundry

**Foundry**는 개인 Kubernetes 클러스터에서 실행되는 Private PaaS(Platform as a Service)입니다.

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

### Prerequisites
- **Docker** (for PostgreSQL)
- **Node.js** 18+ (for frontend)
- **Go** 1.21+ (for backend)
- **GitHub OAuth App** (Client ID & Secret)

## 📝 License

MIT License

## 👨‍💻 Author

Built with ❤️ by **heejunp** as part of Project Foundry - a private PaaS experiment.

---

**Note**: This is a development/learning project. For production use, implement proper security measures, JWT authentication, and comprehensive error handling.
