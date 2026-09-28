package store

import (
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/glebarez/sqlite"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/Bazi-Digital/shift-app/backend/internal/config"
	"github.com/Bazi-Digital/shift-app/backend/internal/models"
)

func Open(cfg config.Config) (*gorm.DB, error) {
	gcfg := &gorm.Config{Logger: logger.New(log.New(os.Stderr, "", log.LstdFlags), logger.Config{
		SlowThreshold: 500 * time.Millisecond, LogLevel: logger.Warn, IgnoreRecordNotFoundError: true,
	})}
	switch cfg.DBDriver {
	case "postgres":
		return gorm.Open(postgres.Open(cfg.DBDSN), gcfg)
	case "sqlite":
		if dir := filepath.Dir(cfg.DBDSN); dir != "." {
			if err := os.MkdirAll(dir, 0o755); err != nil {
				return nil, err
			}
		}
		db, err := gorm.Open(sqlite.Open(cfg.DBDSN+"?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)"), gcfg)
		if err != nil {
			return nil, err
		}
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.SetMaxOpenConns(1)
		}
		return db, nil
	}
	return nil, fmt.Errorf("unknown DB_DRIVER %q (use sqlite or postgres)", cfg.DBDriver)
}

// Migrate creates tables and seeds defaults on first run.
func Migrate(db *gorm.DB, cfg config.Config) error {
	if err := db.AutoMigrate(&models.User{}, &models.Channel{}, &models.Shift{}, &models.RateRule{}, &models.Adjustment{}, &models.Settings{}, &models.Asset{}); err != nil {
		return err
	}

	var s models.Settings
	if err := db.First(&s, 1).Error; errors.Is(err, gorm.ErrRecordNotFound) {
		s = models.Settings{ID: 1, CompanyName: "بازی دیجیتال", Calendar: models.CalendarGregorian, Timezone: "Asia/Tehran",
			Currency: "تومان", RequireApproval: true, EditWindowDays: 3, MaxShiftHours: 16, ShowLeaderboard: true}
		if err := db.Create(&s).Error; err != nil {
			return err
		}
		db.Create(&models.RateRule{Name: "شیفت شب", StartMin: 0, EndMin: 6 * 60, Multiplier: 1.1, Active: true})
		db.Create(&[]models.Channel{{Name: "سایت", Color: "#a855f7", Active: true}, {Name: "تلگرام", Color: "#0891b2", Active: true}})
	}

	var admins int64
	db.Model(&models.User{}).Where("role = ?", models.RoleAdmin).Count(&admins)
	if admins == 0 {
		if cfg.AdminUsername == "" || len(cfg.AdminPassword) < 8 {
			log.Println("WARNING: no admin exists; set ADMIN_USERNAME and ADMIN_PASSWORD (8+ chars) to create one")
			return nil
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(cfg.AdminPassword), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		admin := models.User{Name: cfg.AdminName, Username: cfg.AdminUsername, PasswordHash: string(hash),
			Role: models.RoleAdmin, Avatar: "😎", Color: "#a855f7", Active: true}
		if err := db.Create(&admin).Error; err != nil {
			return err
		}
		log.Printf("created admin user %q", cfg.AdminUsername)
	}
	return nil
}
