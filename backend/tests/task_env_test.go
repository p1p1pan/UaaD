//go:build integration || stress || bgroup

// Shared test environment: TestMain loads .env; openTestDB uses MySQL DSN and pool from config.ApplyMySQLPool (same as cmd/server and scripts/seed).
//
// Prerequisites:
//   1. Server running: cd backend && go run ./cmd/server (required for HTTP tests in this package)
//   2. Seed data loaded: cd backend && go run ./scripts/seed
//
// Run:
//   cd backend && go test -v -tags=integration -count=1 ./tests/
//   cd backend && go test -v -tags=stress -bench=. -benchtime=10s -count=1 ./tests/
//   cd backend && go test -v -tags=bgroup -count=1 ./tests/

package tests
import (
	"os"
	"testing"

	"github.com/joho/godotenv"
	"github.com/uaad/backend/internal/config"
	gormmysql "gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func TestMain(m *testing.M) {
	_ = godotenv.Load("../.env")
	_ = godotenv.Load(".env")
	os.Exit(m.Run())
}

func openTestDB(tb testing.TB) *gorm.DB {
	tb.Helper()
	cfg := config.Load()
	db, err := gorm.Open(gormmysql.Open(cfg.MySQLDSN()), &gorm.Config{})
	if err != nil {
		tb.Fatalf("open database: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		tb.Fatalf("sql.DB: %v", err)
	}
	cfg.ApplyMySQLPool(sqlDB)
	return db
}
