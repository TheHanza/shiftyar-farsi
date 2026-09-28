package store

import (
	"log"
	"math/rand"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/Bazi-Digital/shift-app/backend/internal/models"
)

// SeedDemo fills an empty database with sample employees and five weeks of
// shifts. Every demo account uses the password "demo1234".
func SeedDemo(db *gorm.DB) error {
	var n int64
	db.Model(&models.User{}).Where("role = ?", models.RoleEmployee).Count(&n)
	if n > 0 {
		log.Println("demo: employees already exist, skipping")
		return nil
	}
	hash, _ := bcrypt.GenerateFromPassword([]byte("demo1234"), bcrypt.DefaultCost)
	one, two := uint(1), uint(2)
	people := []struct {
		user        models.User
		start, span int // usual start hour and length
	}{
		{models.User{Name: "سارا", Username: "sara", Avatar: "🦄", Color: "#db2777", ChannelID: &one}, 9, 6},
		{models.User{Name: "علی", Username: "ali", Avatar: "😎", Color: "#a855f7", ChannelID: &one}, 12, 8},
		{models.User{Name: "پارسا", Username: "parsa", Avatar: "🎮", Color: "#0891b2", ChannelID: &one}, 18, 6},
		{models.User{Name: "مهسا", Username: "mahsa", Avatar: "🌙", Color: "#6366f1", ChannelID: &two}, 0, 6},
		{models.User{Name: "نگار", Username: "negar", Avatar: "🐱", Color: "#d97706", ChannelID: &two}, 15, 7},
	}
	var loc, _ = time.LoadLocation("Asia/Tehran")
	now := time.Now().In(loc)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	r := rand.New(rand.NewSource(7))

	return db.Transaction(func(tx *gorm.DB) error {
		for _, p := range people {
			u := p.user
			u.PasswordHash, u.Role, u.Active = string(hash), models.RoleEmployee, true
			u.HourlyRate = int64(80000 + r.Intn(5)*10000)
			u.WeeklyGoalHours, u.MonthlyGoalHours = 30, 120
			if err := tx.Create(&u).Error; err != nil {
				return err
			}
			for d := 35; d >= 0; d-- {
				if r.Intn(7) == 0 {
					continue // day off
				}
				start := today.AddDate(0, 0, -d).Add(time.Duration(p.start)*time.Hour + time.Duration(r.Intn(3)*30)*time.Minute)
				end := start.Add(time.Duration(p.span)*time.Hour + time.Duration(r.Intn(3)*30-30)*time.Minute)
				if end.After(now) {
					continue
				}
				status := models.StatusApproved
				if d <= 2 {
					status = models.StatusPending
				}
				sh := models.Shift{UserID: u.ID, ChannelID: u.ChannelID, Start: start, End: &end, Status: status, CreatedByID: u.ID}
				if err := tx.Create(&sh).Error; err != nil {
					return err
				}
			}
		}
		log.Println("demo: seeded 5 employees (password demo1234)")
		return nil
	})
}
